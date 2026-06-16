"""TDD: /api/me endpoint.

Behavior:
  • 401 without auth
  • 200 returns profile + pillar_xp merged into a single response
  • 200 with streak, level, XP
  • PUT /api/me/avatar updates the profile
"""
import os
from unittest.mock import MagicMock, patch

import pytest


def _make_supabase_admin(profile: dict | None, pillar_xp: dict | None):
    """Build a fake admin supabase client.

    `profile` and `pillar_xp` are dicts that will be returned by the
    corresponding .select(...).single().execute() chain.
    """
    client = MagicMock()
    profile_resp = MagicMock(); profile_resp.data = profile
    pillar_resp = MagicMock(); pillar_resp.data = pillar_xp
    # .table('profiles').select('*').eq('id', ...).single().execute() → profile_resp
    # .table('pillar_xp').select('*').eq('user_id', ...).single().execute() → pillar_resp
    client.table.return_value.select.return_value.eq.return_value.single.return_value.execute.side_effect = [
        profile_resp, pillar_resp,
    ]
    return client


class TestGetMe:
    def test_unauthenticated_returns_401(self, client):
        r = client.get("/api/me")
        assert r.status_code == 401

    def test_returns_profile_with_pillar_xp_merged(self, client, auth_headers, sample_profile, sample_pillar_xp):
        admin = _make_supabase_admin(sample_profile, sample_pillar_xp)
        with patch("app.api.me.get_supabase_admin", return_value=admin):
            r = client.get("/api/me", headers=auth_headers)
        assert r.status_code == 200
        body = r.json()
        assert body["id"] == sample_profile["id"]
        assert body["name"] == sample_profile["name"]
        assert body["fairy"] == sample_profile["fairy"]
        assert body["level"] == sample_profile["level"]
        assert body["total_xp"] == sample_profile["total_xp"]
        assert body["current_streak"] == sample_profile["current_streak"]
        assert body["pillar_xp"] == sample_pillar_xp

    def test_xp_to_next_level_is_remainder(self, client, auth_headers, sample_profile, sample_pillar_xp):
        # total_xp = 4200 → 4200 % 1000 = 200 → xp_to_next = 800
        sample_profile["total_xp"] = 4200
        admin = _make_supabase_admin(sample_profile, sample_pillar_xp)
        with patch("app.api.me.get_supabase_admin", return_value=admin):
            r = client.get("/api/me", headers=auth_headers)
        assert r.json()["xp_to_next_level"] == 800

    def test_pillar_xp_defaults_to_zero_when_row_missing(self, client, auth_headers, sample_profile):
        admin = _make_supabase_admin(sample_profile, None)
        with patch("app.api.me.get_supabase_admin", return_value=admin):
            r = client.get("/api/me", headers=auth_headers)
        assert r.status_code == 200
        body = r.json()
        assert all(v == 0 for v in body["pillar_xp"].values())

    def test_returns_404_when_profile_missing(self, client, auth_headers):
        admin = _make_supabase_admin(None, None)
        with patch("app.api.me.get_supabase_admin", return_value=admin):
            r = client.get("/api/me", headers=auth_headers)
        assert r.status_code == 404

    def test_returns_503_when_db_not_configured(self, client, auth_headers):
        with patch("app.api.me.get_supabase_admin", return_value=None):
            r = client.get("/api/me", headers=auth_headers)
        assert r.status_code == 503


class TestUpdateAvatar:
    def test_unauthenticated_returns_401(self, client):
        r = client.put("/api/me/avatar", json={"name": "New"})
        assert r.status_code == 401

    def test_updates_and_returns_profile(self, client, auth_headers, sample_profile, sample_pillar_xp):
        admin = _make_supabase_admin(sample_profile, sample_pillar_xp)
        # The .update(...).eq(...).execute() returns something; we just need it to not error
        with patch("app.api.me.get_supabase_admin", return_value=admin):
            r = client.put(
                "/api/me/avatar",
                headers=auth_headers,
                json={"name": "Renamed", "fairy": "stella"},
            )
        assert r.status_code == 200
        # Pydantic should still echo back the same row
        assert r.json()["name"] == sample_profile["name"]
