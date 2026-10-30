from flask import Blueprint, request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
import jwt
import datetime
from db import get_db
from config import Config

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/signup', methods=['POST'])
def signup():
    data = request.get_json() or {}
    name = data.get('name')
    email = data.get('email')
    password = data.get('password')

    if not name or not email or not password:
        return jsonify({'error': 'All fields are required'}), 400

    db = get_db()
    if db.users.find_one({'email': email}):
        return jsonify({'error': 'User already exists'}), 400

    hashed_pw = generate_password_hash(password)
    user_id = db.users.insert_one({
        'name': name,
        'email': email,
        'password_hash': hashed_pw,
        'created_at': datetime.datetime.utcnow()
    }).inserted_id

    token = jwt.encode({
        'user_id': str(user_id),
        'exp': datetime.datetime.utcnow() + datetime.timedelta(days=7)
    }, Config.JWT_SECRET, algorithm="HS256")

    return jsonify({'token': token, 'user': {'id': str(user_id), 'name': name, 'email': email}}), 201

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    email = data.get('email')
    password = data.get('password')

    if not email or not password:
        return jsonify({'error': 'Missing credentials'}), 400

    db = get_db()
    user = db.users.find_one({'email': email})

    if not user or not check_password_hash(user['password_hash'], password):
        return jsonify({'error': 'Invalid email or password'}), 401

    token = jwt.encode({
        'user_id': str(user['_id']),
        'exp': datetime.datetime.utcnow() + datetime.timedelta(days=7)
    }, Config.JWT_SECRET, algorithm="HS256")

    return jsonify({'token': token, 'user': {'id': str(user['_id']), 'name': user['name'], 'email': user['email']}}), 200