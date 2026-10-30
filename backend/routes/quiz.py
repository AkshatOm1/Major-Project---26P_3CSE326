from flask import Blueprint, request, jsonify
from middleware import token_required
from db import get_db
from config import Config
# import google.generativeai as genai  # disabled temporarily - Python 3.14 / protobuf compatibility issue
import datetime
import json

quiz_bp = Blueprint('quiz', __name__)
# genai.configure(api_key=Config.GEMINI_API_KEY)

def calculate_adaptive_difficulty(user_id, topic):
    db = get_db()
    attempts = list(db.quiz_attempts.find({'user_id': user_id, 'topic': topic}).sort('timestamp', -1).limit(3))
    if not attempts:
        return 'Medium'

    avg_score = sum(a['score'] for a in attempts) / len(attempts)
    if avg_score >= 80:
        return 'Hard'
    elif avg_score <= 40:
        return 'Low'
    return 'Medium'

@quiz_bp.route('/generate', methods=['POST'])
@token_required
def generate_quiz():
    data = request.get_json() or {}
    topic = data.get('topic')
    manual_difficulty = data.get('difficulty')

    if not topic:
        return jsonify({'error': 'Topic is required'}), 400

    difficulty = manual_difficulty or calculate_adaptive_difficulty(request.user_id, topic)

    db = get_db()
    docs = list(db.documents.find({'user_id': request.user_id, 'topic_tags': topic}))
    combined_text = "\n".join([d['raw_text'] for d in docs])[:4000]

    # Gemini quiz generation disabled tonight - returning a placeholder quiz
    # so the adaptive-difficulty logic above (which IS fully real) can still be demoed end-to-end
    questions = [
        {
            "question": f"[Placeholder] Sample question about {topic}?",
            "options": ["Option A", "Option B", "Option C", "Option D"],
            "answer": "Option A",
            "explanation": "This is placeholder content - Gemini generation is disabled due to a Python 3.14 compatibility issue tonight."
        },
        {
            "question": f"[Placeholder] Another sample question on {topic}?",
            "options": ["Option A", "Option B", "Option C", "Option D"],
            "answer": "Option B",
            "explanation": "This is placeholder content - Gemini generation is disabled due to a Python 3.14 compatibility issue tonight."
        }
    ]

    return jsonify({'topic': topic, 'difficulty': difficulty, 'questions': questions}), 200

@quiz_bp.route('/submit', methods=['POST'])
@token_required
def submit_quiz():
    data = request.get_json() or {}
    topic = data.get('topic')
    difficulty = data.get('difficulty')
    questions = data.get('questions', [])
    answers = data.get('answers', [])

    if not topic or len(questions) != len(answers):
        return jsonify({'error': 'Invalid payload'}), 400

    correct_count = 0
    for q, ans in zip(questions, answers):
        if q.get('answer') == ans:
            correct_count += 1

    score = round((correct_count / len(questions)) * 100, 2)

    db = get_db()
    attempt = {
        'user_id': request.user_id,
        'topic': topic,
        'difficulty': difficulty,
        'questions': questions,
        'answers': answers,
        'score': score,
        'timestamp': datetime.datetime.utcnow()
    }
    db.quiz_attempts.insert_one(attempt)

    db.activity_log.insert_one({
        'user_id': request.user_id,
        'verb': 'attempted_quiz',
        'object': f"Quiz on {topic}",
        'topic': topic,
        'timestamp': datetime.datetime.utcnow()
    })

    return jsonify({'score': score, 'correct': correct_count, 'total': len(questions)}), 200
