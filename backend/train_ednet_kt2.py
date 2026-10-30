"""Train a baseline DKT model from EdNet-KT3 with KT2 fallback.

Expected input layout:
  data/ednet/KT3/*.csv       richer action log per student (preferred)
  data/ednet/KT2/*.csv       fallback logs for students missing from KT3
  data/ednet/content/questions.csv (or question.csv) with question_id/correct_answer

Start small on Windows:
  python train_ednet_kt2.py --data-dir data/ednet --max-students 3000 --epochs 3
"""

import argparse
import csv
import json
import random
from pathlib import Path

import numpy as np
import torch
from torch import nn
from torch.nn.utils.rnn import pad_sequence

from ednet_model import DeepKnowledgeTracing


def find_questions_csv(content_dir):
    for name in ("questions.csv", "question.csv"):
        path = content_dir / name
        if path.exists():
            return path
    raise FileNotFoundError(f"Could not find questions.csv in {content_dir}")


def read_answer_key(path):
    with path.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        if not reader.fieldnames or not {"question_id", "correct_answer"}.issubset(reader.fieldnames):
            raise ValueError("Question content CSV must contain question_id and correct_answer columns")
        return {row["question_id"]: row["correct_answer"].strip().lower() for row in reader}


def student_events(path, answer_key, question_to_index, action_to_index):
    """Encode KT2/KT3 actions plus final question outcomes as model inputs."""
    events, pending = [], {}
    question_count = len(question_to_index)

    def action_token(action_type, item_id, source):
        key = f"{action_type}:{item_id[:1]}:{source}"
        action_to_index.setdefault(key, question_count * 2 + len(action_to_index))
        return action_to_index[key]

    with path.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        needed = {"action_type", "item_id", "user_answer"}
        if not reader.fieldnames or not needed.issubset(reader.fieldnames):
            return events
        for row in reader:
            action = row["action_type"].strip()
            item_id = row["item_id"].strip()
            source = (row.get("source") or "").strip()
            if action in {"enter", "quit"}:
                events.append((action_token(action, item_id, source), None, None))
                if action == "enter" and item_id.startswith("b"):
                    pending = {}
            elif action == "respond" and item_id.startswith("q"):
                # Repeated responds are edits; only the last response is final.
                pending[item_id] = row.get("user_answer", "").strip().lower()
            elif action == "submit":
                events.append((action_token(action, item_id, source), None, None))
                for question_id, answer in pending.items():
                    if question_id in answer_key and question_id in question_to_index and answer:
                        question_index = question_to_index[question_id]
                        correct = int(answer == answer_key[question_id])
                        token = question_index + (question_count if correct else 0)
                        events.append((token, question_index, correct))
                pending = {}
    return events


def chunk_events(events, chunk_len):
    # Each input predicts the next event, so a segment needs one extra event.
    for start in range(0, len(events) - 1, chunk_len):
        segment = events[start:start + chunk_len + 1]
        if len(segment) > 1 and any(event[1] is not None for event in segment[1:]):
            yield segment


def select_student_files(data_dir):
    """Use one log per student: KT3 when present, otherwise KT2.

    KT3 contains the KT2 question-response behavior plus explanation/lecture
    interactions, so using both files for the same student would double count
    highly overlapping histories and leak learners across train/validation.
    """
    selected = {}
    sources = {}
    for dataset_name in ("KT2", "KT3"):
        dataset_dir = data_dir / dataset_name
        if not dataset_dir.is_dir():
            continue
        for path in dataset_dir.glob("*.csv"):
            selected[path.stem] = path
            sources[path.stem] = dataset_name
    files = sorted(selected.values())
    if not files:
        raise FileNotFoundError(f"No student CSV files found under {data_dir / 'KT2'} or {data_dir / 'KT3'}")
    return files, sources


