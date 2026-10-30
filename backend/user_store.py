"""Local-first account storage with optional MongoDB synchronization."""

from datetime import datetime, timezone

import offline_store
from storage import get_db


def public_user(user):
    if not user:
        return None
    return {
        'id': str(user.get('id') or user.get('_id') or ''),
        'username': user.get('username', ''),
        'name': user.get('name', ''),
        'role': user.get('role', ''),
        'domain': user.get('domain', ''),
        'profile_completed': bool(user.get('role') and user.get('domain')),
    }


def create_user(user):
    offline_store.create_user(user)
    sync_user(user)


def sync_user(user):
    try:
        get_db().users.replace_one(
            {'_id': str(user['id'])}, dict(user, _id=str(user['id'])), upsert=True
        )
    except Exception as exc:
        print(f'MongoDB unavailable; account saved locally ({type(exc).__name__}).')


def find_user(username_key):
    user = offline_store.get_user_by_username(username_key)
    if user:
        return user
    try:
        remote = get_db().users.find_one({'username_key': username_key})
        if remote:
            remote['id'] = str(remote.get('id') or remote.get('_id'))
            remote.pop('_id', None)
            offline_store.create_user(remote)
            return remote
    except Exception as exc:
        print(f'MongoDB unavailable; checking local accounts ({type(exc).__name__}).')
    return None


def get_user(user_id):
    user = offline_store.get_user(user_id)
    if user:
        return user
    try:
        remote = get_db().users.find_one({'_id': str(user_id)})
        if remote:
            remote['id'] = str(remote.get('id') or remote['_id'])
            remote.pop('_id', None)
            offline_store.create_user(remote)
            return remote
    except Exception as exc:
        print(f'MongoDB unavailable; checking local account ({type(exc).__name__}).')
    return None


def update_user_profile(user_id, role, domain):
    user = get_user(user_id)
    if not user:
        return None
    user['role'] = role
    user['domain'] = domain
    user['updated_at'] = datetime.now(timezone.utc).isoformat()
    offline_store.update_user(user)
    try:
        get_db().users.update_one(
            {'_id': str(user_id)},
            {'$set': {'role': role, 'domain': domain, 'updated_at': user['updated_at']}}
        )
    except Exception as exc:
        print(f'MongoDB unavailable; profile saved locally ({type(exc).__name__}).')
    return user
