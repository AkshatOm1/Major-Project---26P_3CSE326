"""Offline lexical RAG retrieval using BM25 over uploaded study materials."""

import math
import re


TOKEN_RE = re.compile(r"[A-Za-z0-9+#.-]{2,}")
STOP_WORDS = {
    'about', 'after', 'again', 'also', 'and', 'are', 'because', 'been', 'being',
    'but', 'can', 'could', 'did', 'does', 'for', 'from', 'had', 'has', 'have',
    'how', 'into', 'its', 'not', 'our', 'out', 'should', 'that', 'the', 'their',
    'them', 'then', 'there', 'these', 'they', 'this', 'those', 'through', 'was',
    'were', 'what', 'when', 'where', 'which', 'while', 'who', 'will', 'with', 'you'
}


def tokenize(text):
    return [word.casefold() for word in TOKEN_RE.findall(str(text or '')) if word.casefold() not in STOP_WORDS]


def build_chunks(documents, chunk_words=180, overlap=35, max_chunks=2500):
    chunks = []
    for document in documents:
        source_parts = [str(document.get('content') or '').strip()]
        notes = document.get('notes') or {}
        if isinstance(notes, dict):
            source_parts.extend([str(notes.get('title') or ''), str(notes.get('summary') or '')])
            for section in notes.get('sections', []):
                if isinstance(section, dict):
                    source_parts.extend([str(section.get('heading') or ''), str(section.get('content') or '')])
                    points = section.get('key_points', [])
                    if isinstance(points, list):
                        source_parts.extend(str(point) for point in points if point)
            for term in notes.get('key_terms', []):
                if isinstance(term, dict):
                    source_parts.extend([str(term.get('term') or ''), str(term.get('definition') or '')])
        words = '\n'.join(part for part in source_parts if part).split()
        if not words:
            continue
        step = max(1, chunk_words - overlap)
        for index, start in enumerate(range(0, len(words), step)):
            text = ' '.join(words[start:start + chunk_words]).strip()
            terms = tokenize(text)
            if len(terms) < 8:
                continue
            chunks.append({
                'document_id': str(document.get('_id', '')),
                'filename': str(document.get('filename') or 'Study material'),
                'chunk_index': index,
                'text': text,
                'terms': terms,
            })
            if len(chunks) >= max_chunks:
                return chunks
    return chunks


def retrieve(query, documents, limit=5):
    query_terms = set(tokenize(query))
    if not query_terms:
        return []
    chunks = build_chunks(documents)
    if not chunks:
        return []

    document_frequency = {}
    for chunk in chunks:
        for term in set(chunk['terms']):
            document_frequency[term] = document_frequency.get(term, 0) + 1
    average_length = sum(len(chunk['terms']) for chunk in chunks) / len(chunks)
    count = len(chunks)
    scored = []
    for chunk in chunks:
        frequencies = {}
        for term in chunk['terms']:
            frequencies[term] = frequencies.get(term, 0) + 1
        score = 0.0
        for term in query_terms:
            frequency = frequencies.get(term, 0)
            if not frequency:
                continue
            doc_freq = document_frequency.get(term, 0)
            inverse_frequency = math.log(1 + (count - doc_freq + 0.5) / (doc_freq + 0.5))
            denominator = frequency + 1.2 * (1 - 0.75 + 0.75 * len(chunk['terms']) / max(average_length, 1))
            score += inverse_frequency * frequency * 2.2 / denominator
        if score > 0:
            scored.append((score, chunk))

    scored.sort(key=lambda item: item[0], reverse=True)
    return [
        {key: chunk[key] for key in ('document_id', 'filename', 'chunk_index', 'text')} | {'score': round(score, 4)}
        for score, chunk in scored[:limit]
    ]
