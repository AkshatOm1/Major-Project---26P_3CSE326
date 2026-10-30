from flask import Blueprint, jsonify, request
from middleware import token_required
from db import get_db

scores_bp = Blueprint('scores', __name__)

@scores_bp.route('/summary', methods=['GET'])
@token_required
def get_scores_summary():
    db = get_db()
    attempts = list(db.quiz_attempts.find({'user_id': request.user_id}).sort('timestamp', -1))

    topic_stats = {}
    history = []

    for a in attempts:
        topic = a['topic']
        if topic not in topic_stats:
            topic_stats[topic] = {'total_score': 0, 'count': 0}
        topic_stats[topic]['total_score'] += a['score']
        topic_stats[topic]['count'] += 1

        history.append({
            'topic': topic,
            'score': a['score'],
            'difficulty': a['difficulty'],
            'date': a['timestamp'].strftime('%Y-%m-%d %H:%M')
        })

    topic_accuracy = [
        {'topic': k, 'accuracy': round(v['total_score'] / v['count'], 2)}
        for k, v in topic_stats.items()
    ]

    weakest = [t['topic'] for t in topic_accuracy if t['accuracy'] < 60]

    return jsonify({
        'topic_accuracy': topic_accuracy,
        'history': history,
        'weakest_topics': weakest
    }), 200
