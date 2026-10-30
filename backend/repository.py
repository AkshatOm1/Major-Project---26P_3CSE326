"""Dual MongoDB and local SQLite storage for online sync and offline continuity."""

from datetime import datetime

import offline_store
from storage import get_db


def _normalize(record):
    normalized = dict(record)
    normalized['_id'] = str(normalized.get('_id', ''))
    for field in ('upload_date', 'notes_updated_at', 'timestamp'):
        value = normalized.get(field)
        if isinstance(value, datetime):
            normalized[field] = value.isoformat()
    return normalized


def _mongo_failure(exc):
    print(f'MongoDB unavailable; using local learning store ({type(exc).__name__}).')


def save_document(document):
    document = _normalize(document)
    offline_store.save_document(document)
    try:
        get_db().documents.replace_one(
            {'_id': document['_id'], 'user_id': str(document['user_id'])},
            document,
            upsert=True
        )
        return 'mongodb'
    except Exception as exc:
        _mongo_failure(exc)
        return 'local'


def get_document(document_id, user_id):
    try:
        document = get_db().documents.find_one({
            '_id': str(document_id), 'user_id': str(user_id)
        })
        if document:
            document = _normalize(document)
            offline_store.save_document(document)
            return document
    except Exception as exc:
        _mongo_failure(exc)
    return offline_store.get_document(document_id, user_id)


def list_documents(user_id, limit=100):
    local_records = {item['_id']: item for item in offline_store.list_documents(user_id, limit)}
    records = {}
    try:
        collection = get_db().documents
        cursor = collection.find({'user_id': str(user_id)}).sort('upload_date', -1).limit(limit)
        for item in cursor:
            item = _normalize(item)
            local = local_records.get(item['_id'])
            if local and local.get('notes_updated_at', '') > item.get('notes_updated_at', ''):
                item = local
                collection.replace_one({'_id': item['_id'], 'user_id': str(user_id)}, item, upsert=True)
            offline_store.save_document(item)
            records[item['_id']] = item
        for record_id, item in local_records.items():
            if record_id not in records:
                collection.replace_one({'_id': record_id, 'user_id': str(user_id)}, item, upsert=True)
                records[record_id] = item
    except Exception as exc:
        _mongo_failure(exc)
        records.update(local_records)
    return sorted(records.values(), key=lambda item: item.get('upload_date') or '', reverse=True)[:limit]


def update_document(document):
    document = _normalize(document)
    offline_store.update_document(document)
    try:
        get_db().documents.replace_one(
            {'_id': document['_id'], 'user_id': str(document['user_id'])},
            document,
            upsert=True
        )
        return 'mongodb'
    except Exception as exc:
        _mongo_failure(exc)
        return 'local'


def save_score(score):
    score = _normalize(score)
    offline_store.save_score(score)
    try:
        get_db().quiz_scores.replace_one(
            {'_id': score['_id'], 'user_id': str(score['user_id'])},
            score,
            upsert=True
        )
        return 'mongodb'
    except Exception as exc:
        _mongo_failure(exc)
        return 'local'


def list_scores(user_id, limit=500):
    local_records = {item['_id']: item for item in offline_store.list_scores(user_id, limit)}
    records = {}
    try:
        collection = get_db().quiz_scores
        cursor = collection.find({'user_id': str(user_id)}).sort('timestamp', -1).limit(limit)
        for item in cursor:
            item = _normalize(item)
            offline_store.save_score(item)
            records[item['_id']] = item
        for record_id, item in local_records.items():
            if record_id not in records:
                collection.replace_one({'_id': record_id, 'user_id': str(user_id)}, item, upsert=True)
                records[record_id] = item
    except Exception as exc:
        _mongo_failure(exc)
        records.update(local_records)
    return sorted(records.values(), key=lambda item: item.get('timestamp') or item.get('date') or '', reverse=True)[:limit]


def save_xapi_statement(statement):
    offline_store.save_xapi_statement(statement)
    try:
        get_db().xapi_statements.replace_one({'id': statement['id']}, statement, upsert=True)
        return 'mongodb'
    except Exception as exc:
        _mongo_failure(exc)
        return 'local'


def list_xapi_statements(user_id, limit=100):
    local_records = {item['id']: item for item in offline_store.list_xapi_statements(user_id, limit)}
    records = {}
    try:
        collection = get_db().xapi_statements
        cursor = collection.find(
            {'actor.account.name': str(user_id)}
        ).sort('timestamp', -1).limit(limit)
        for item in cursor:
            item.pop('_id', None)
            offline_store.save_xapi_statement(item)
            records[item['id']] = item
        for statement_id, item in local_records.items():
            if statement_id not in records:
                collection.replace_one({'id': statement_id}, item, upsert=True)
                records[statement_id] = item
    except Exception as exc:
        _mongo_failure(exc)
        records.update(local_records)
    return sorted(records.values(), key=lambda item: item.get('timestamp', ''), reverse=True)[:limit]


def save_chat_message(message):
    offline_store.save_chat_message(message)
    try:
        get_db().chat_messages.replace_one({'id': message['id']}, message, upsert=True)
        return 'mongodb'
    except Exception as exc:
        _mongo_failure(exc)
        return 'local'


def list_chat_messages(user_id, limit=100):
    local_records = {item['id']: item for item in offline_store.list_chat_messages(user_id, limit)}
    records = {}
    try:
        collection = get_db().chat_messages
        cursor = collection.find({'user_id': str(user_id)}).sort('timestamp', -1).limit(limit)
        for item in cursor:
            item.pop('_id', None)
            records[item['id']] = item
            offline_store.save_chat_message(item)
        for message_id, item in local_records.items():
            if message_id not in records:
                collection.replace_one({'id': message_id}, item, upsert=True)
                records[message_id] = item
    except Exception as exc:
        _mongo_failure(exc)
        records.update(local_records)
    return sorted(records.values(), key=lambda item: item.get('timestamp', ''))[-limit:]


def status(user_id):
    local_counts = offline_store.counts(user_id)
    try:
        db = get_db()
        remote_counts = {
            'documents': db.documents.count_documents({'user_id': str(user_id)}),
            'quiz_scores': db.quiz_scores.count_documents({'user_id': str(user_id)}),
            'xapi_statements': db.xapi_statements.count_documents({'actor.account.name': str(user_id)}),
            'chat_messages': db.chat_messages.count_documents({'user_id': str(user_id)})
        }
        return {'status': 'connected', 'database': db.name, 'mongodb': remote_counts, 'local_cache': local_counts}
    except Exception as exc:
        _mongo_failure(exc)
        return {'status': 'offline', 'database': 'local SQLite cache', 'mongodb': 'unavailable', 'local_cache': local_counts}
