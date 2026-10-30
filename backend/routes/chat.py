from flask import Blueprint, request, jsonify
from middleware import token_required
from db import get_db, collection, embedding_model
from config import Config
# import google.generativeai as genai  # disabled temporarily - Python 3.14 / protobuf compatibility issue
import datetime

chat_bp = Blueprint('chat', __name__)
# genai.configure(api_key=Config.GEMINI_API_KEY)

@chat_bp.route('', methods=['POST'])
@token_required
def chat():
    data = request.get_json() or {}
    query = data.get('query')
    document_id = data.get('document_id')

    if not query:
        return jsonify({'error': 'Query is required'}), 400

    query_embedding = embedding_model.encode([query]).tolist()[0]

    if collection is None:
        return jsonify({
            'answer': "Chat/RAG is temporarily disabled in this environment (vector DB and Gemini pending a compatible Python setup). This response is a placeholder for tonight's demo.",
            'citations': []
        }), 200

    where_filter = {"user_id": request.user_id}
    if document_id:
        where_filter["doc_id"] = document_id

    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=3,
        where=where_filter
    )

    retrieved_chunks = results['documents'][0] if results['documents'] else []

    if not retrieved_chunks:
        return jsonify({
            'answer': "I couldn't find relevant information in your uploaded materials to answer this query.",
            'citations': []
        }), 200

    context = "\n\n---\n\n".join(retrieved_chunks)
    prompt = f"""You are a personalized AI study assistant. Answer the student's question strictly using the provided context chunks below. Do not use outside knowledge. If the answer cannot be found in the context, explicitly say that the notes do not contain this information.

Context:
{context}

Question:
{query}
"""

    # Gemini call disabled tonight - placeholder response
    answer_text = "Gemini generation is temporarily disabled (Python 3.14 compatibility issue). Retrieved context would normally be passed to the model here."

    db = get_db()
    db.activity_log.insert_one({
        'user_id': request.user_id,
        'verb': 'chatted',
        'object': query[:30],
        'topic': 'RAG Chat',
        'timestamp': datetime.datetime.utcnow()
    })

    return jsonify({
        'answer': answer_text,
        'citations': retrieved_chunks
    }), 200
