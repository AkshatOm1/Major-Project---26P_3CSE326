from functools import wraps

import jwt
from flask import jsonify, request

from config import Config
from user_store import get_user


def token_required(function):
    @wraps(function)
    def decorated(*args, **kwargs):
        if request.method == 'OPTIONS':
            return function(*args, **kwargs)
        authorization = request.headers.get('Authorization', '')
        scheme, _, token = authorization.partition(' ')
        if scheme.lower() != 'bearer' or not token:
            return jsonify({'error': 'Sign in to continue.'}), 401
        try:
            payload = jwt.decode(token, Config.JWT_SECRET, algorithms=['HS256'])
            user_id = str(payload.get('user_id') or '')
            if not user_id:
                raise jwt.InvalidTokenError('Missing user id')
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Your session expired. Please sign in again.'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid session. Please sign in again.'}), 401

        user = get_user(user_id)
        if not user:
            return jsonify({'error': 'Account not found. Please sign in again.'}), 401
        request.user_id = user_id
        request.auth_user = user
        return function(*args, **kwargs)

    return decorated