def batch_loss(model, batch, question_count, device):
    xs = [torch.tensor([token for token, _, _ in seq[:-1]]) for seq in batch]
    target_qs = [torch.tensor([event[1] if event[1] is not None else 0 for event in seq[1:]]) for seq in batch]
    target_y = [torch.tensor([float(event[2] or 0) for event in seq[1:]], dtype=torch.float32) for seq in batch]
    x = pad_sequence(xs, batch_first=True, padding_value=0).to(device)
    q = pad_sequence(target_qs, batch_first=True, padding_value=0).to(device)
    y = pad_sequence(target_y, batch_first=True, padding_value=0).to(device)
    target_mask = [torch.tensor([event[1] is not None for event in seq[1:]], dtype=torch.bool) for seq in batch]
    mask = pad_sequence(target_mask, batch_first=True, padding_value=False).to(device)
    logits = model(x).gather(2, q.unsqueeze(-1)).squeeze(-1)
    return nn.functional.binary_cross_entropy_with_logits(logits[mask], y[mask])


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-dir", type=Path, default=Path("data/ednet"))
    parser.add_argument("--max-students", type=int, default=5000)
    parser.add_argument("--max-events", type=int, default=2000000)
    parser.add_argument("--chunk-len", type=int, default=100)
    parser.add_argument("--epochs", type=int, default=3)
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--output-dir", type=Path, default=Path("models/ednet_kt2"))
    args = parser.parse_args()

    random.seed(args.seed)
    np.random.seed(args.seed)
    torch.manual_seed(args.seed)
    content_dir = args.data_dir / "content"
    answer_key = read_answer_key(find_questions_csv(content_dir))
    questions = sorted(answer_key)
    question_to_index = {question_id: i for i, question_id in enumerate(questions)}

    files, file_sources = select_student_files(args.data_dir)
    random.shuffle(files)
    sequences = []
    total_events = 0
    students_by_dataset = {"KT2": 0, "KT3": 0}
    action_to_index = {}
    for file_number, path in enumerate(files[:args.max_students], start=1):
        events = student_events(path, answer_key, question_to_index, action_to_index)
        if len(events) >= 2 and any(event[1] is not None for event in events[1:]):
            sequences.append(events)
            total_events += len(events)
            students_by_dataset[file_sources[path.stem]] += 1
        if total_events >= args.max_events:
            break
        if file_number % 500 == 0:
            print(
                f"Loaded {file_number}/{min(len(files), args.max_students)} students; "
                f"{total_events} events collected.",
                flush=True,
            )
    if len(sequences) < 3:
        raise ValueError("Not enough valid student sequences. Check KT2 and content folders.")

    random.shuffle(sequences)
    train_end = max(1, int(len(sequences) * 0.8))
    val_end = max(train_end + 1, int(len(sequences) * 0.9))
    train_seqs, val_seqs = sequences[:train_end], sequences[train_end:val_end]
    train_chunks = [chunk for seq in train_seqs for chunk in chunk_events(seq, args.chunk_len)]
    val_chunks = [chunk for seq in val_seqs for chunk in chunk_events(seq, args.chunk_len)]

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    question_count = len(questions)
    input_vocab_size = question_count * 2 + len(action_to_index)
    model = DeepKnowledgeTracing(question_count, input_vocab_size=input_vocab_size).to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=0.001)
    best_val_loss = float("inf")
    best_state = None
    for epoch in range(args.epochs):
        random.shuffle(train_chunks)
        model.train()
        train_losses = []
        for start in range(0, len(train_chunks), args.batch_size):
            loss = batch_loss(model, train_chunks[start:start + args.batch_size], question_count, device)
            optimizer.zero_grad()
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), 5.0)
            optimizer.step()
            train_losses.append(loss.item())
        model.eval()
        val_losses = []
        with torch.no_grad():
            for start in range(0, len(val_chunks), args.batch_size):
                loss = batch_loss(model, val_chunks[start:start + args.batch_size], question_count, device)
                val_losses.append(loss.item())
        epoch_val_loss = float(np.mean(val_losses))
        print(f"Epoch {epoch + 1}/{args.epochs}: train_loss={np.mean(train_losses):.4f}, val_loss={epoch_val_loss:.4f}")
        if epoch_val_loss < best_val_loss:
            best_val_loss = epoch_val_loss
            best_state = {name: value.detach().cpu().clone() for name, value in model.state_dict().items()}

    args.output_dir.mkdir(parents=True, exist_ok=True)
    model.load_state_dict(best_state)
    torch.save(model.cpu().state_dict(), args.output_dir / "model.pt")
    metadata = {
        "questions": questions,
        "action_to_index": action_to_index,
        "input_vocab_size": input_vocab_size,
        "model": "DKT-GRU",
        "dataset": "EdNet-KT3 preferred, EdNet-KT2 fallback",
        "datasets_used": [name for name, count in students_by_dataset.items() if count],
        "students_by_dataset": students_by_dataset,
        "activity_action_types": sorted({key.split(":", 1)[0] for key in action_to_index}),
        "seed": args.seed,
        "students_used": len(sequences),
        "events_used": total_events,
        "best_validation_loss": best_val_loss,
    }
    (args.output_dir / "metadata.json").write_text(json.dumps(metadata), encoding="utf-8")
    print(f"Saved checkpoint to {args.output_dir.resolve()}")


if __name__ == "__main__":
    main()
