"""Small SQLite cache so study content and learning records remain usable offline."""

import json
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from datetime import datetime, timezone


DB_PATH = Path(__file__).parent / 'data' / 'offline_learning.sqlite3'


def _connect():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DB_PATH, timeout=10)
    connection.row_factory = sqlite3.Row
    connection.execute('PRAGMA journal_mode=WAL')
    connection.execute('PRAGMA busy_timeout=10000')
    connection.executescript('''
        CREATE TABLE IF NOT EXISTS documents (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            upload_date TEXT NOT NULL,
            payload TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_documents_user_date ON documents(user_id, upload_date DESC);
        CREATE TABLE IF NOT EXISTS quiz_scores (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            payload TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_scores_user_time ON quiz_scores(user_id, timestamp DESC);
        CREATE TABLE IF NOT EXISTS xapi_statements (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            payload TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_xapi_user_time ON xapi_statements(user_id, timestamp DESC);
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username_key TEXT NOT NULL UNIQUE,
            created_at TEXT NOT NULL,
            payload TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS chat_messages (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            payload TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_chat_user_time ON chat_messages(user_id, timestamp DESC);
    ''')
    return connection


@contextmanager
def _connection():
    connection = _connect()
    try:
        with connection:
            yield connection
    finally:
        connection.close()


def _save(table, record_id, user_id, timestamp, payload):
    serialized = json.dumps(payload, ensure_ascii=False, separators=(',', ':'))
    with _connection() as connection:
        connection.execute(
            f'INSERT INTO {table}(id,user_id,upload_date,payload) VALUES(?,?,?,?) '
            'ON CONFLICT(id) DO UPDATE SET user_id=excluded.user_id, upload_date=excluded.upload_date, payload=excluded.payload'
            if table == 'documents' else
            f'INSERT INTO {table}(id,user_id,timestamp,payload) VALUES(?,?,?,?) '
            'ON CONFLICT(id) DO UPDATE SET user_id=excluded.user_id, timestamp=excluded.timestamp, payload=excluded.payload',
            (str(record_id), str(user_id), str(timestamp), serialized)
        )


def save_document(document):
    _save('documents', document['_id'], document['user_id'], document.get('upload_date', ''), document)


def get_document(document_id, user_id):
    with _connection() as connection:
        row = connection.execute(
            'SELECT payload FROM documents WHERE id=? AND user_id=?',
            (str(document_id), str(user_id))
        ).fetchone()
    return json.loads(row['payload']) if row else None


def list_documents(user_id, limit=100):
    with _connection() as connection:
        rows = connection.execute(
            'SELECT payload FROM documents WHERE user_id=? ORDER BY upload_date DESC LIMIT ?',
            (str(user_id), int(limit))
        ).fetchall()
    return [json.loads(row['payload']) for row in rows]


def update_document(document):
    save_document(document)


def save_score(score):
    _save('quiz_scores', score['_id'], score['user_id'], score.get('timestamp', ''), score)


def list_scores(user_id, limit=500):
    _import_legacy_scores()
    with _connection() as connection:
        rows = connection.execute(
            'SELECT payload FROM quiz_scores WHERE user_id=? ORDER BY timestamp DESC LIMIT ?',
            (str(user_id), int(limit))
        ).fetchall()
    return [json.loads(row['payload']) for row in rows]


def _import_legacy_scores():
    """Copy the old JSON score history into SQLite once, using stable IDs."""
    legacy_path = Path(__file__).parent / 'data' / 'quiz_scores.json'
    if not legacy_path.is_file():
        return
    try:
        records = json.loads(legacy_path.read_text(encoding='utf-8'))
    except (OSError, json.JSONDecodeError):
        return
    if not isinstance(records, list):
        return
    with _connection() as connection:
        for score in records:
            if not isinstance(score, dict) or not score.get('_id'):
                continue
            item = dict(score)
            old_id = str(item['_id'])
            item['_id'] = f'legacy-score-{old_id}'
            item['user_id'] = str(item.get('user_id') or 'dev_user_123')
            item['timestamp'] = str(item.get('timestamp') or item.get('date') or datetime.now(timezone.utc).isoformat())
            connection.execute(
                'INSERT OR IGNORE INTO quiz_scores(id,user_id,timestamp,payload) VALUES(?,?,?,?)',
                (item['_id'], item['user_id'], item['timestamp'], json.dumps(item, ensure_ascii=False, separators=(',', ':')))
            )


def save_xapi_statement(statement):
    _save(
        'xapi_statements', statement['id'], statement['actor']['account']['name'],
        statement['timestamp'], statement
    )


def list_xapi_statements(user_id, limit=100):
    with _connection() as connection:
        rows = connection.execute(
            'SELECT payload FROM xapi_statements WHERE user_id=? ORDER BY timestamp DESC LIMIT ?',
            (str(user_id), int(limit))
        ).fetchall()
    return [json.loads(row['payload']) for row in rows]


def counts(user_id):
    with _connection() as connection:
        documents = connection.execute('SELECT COUNT(*) AS n FROM documents WHERE user_id=?', (str(user_id),)).fetchone()['n']
        scores = connection.execute('SELECT COUNT(*) AS n FROM quiz_scores WHERE user_id=?', (str(user_id),)).fetchone()['n']
        statements = connection.execute('SELECT COUNT(*) AS n FROM xapi_statements WHERE user_id=?', (str(user_id),)).fetchone()['n']
        chat_messages = connection.execute('SELECT COUNT(*) AS n FROM chat_messages WHERE user_id=?', (str(user_id),)).fetchone()['n']
    return {'documents': documents, 'quiz_scores': scores, 'xapi_statements': statements, 'chat_messages': chat_messages}


def create_user(user):
    serialized = json.dumps(user, ensure_ascii=False, separators=(',', ':'))
    with _connection() as connection:
        connection.execute(
            'INSERT INTO users(id,username_key,created_at,payload) VALUES(?,?,?,?)',
            (str(user['id']), str(user['username_key']), str(user['created_at']), serialized)
        )


def get_user_by_username(username_key):
    with _connection() as connection:
        row = connection.execute('SELECT payload FROM users WHERE username_key=?', (str(username_key),)).fetchone()
    return json.loads(row['payload']) if row else None


def get_user(user_id):
    with _connection() as connection:
        row = connection.execute('SELECT payload FROM users WHERE id=?', (str(user_id),)).fetchone()
    return json.loads(row['payload']) if row else None


def update_user(user):
    serialized = json.dumps(user, ensure_ascii=False, separators=(',', ':'))
    with _connection() as connection:
        connection.execute(
            'UPDATE users SET payload=? WHERE id=?', (serialized, str(user['id']))
        )


def save_chat_message(message):
    _save('chat_messages', message['id'], message['user_id'], message['timestamp'], message)


def list_chat_messages(user_id, limit=100):
    with _connection() as connection:
        rows = connection.execute(
            'SELECT payload FROM chat_messages WHERE user_id=? ORDER BY timestamp DESC LIMIT ?',
            (str(user_id), int(limit))
        ).fetchall()
    return [json.loads(row['payload']) for row in reversed(rows)]
