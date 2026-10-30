"""MongoDB connection, indexes, and one-time import of legacy quiz scores."""

import json
import os
import time
from datetime import datetime, timezone

from pymongo import ASCENDING, DESCENDING, MongoClient

from config import Config


mongo_client = None
database = None
_initialized = False
_last_failure = 0.0


def get_db():
    """Check connectivity once per process, then ensure indexes and return DB."""
    global _initialized, _last_failure, mongo_client, database
    if not _initialized:
        if time.monotonic() - _last_failure < 15:
            raise ConnectionError('MongoDB is still in its reconnect cooldown.')
        try:
            if mongo_client is None:
                mongo_client = MongoClient(
                    Config.MONGO_URI,
                    appname='MajorProjectBackend',
                    connectTimeoutMS=5000,
                    serverSelectionTimeoutMS=5000,
                    socketTimeoutMS=10000,
                    retryWrites=True,
                )
                database = mongo_client.get_database()
            mongo_client.admin.command('ping')
            database.users.create_index([('email', ASCENDING)])
            database.users.create_index([('username_key', ASCENDING)], unique=True, sparse=True)
            database.documents.create_index([('user_id', ASCENDING), ('upload_date', DESCENDING)])
            database.quiz_scores.create_index([('user_id', ASCENDING), ('timestamp', DESCENDING)])
            database.quiz_scores.create_index([('legacy_id', ASCENDING)], unique=True, sparse=True)
            database.quiz_attempts.create_index([('user_id', ASCENDING), ('timestamp', DESCENDING)])
            database.activity_log.create_index([('user_id', ASCENDING), ('timestamp', DESCENDING)])
            database.xapi_statements.create_index([('id', ASCENDING)], unique=True)
            database.xapi_statements.create_index([('actor.account.name', ASCENDING), ('timestamp', DESCENDING)])
            database.xapi_statements.create_index([('verb.id', ASCENDING), ('timestamp', DESCENDING)])
            database.chat_messages.create_index([('user_id', ASCENDING), ('timestamp', DESCENDING)])
            _import_legacy_scores()
            _initialized = True
        except Exception:
            if mongo_client is not None:
                mongo_client.close()
            mongo_client = None
            database = None
            _last_failure = time.monotonic()
            raise
    return database


def _import_legacy_scores():
    """Preserve scores from the old local JSON store without importing twice."""
    legacy_path = os.path.join(Config.BASE_DIR, 'data', 'quiz_scores.json')
    if not os.path.isfile(legacy_path):
        return
    try:
        with open(legacy_path, 'r', encoding='utf-8') as source:
            records = json.load(source)
    except (OSError, json.JSONDecodeError) as exc:
        print(f'Legacy score import skipped: {exc}')
        return
    if not isinstance(records, list):
        return

    for record in records:
        if not isinstance(record, dict):
            continue
        old_id = str(record.get('_id') or '')
        if not old_id:
            continue
        record = dict(record)
        record['legacy_id'] = old_id
        record['_id'] = f'legacy-score-{old_id}'
        record['user_id'] = str(record.get('user_id') or 'dev_user_123')
        record.setdefault('timestamp', datetime.now(timezone.utc))
        try:
            database.quiz_scores.update_one(
                {'legacy_id': old_id},
                {'$setOnInsert': record},
                upsert=True
            )
        except Exception as exc:
            print(f'Legacy score import item skipped: {exc}')
