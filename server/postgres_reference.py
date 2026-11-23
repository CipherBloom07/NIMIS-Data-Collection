"""Optional PostgreSQL-backed fictional reference adapter.

No browser direct DB connections. Requires isolated development database,
NIMIS_DEMO_MODE=1 and NIMIS_POSTGRES_DEMO_MODE=1. The SQL is parameterized,
scoped to the token's server-known subject, and returns no real scheme data.
"""
from __future__ import annotations

import os
from typing import Any

class DatabaseUnavailable(RuntimeError):
    pass


def enabled() -> bool:
    return (
        os.environ.get("NIMIS_DEMO_MODE") == "1"
        and os.environ.get("NIMIS_POSTGRES_DEMO_MODE") == "1"
        and bool(os.environ.get("NIMIS_COLLECT_DATABASE_URL"))
    )


def _connect():
    if not enabled():
        raise DatabaseUnavailable("PostgreSQL development mode is disabled")
    try:
        import psycopg
    except ImportError as exc:
        raise DatabaseUnavailable("Install server/requirements-postgres.txt to enable PostgreSQL") from exc
    try:
        return psycopg.connect(
            os.environ["NIMIS_COLLECT_DATABASE_URL"],
            connect_timeout=5,
            autocommit=True,
        )
    except Exception as exc:
        # Do not echo connection string, credentials, or host details.
        raise DatabaseUnavailable("Development PostgreSQL connection unavailable") from exc


def get_actor(user_id: str) -> dict[str, Any] | None:
    with _connect() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                """SELECT role_code
                     FROM nimis_collect_demo.officer
                    WHERE officer_id = %s AND active = true""",
                (user_id,),
            )
            officer = cursor.fetchone()
            if officer is None:
                return None
            cursor.execute(
                """SELECT DISTINCT s.scheme_id, s.province_code, s.district_code
                     FROM nimis_collect_demo.assignment a
                     JOIN nimis_collect_demo.scheme s ON s.scheme_id = a.scheme_id
                    WHERE a.officer_id = %s AND a.revoked_at IS NULL
                    ORDER BY s.scheme_id, s.province_code, s.district_code""",
                (user_id,),
            )
            rows = cursor.fetchall()
    return {
        "user_id": user_id,
        "role": str(officer[0]),
        "province_ids": sorted({row[1] for row in rows}),
        "district_ids": sorted({row[2] for row in rows}),
        "scheme_ids": [row[0] for row in rows],
    }


def get_schemes(user_id: str, limit: int = 500, offset: int = 0) -> list[dict[str, Any]]:
    with _connect() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                """SELECT s.scheme_id, s.name, s.province_code, s.district_code,
                          s.master_version, s.is_fictional
                     FROM nimis_collect_demo.scheme s
                     JOIN nimis_collect_demo.assignment a ON a.scheme_id = s.scheme_id
                     JOIN nimis_collect_demo.officer u ON u.officer_id = a.officer_id
                    WHERE a.officer_id = %s
                      AND a.revoked_at IS NULL
                      AND u.active = true
                      AND s.is_fictional = true
                    ORDER BY s.scheme_id
                    LIMIT %s OFFSET %s""",
                (user_id, min(max(limit, 1), 500), max(offset, 0)),
            )
            rows = cursor.fetchall()
    return [
        {
            "scheme_id": row[0],
            "name": row[1],
            "province_code": row[2],
            "district_code": row[3],
            "master_version": row[4],
            "is_fictional": row[5],
        }
        for row in rows
    ]
