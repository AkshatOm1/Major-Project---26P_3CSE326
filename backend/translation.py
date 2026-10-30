"""Lazy, local translation for generated study notes using OPUS-MT."""

from copy import deepcopy
from threading import RLock


MODEL_ID = 'Helsinki-NLP/opus-mt-en-mul'
_model = None
_tokenizer = None
_torch = None
_device = None
_model_lock = RLock()

# These target IDs are the language tokens used by the OPUS-MT en-mul model.
SUPPORTED_LANGUAGES = {
    'afr': 'Afrikaans',
    'amh': 'Amharic',
    'ara': 'Arabic',
    'asm': 'Assamese',
    'ben': 'Bengali',
    'bod': 'Tibetan',
    'bul': 'Bulgarian',
    'cat': 'Catalan',
    'ces': 'Czech',
    'cmn_Hans': 'Chinese (Simplified)',
    'cmn_Hant': 'Chinese (Traditional)',
    'dan': 'Danish',
    'deu': 'German',
    'ell': 'Greek',
    'est': 'Estonian',
    'eus': 'Basque',
    'fin': 'Finnish',
    'fra': 'French',
    'guj': 'Gujarati',
    'hau_Latn': 'Hausa',
    'heb': 'Hebrew',
    'hin': 'Hindi',
    'hrv': 'Croatian',
    'hun': 'Hungarian',
    'ind': 'Indonesian',
    'ita': 'Italian',
    'jpn': 'Japanese',
    'kan': 'Kannada',
    'khm': 'Khmer',
    'lao': 'Lao',
    'mal': 'Malayalam',
    'mar': 'Marathi',
    'mya': 'Burmese',
    'nld': 'Dutch',
    'npi': 'Nepali',
    'ori': 'Odia',
    'pan_Guru': 'Punjabi',
    'pes': 'Persian',
    'pol': 'Polish',
    'por': 'Portuguese',
    'ron': 'Romanian',
    'rus': 'Russian',
    'sin': 'Sinhala',
    'spa': 'Spanish',
    'swe': 'Swedish',
    'swh': 'Swahili',
    'tam': 'Tamil',
    'tel': 'Telugu',
    'tha': 'Thai',
    'tur': 'Turkish',
    'ukr': 'Ukrainian',
    'urd': 'Urdu',
    'vie': 'Vietnamese',
    'yor': 'Yoruba',
    'zul': 'Zulu',
}

_TEXT_KEYS = {'title', 'summary', 'heading', 'content', 'key_points', 'term', 'definition', 'review_questions'}


def _load_model():
    global _model, _tokenizer, _torch, _device
    if _model is not None:
        return

    try:
        import torch
        from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
    except ImportError as exc:
        raise RuntimeError('Translation needs the backend dependencies in requirements.txt. Restart the backend after installing them.') from exc

    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    model_kwargs = {'torch_dtype': torch.float16} if device == 'cuda' else {}
    tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
    model = AutoModelForSeq2SeqLM.from_pretrained(MODEL_ID, **model_kwargs)
    model.to(device)
    model.eval()

    _torch = torch
    _device = device
    _tokenizer = tokenizer
    _model = model


def _token_chunks(text, limit=240):
    """Split long note text by paragraphs and model tokens to avoid truncation."""
    chunks = []
    for paragraph in str(text).splitlines() or [str(text)]:
        if not paragraph.strip():
            continue
        token_ids = _tokenizer.encode(paragraph, add_special_tokens=False)
        for offset in range(0, len(token_ids), limit):
            part = _tokenizer.decode(token_ids[offset:offset + limit], skip_special_tokens=True).strip()
            if part:
                chunks.append(part)
    return chunks or [str(text)]


def _translate_chunks(chunks, target_language):
    translated = [None] * len(chunks)
    # Group similar input lengths so short fields don't wait behind padded long ones.
    ordered_indices = sorted(range(len(chunks)), key=lambda index: len(_tokenizer.encode(chunks[index], add_special_tokens=False)))
    for offset in range(0, len(ordered_indices), 8):
        indices = ordered_indices[offset:offset + 8]
        batch = [f'>>{target_language}<< {chunks[index]}' for index in indices]
        inputs = _tokenizer(batch, return_tensors='pt', padding=True, truncation=True, max_length=512)
        inputs = {name: tensor.to(_device) for name, tensor in inputs.items()}
        with _torch.inference_mode():
            output = _model.generate(**inputs, max_new_tokens=320, num_beams=1)
        for index, text in zip(indices, _tokenizer.batch_decode(output, skip_special_tokens=True)):
            translated[index] = text
    return translated


def translate_notes(notes, target_language):
    """Return a translated copy; the stored/source notes are never modified."""
    if target_language not in SUPPORTED_LANGUAGES:
        raise ValueError('Choose one of the available translation languages.')
    if not isinstance(notes, dict):
        raise ValueError('There are no study notes to translate.')

    translated_notes = deepcopy(notes)
    slots = []
    all_chunks = []

    def collect(value, parent=None, key=None, should_translate=False):
        if isinstance(value, dict):
            for child_key, child_value in value.items():
                collect(child_value, value, child_key, child_key in _TEXT_KEYS)
        elif isinstance(value, list):
            for index, child_value in enumerate(value):
                collect(child_value, value, index, should_translate)
        elif should_translate and isinstance(value, str) and value.strip():
            chunks = _token_chunks(value)
            slots.append((parent, key, len(chunks)))
            all_chunks.extend(chunks)

    with _model_lock:
        _load_model()
        collect(translated_notes)
        if not all_chunks:
            raise ValueError('These notes do not contain text to translate.')
        translated_chunks = _translate_chunks(all_chunks, target_language)

    cursor = 0
    for parent, key, chunk_count in slots:
        parent[key] = ' '.join(translated_chunks[cursor:cursor + chunk_count])
        cursor += chunk_count

    return translated_notes
