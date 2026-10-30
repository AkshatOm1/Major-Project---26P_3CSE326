"""Deep Knowledge Tracing model trained from EdNet-KT2/KT3 logs."""

from pathlib import Path
import json

import torch
from torch import nn


class DeepKnowledgeTracing(nn.Module):
    """Predict a learner's next correctness probability per EdNet question."""

    def __init__(self, question_count: int, embedding_dim: int = 64, hidden_dim: int = 128, input_vocab_size=None):
        super().__init__()
        self.question_count = question_count
        self.input_vocab_size = int(input_vocab_size or question_count * 2)
        self.embedding = nn.Embedding(self.input_vocab_size, embedding_dim)
        self.rnn = nn.GRU(embedding_dim, hidden_dim, batch_first=True)
        self.output = nn.Linear(hidden_dim, question_count)

    def forward(self, event_tokens):
        embedded = self.embedding(event_tokens)
        hidden, _ = self.rnn(embedded)
        return self.output(hidden)


class EdNetPredictor:
    """Loads a trained checkpoint and predicts candidates from a history."""

    def __init__(self, model_dir=None):
        if model_dir is None:
            model_root = Path(__file__).parent / "models"
            combined_model = model_root / "ednet_kt23"
            model_dir = combined_model if (combined_model / "metadata.json").exists() else model_root / "ednet_kt2"
        self.model_dir = Path(model_dir)
        self.model = None
        self.metadata = {}
        self.question_to_index = {}
        self.index_to_question = []
        self.action_to_index = {}
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self._load()

    def _load(self):
        metadata_path = self.model_dir / "metadata.json"
        checkpoint_path = self.model_dir / "model.pt"
        if not metadata_path.exists() or not checkpoint_path.exists():
            return
        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        self.metadata = metadata
        self.index_to_question = metadata["questions"]
        self.question_to_index = {q: i for i, q in enumerate(self.index_to_question)}
        self.action_to_index = metadata.get("action_to_index", {})
        self.model = DeepKnowledgeTracing(
            len(self.index_to_question),
            input_vocab_size=metadata.get("input_vocab_size", len(self.index_to_question) * 2)
        )
        state = torch.load(checkpoint_path, map_location=self.device, weights_only=True)
        self.model.load_state_dict(state)
        self.model.to(self.device).eval()

    @property
    def ready(self):
        return self.model is not None

    def predict(self, history, candidates):
        """history: [{question_id: q123, correct: bool}], candidates: [q123, ...]."""
        if not self.ready:
            raise RuntimeError("EdNet model is not trained. Run train_ednet_kt2.py first.")

        tokens = []
        for event in history[-200:]:
            action_type = event.get("action_type") or event.get("action")
            if action_type:
                item_type = str(event.get("item_id") or "")[0:1]
                action_key = f"{action_type}:{item_type}:{event.get('source') or ''}"
                action_index = self.action_to_index.get(action_key)
                if action_index is not None:
                    tokens.append(int(action_index))
                continue
            idx = self.question_to_index.get(str(event.get("question_id")))
            if idx is not None:
                tokens.append(idx + (len(self.index_to_question) if bool(event.get("correct")) else 0))

        if not tokens:
            tokens = [0]
        with torch.no_grad():
            tensor = torch.tensor([tokens], dtype=torch.long, device=self.device)
            probabilities = torch.sigmoid(self.model(tensor)[0, -1]).cpu().tolist()

        results = []
        for question_id in candidates:
            idx = self.question_to_index.get(str(question_id))
            results.append({
                "question_id": str(question_id),
                "probability_correct": round(probabilities[idx], 6) if idx is not None else None,
            })
        return results
