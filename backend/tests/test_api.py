import os

os.environ["DATABASE_URL"] = "sqlite://"

from fastapi.testclient import TestClient

from backend import main


def test_health_reports_missing_integrations():
    os.environ.pop("TAVILY_API_KEY", None)
    os.environ.pop("OPENAI_API_KEY", None)
    with TestClient(main.app) as client:
        response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["configured"] == {"tavily": False, "openai": False}


def test_search_rejects_incomplete_inputs():
    with TestClient(main.app) as client:
        response = client.post("/api/research", json={"industry": "A", "location": "NY"})
    assert response.status_code == 422


def test_search_reports_missing_credentials():
    os.environ.pop("TAVILY_API_KEY", None)
    with TestClient(main.app) as client:
        response = client.post(
            "/api/research",
            json={"industry": "SaaS", "location": "Austin, TX", "offering": "Revenue operations consulting"},
        )
    assert response.status_code == 503
    assert "TAVILY_API_KEY" in response.json()["detail"]


def test_priority_thresholds():
    assert main.priority_for(70) == "High"
    assert main.priority_for(40) == "Medium"
    assert main.priority_for(39) == "Low"


def test_approval_requires_saved_draft():
    with TestClient(main.app) as client:
        lead = main.Lead(
            name="Acme", rationale="Evidence-based fit", score=75, priority="High",
            challenges="[]", opportunities="[]", sources="[]",
        )
        with main.SessionLocal() as db:
            db.add(lead)
            db.commit()
            lead_id = lead.id
        response = client.post(f"/api/leads/{lead_id}/approve")
    assert response.status_code == 409


def test_web_search_failure_does_not_expose_provider_error(monkeypatch):
    class BrokenSearch:
        def __init__(self, api_key):
            pass

        def search(self, **kwargs):
            raise RuntimeError("private provider error text")

    monkeypatch.setenv("TAVILY_API_KEY", "test-key")
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.setattr(main, "TavilyClient", BrokenSearch)
    with TestClient(main.app) as client:
        response = client.post(
            "/api/research",
            json={"industry": "SaaS", "location": "Austin, TX", "offering": "Revenue operations consulting"},
        )
    assert response.status_code == 502
    assert "private provider error text" not in response.json()["detail"]
    assert "Web research request failed" in response.json()["detail"]


def test_provider_rate_limit_is_reported_without_raw_error_text():
    class RateLimitFailure(Exception):
        status_code = 429

    failure = main.provider_http_exception(
        "AI analysis",
        "OPENAI_API_KEY",
        RateLimitFailure("private provider error text"),
    )
    assert failure.status_code == 429
    assert "rate limit or quota" in failure.detail
    assert "private provider error text" not in failure.detail
