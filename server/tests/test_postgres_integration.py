"""Optional real PostgreSQL 16 integration checks.

Only runs when NIMIS_TEST_POSTGRES_URL is set to a dedicated disposable database.
Never supplies production credentials or attaches to a Ministry server.
"""
from pathlib import Path
import os

import pytest

psycopg = pytest.importorskip("psycopg")

def test_real_postgresql_reference_scope(monkeypatch):
    url = os.getenv("NIMIS_TEST_POSTGRES_URL")
    if not url:
        pytest.skip("Isolated PostgreSQL CI connection not configured")

    # Only a dedicated, explicitly named development database is allowed.
    from urllib.parse import urlparse
    dbname = urlparse(url).path.lstrip("/")
    if dbname != "nimis_collect_dev":
        pytest.fail("Refusing integration test against a non-development database")

    sql = Path("server/postgres/001_dev_reference.sql").read_text(encoding="utf-8")
    with psycopg.connect(url, autocommit=True) as conn:
        for statement in sql.split(";"):
            if statement.strip():
                conn.execute(statement)
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM nimis_collect_demo.scheme WHERE is_fictional = true")
            assert cur.fetchone()[0] == 1

    monkeypatch.setenv("NIMIS_DEMO_MODE", "1")
    monkeypatch.setenv("NIMIS_POSTGRES_DEMO_MODE", "1")
    monkeypatch.setenv("NIMIS_COLLECT_DATABASE_URL", url)
    from server.postgres_reference import get_actor, get_schemes
    user_id = "10000000-0000-4000-8000-000000000001"
    actor = get_actor(user_id)
    assert actor is not None
    assert actor["role"] == "field_officer"
    assert actor["scheme_ids"] == ["DEMO-SCHEME-001"]
    result = get_schemes(user_id)
    assert len(result) == 1
    assert result[0]["is_fictional"] is True
    assert get_actor("10000000-0000-4000-8000-000000000099") is None
    assert get_schemes("10000000-0000-4000-8000-000000000099") == []

    # Revocation must immediately hide a previously visible assignment.
    try:
        with psycopg.connect(url) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """UPDATE nimis_collect_demo.assignment
                       SET revoked_at = now()
                     WHERE officer_id = %s AND scheme_id = %s""",
                    (user_id, "DEMO-SCHEME-001"),
                )
        assert get_actor(user_id)["scheme_ids"] == []
        assert get_schemes(user_id) == []
    finally:
        # Keep a persistent developer test database usable after the test.
        with psycopg.connect(url) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """UPDATE nimis_collect_demo.assignment
                       SET revoked_at = NULL
                     WHERE officer_id = %s AND scheme_id = %s""",
                    (user_id, "DEMO-SCHEME-001"),
                )


def test_postgresql_paginates_one_thousand_fictional_schemes(monkeypatch):
    """Exercises real indexed assignment reads at the 1,000-scheme target."""
    url = os.getenv("NIMIS_TEST_POSTGRES_URL")
    if not url:
        pytest.skip("Isolated PostgreSQL CI connection not configured")
    from urllib.parse import urlparse
    if urlparse(url).path.lstrip("/") != "nimis_collect_dev":
        pytest.fail("Refusing performance test on a non-development database")

    user_id = "20000000-0000-4000-8000-000000000001"
    monkeypatch.setenv("NIMIS_DEMO_MODE", "1")
    monkeypatch.setenv("NIMIS_POSTGRES_DEMO_MODE", "1")
    monkeypatch.setenv("NIMIS_COLLECT_DATABASE_URL", url)
    from server.postgres_reference import get_actor, get_schemes
    try:
        with psycopg.connect(url) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """INSERT INTO nimis_collect_demo.officer(officer_id, role_code)
                       VALUES (%s, 'field_officer')
                       ON CONFLICT (officer_id) DO NOTHING""",
                    (user_id,),
                )
                cur.execute(
                    """INSERT INTO nimis_collect_demo.scheme
                       (scheme_id, name, province_code, district_code, master_version, is_fictional)
                       SELECT 'PERF-TEST-' || lpad(gs::text, 5, '0'),
                              'Fictional capacity scheme ' || gs,
                              'DEMO-PROVINCE', 'DEMO-DISTRICT', 1, true
                         FROM generate_series(1, 1000) AS gs
                       ON CONFLICT (scheme_id) DO NOTHING"""
                )
                cur.execute(
                    """INSERT INTO nimis_collect_demo.assignment(officer_id, scheme_id, role_code)
                       SELECT %s, s.scheme_id, 'field_officer'
                       FROM nimis_collect_demo.scheme s
                       WHERE s.scheme_id LIKE 'PERF-TEST-%%'
                       ON CONFLICT (officer_id, scheme_id, role_code) DO NOTHING""",
                    (user_id,),
                )
        actor = get_actor(user_id)
        assert actor is not None
        assert len(actor["scheme_ids"]) == 1000
        results = []
        cursor_value = None
        for _ in range(6):
            page = get_schemes(user_id, limit=200, after=cursor_value)
            results.extend(page[:200])
            if len(page) <= 200:
                break
            cursor_value = page[199]["scheme_id"]
        assert len(results) == 1000
        assert len({s["scheme_id"] for s in results}) == 1000
        assert results == sorted(results, key=lambda row: row["scheme_id"])
    finally:
        # Delete ONLY synthetic benchmark fixtures, never user records.
        with psycopg.connect(url) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "DELETE FROM nimis_collect_demo.assignment WHERE officer_id = %s",
                    (user_id,),
                )
                cur.execute(
                    "DELETE FROM nimis_collect_demo.scheme WHERE scheme_id LIKE 'PERF-TEST-%%'"
                )
                cur.execute(
                    "DELETE FROM nimis_collect_demo.officer WHERE officer_id = %s",
                    (user_id,),
                )
