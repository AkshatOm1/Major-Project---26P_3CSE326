"""Offline, extractive question generation for uploaded study material.

This uses a small pretrained T5 question-generation model stored in this
backend's models/local_qg directory. It never sends document text over the
network. EdNet is intentionally not used here: EdNet contains learner answer
events for knowledge tracing, not source text paired with quiz questions.
"""

import random
import re
from pathlib import Path

MODEL_DIR = Path(__file__).parent / "models" / "local_qg"

_STOP = {
    "about", "after", "again", "also", "among", "because", "before", "being",
    "between", "could", "does", "during", "each", "from", "have", "into",
    "itself", "more", "most", "other", "over", "same", "should", "some",
    "such", "than", "that", "their", "there", "these", "they", "this", "those",
    "through", "under", "using", "very", "what", "when", "where", "which",
    "while", "with", "would", "your", "then", "them", "were", "been", "will",
    "doesn", "must", "only", "within", "without", "based", "from", "into",
    "using", "use", "used", "if", "in", "on", "at", "by", "to", "of",
    "is", "are", "was", "were", "be", "been", "being", "and", "or", "but",
    "the", "a", "an", "this", "that", "these", "those", "it", "its",
}
_SECTION_HEADERS = re.compile(
    r"\b(?:EDUCATION|EXPERIENCE|SKILLS?|PROJECTS?|LANGUAGES?|CERTIFICATIONS?|"
    r"SUMMARY|PROFILE|STRENGTHS|OBJECTIVE)\b", re.IGNORECASE,
)
_ACTION_BOUNDARIES = re.compile(
    r"(?<!Designed and)(?<=\S)\s+(?=(?:Designed and developed|Developed|Designed|Built|"
    r"Implemented|Created|Applied|Performed|Worked on|Responsibilities include))",
    re.IGNORECASE,
)
_RELATION = re.compile(
    r"\b(?:using|uses|used|include|includes|included|consists of|means|refers to|"
    r"is defined as|results in|causes)\b", re.IGNORECASE,
)
_NON_ANSWER_CAPS = {
    "education", "experience", "skills", "skill", "projects", "languages",
    "certifications", "summary", "profile", "strengths", "objective", "designed",
    "developed", "built", "implemented", "created", "applied", "performed",
    "worked", "with", "the", "a", "an",
}


def _clean_sentences(text):
    text = text.replace("\u2022", ". ").replace("\u25aa", ". ")
    text = _SECTION_HEADERS.sub(lambda m: ". " + m.group(0) + ": ", text)
    text = _ACTION_BOUNDARIES.sub(". ", text)
    text = re.sub(r"\s+", " ", text).strip()
    parts = re.split(r"(?<=[.!?;])\s+|\s+[|]\s+", text)
    result, seen = [], set()
    for part in parts:
        part = re.sub(r"^[\s:–—-]+|[\s:–—-]+$", "", part)
        # Skip page furniture, headings, and long unstructured resume blobs.
        words = re.findall(r"[A-Za-z][A-Za-z0-9+#.-]*", part)
        key = part.casefold()
        # Existing questions generally have no answer key in uploaded notes.
        # Rephrasing them as if an arbitrary word were the answer creates
        # misleading quizzes, so only use declarative facts as source passages.
        looks_like_question = part.endswith("?") or re.match(
            r"^(?:who|what|when|where|why|how|which|using\b.+\bhow\b)", part, re.I
        )
        looks_like_answer_choices = len(re.findall(r"(?:^|\s)[A-D][).]\s*", part)) >= 2
        if (7 <= len(words) <= 38 and len(part) <= 260 and key not in seen
                and not looks_like_question and not looks_like_answer_choices):
            result.append(part)
            seen.add(key)
    return result


