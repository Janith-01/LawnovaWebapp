import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4


DB_PATH = Path(__file__).resolve().parents[1] / "drafting_history.db"


def _get_connection() -> sqlite3.Connection:
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def init_db() -> None:
    with _get_connection() as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS document_history (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                doc_type TEXT,
                language TEXT,
                prompt TEXT,
                drafted_content TEXT,
                docx_filename TEXT,
                pdf_filename TEXT,
                created_at TEXT
            )
            """
        )
        connection.commit()


def save_document(
    user_id: str,
    doc_type: str | None,
    language: str | None,
    prompt: str,
    drafted_content: str,
    docx_filename: str | None,
    pdf_filename: str | None,
) -> str:
    init_db()
    document_id = str(uuid4())
    created_at = datetime.now(timezone.utc).isoformat()

    with _get_connection() as connection:
        connection.execute(
            """
            INSERT INTO document_history (
                id,
                user_id,
                doc_type,
                language,
                prompt,
                drafted_content,
                docx_filename,
                pdf_filename,
                created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                document_id,
                user_id,
                doc_type,
                language,
                prompt,
                drafted_content,
                docx_filename,
                pdf_filename,
                created_at,
            ),
        )
        connection.commit()

    return document_id


def get_user_history(user_id: str) -> list[dict]:
    init_db()
    with _get_connection() as connection:
        rows = connection.execute(
            """
            SELECT
                id,
                user_id,
                doc_type,
                language,
                prompt,
                docx_filename,
                pdf_filename,
                created_at
            FROM document_history
            WHERE user_id = ?
            ORDER BY datetime(created_at) DESC, created_at DESC
            """,
            (user_id,),
        ).fetchall()

    return [dict(row) for row in rows]


def get_document(document_id: str, user_id: str) -> dict | None:
    init_db()
    with _get_connection() as connection:
        row = connection.execute(
            """
            SELECT
                id,
                user_id,
                doc_type,
                language,
                prompt,
                drafted_content,
                docx_filename,
                pdf_filename,
                created_at
            FROM document_history
            WHERE id = ? AND user_id = ?
            """,
            (document_id, user_id),
        ).fetchone()

    return dict(row) if row else None