def _candidate_answers(sentence):
    answers = []
    for match in _RELATION.finditer(sentence):
        tail = sentence[match.end():].strip(" ,:.-")
        # Keep the fact span short; do not turn an entire paragraph into an answer.
        tail = re.split(r"[,;.]|\b(?:for|to ensure|and then)\b", tail, maxsplit=1, flags=re.I)[0]
        tail = re.sub(r"\s+", " ", tail).strip()
        tail_words = [word.casefold().strip(".,:;()") for word in tail.split()]
        if (1 <= len(tail_words) <= 6 and len(tail) >= 2
                and any(len(word) > 2 and word not in _STOP for word in tail_words)):
            answers.append(tail)

    # Capitalized names, acronyms, and technical terms are useful answer spans
    # in resumes and study notes. Require at least one informative token.
    for match in re.finditer(r"\b(?:[A-Z][A-Za-z0-9+#.-]*|[A-Z]{2,})(?:\s+(?:and|&)?\s*(?:[A-Z][A-Za-z0-9+#.-]*|[A-Z]{2,}))*", sentence):
        value = match.group(0).strip()
        value_words = [word.casefold().strip(".,:;()") for word in value.split()]
        looks_like_number_or_currency = bool(re.fullmatch(
            r"(?:rs\.?|₹|\$)?\s*\d+(?:\.\d+)?%?", value, re.I
        ))
        if (value.casefold() not in _NON_ANSWER_CAPS and len(value.split()) <= 5
                and all(len(word) > 1 for word in value_words)
                and not (len(value_words) == 1 and value_words[0] in _STOP)
                and not looks_like_number_or_currency):
            answers.append(value)

    cleaned, seen = [], set()
    for answer in answers:
        key = answer.casefold()
        tokens = [word.casefold().strip(".,:;()") for word in answer.split()]
        if (key not in seen and key in sentence.casefold()
                and any(len(word) > 2 and word not in _STOP for word in tokens)):
            seen.add(key)
            cleaned.append(answer)
    return cleaned[:8]


class LocalQuestionGenerator:
    def __init__(self):
        if not MODEL_DIR.exists() or not any(MODEL_DIR.iterdir()):
            raise FileNotFoundError(
                f"Local question model is missing. Run {Path(__file__).parent / 'download_local_qg_model.py'} first."
            )
        import torch
        from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        # The fast tokenizer converts SentencePiece metadata through protobuf;
        # use the native SentencePiece tokenizer for broader Python compatibility.
        self.tokenizer = AutoTokenizer.from_pretrained(
            str(MODEL_DIR), local_files_only=True, use_fast=False
        )
        # Disable meta-device initialization. On some Windows/PyTorch builds the
        # checkpoint remains on meta tensors and .to('cpu') cannot materialize it.
        self.model = AutoModelForSeq2SeqLM.from_pretrained(
            str(MODEL_DIR),
            local_files_only=True,
            use_safetensors=True,
            low_cpu_mem_usage=False,
        )
        self.model.to(self.device).eval()

    def _question(self, answer, context):
        import torch

        prompt = f"<answer> {answer} <context> {context}"
        encoded = self.tokenizer(prompt, return_tensors="pt", truncation=True, max_length=512)
        encoded = {key: value.to(self.device) for key, value in encoded.items()}
        with torch.inference_mode():
            output = self.model.generate(**encoded, max_new_tokens=48, num_beams=4, do_sample=False)
        question = self.tokenizer.decode(output[0], skip_special_tokens=True).strip()
        if not question.endswith("?"):
            question = question.rstrip(".! ") + "?"
        if len(question) > 150 or len(question.split()) < 4:
            return ""
        return question

    def generate(self, text, count):
        sentences = _clean_sentences(text[:30000])
        if not sentences:
            return []

        records, seen_questions = [], set()
        all_answers = []
        candidate_pairs = [
            (sentence, answer)
            for sentence in sentences
            for answer in _candidate_answers(sentence)
        ]
        random.shuffle(candidate_pairs)
        for sentence, answer in candidate_pairs[:max(count * 4, 12)]:
            all_answers.append(answer)
            question = self._question(answer, sentence)
            key = question.casefold()
            if question and key not in seen_questions:
                records.append({"question": question, "answer": answer, "context": sentence})
                seen_questions.add(key)
            if len(records) >= count * 2:
                break
        if not records:
            return []

        # Prefer distinct facts and vary the order between quiz sessions.
        random.shuffle(records)
        answers = list(dict.fromkeys(all_answers))
        questions = []
        for record in records:
            correct = record["answer"]
            distractors = [value for value in answers if value.casefold() != correct.casefold()]
            random.shuffle(distractors)
            options = [correct] + distractors[:3]
            if len(options) < 4:
                continue
            random.shuffle(options)
            questions.append({
                "question": record["question"],
                "options": options,
                "correctAnswer": options.index(correct),
                "explanation": f"This answer is supported by the uploaded text: {record['context']}",
            })
            if len(questions) >= count:
                break
        return questions
