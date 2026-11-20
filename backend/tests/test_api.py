import os
import json
from types import SimpleNamespace

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


def test_empty_web_search_returns_empty_list(monkeypatch):
    class EmptySearch:
        def __init__(self, api_key):
            pass

        def search(self, **kwargs):
            return {"results": []}

    monkeypatch.setenv("TAVILY_API_KEY", "test-key")
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.setattr(main, "TavilyClient", EmptySearch)
    with TestClient(main.app) as client:
        response = client.post(
            "/api/research",
            json={"industry": "SaaS", "location": "Austin, TX", "offering": "Revenue operations consulting"},
        )
    assert response.status_code == 200
    assert response.json() == []


def test_web_search_failure_is_reported(monkeypatch):
    class BrokenSearch:
        def __init__(self, api_key):
            pass

        def search(self, **kwargs):
            raise RuntimeError("provider unavailable")

    monkeypatch.setenv("TAVILY_API_KEY", "test-key")
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.setattr(main, "TavilyClient", BrokenSearch)
    with TestClient(main.app) as client:
        response = client.post(
            "/api/research",
            json={"industry": "SaaS", "location": "Austin, TX", "offering": "Revenue operations consulting"},
        )
    assert response.status_code == 502
    assert "Web research failed" in response.json()["detail"]


def test_analysis_keeps_only_real_search_source_urls(monkeypatch):
    class Search:
        def __init__(self, api_key):
            pass

        def search(self, **kwargs):
            return {"results": [{
                "title": "Acme company profile",
                "url": "https://acme.example/about",
                "content": "Acme builds scheduling software for clinics.",
            }]}

    result = {
        "leads": [{
            "name": "Acme",
            "website": "https://acme.example",
            "industry": "Healthcare software",
            "location": None,
            "description": "Builds scheduling software for clinics.",
            "challenges": ["Potential need for clinic workflow integration"],
            "opportunities": ["Explore workflow consulting fit"],
            "rationale": "The source confirms healthcare software; the fit is a hypothesis.",
            "score": 74,
            "source_urls": ["https://acme.example/about", "https://invented.example"],
        }]
    }

    class Analysis:
        def __init__(self, api_key):
            self.chat = SimpleNamespace(
                completions=SimpleNamespace(
                    create=lambda **kwargs: SimpleNamespace(
                        choices=[SimpleNamespace(message=SimpleNamespace(content=json.dumps(result)))]
                    )
                )
            )

    monkeypatch.setenv("TAVILY_API_KEY", "test-key")
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.setattr(main, "TavilyClient", Search)
    monkeypatch.setattr(main, "OpenAI", Analysis)
    with TestClient(main.app) as client:
        response = client.post(
            "/api/research",
            json={"industry": "Healthcare software", "location": "Austin, TX", "offering": "Workflow consulting"},
        )
    assert response.status_code == 200
    lead = response.json()[0]
    assert lead["score"] == 74
    assert lead["priority"] == "High"
    assert [source["url"] for source in lead["sources"]] == ["https://acme.example/about"]
    assert lead["sources"][0]["evidence"] == "Acme builds scheduling software for clinics."


def test_outreach_draft_uses_company_context_and_requires_approval(monkeypatch):
    captured = {}
    with main.SessionLocal() as db:
        lead = main.Lead(
            name="Acme",
            rationale="Relevant company evidence",
            score=70,
            priority="High",
            challenges="[]",
            opportunities=json.dumps(["Explore clinic scheduling workflow"]),
            sources=json.dumps([{"url": "https://acme.example/about", "evidence": "Acme builds scheduling software."}]),
        )
        db.add(lead)
        db.commit()
        lead_id = lead.id

    class Analysis:
        def __init__(self, api_key):
            self.chat = SimpleNamespace(
                completions=SimpleNamespace(
                    create=lambda **kwargs: captured.update(kwargs) or SimpleNamespace(
                        choices=[SimpleNamespace(message=SimpleNamespace(content=json.dumps({
                            "subject": "A thought on clinic scheduling",
                            "body": "Hello Acme, I noticed your clinic scheduling work.",
                        })))]
                    )
                )
            )

    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.setattr(main, "OpenAI", Analysis)
    with TestClient(main.app) as client:
        response = client.post(f"/api/leads/{lead_id}/outreach")
        approval = client.post(f"/api/leads/{lead_id}/approve")
    assert response.status_code == 200
    assert "Acme" in response.json()["outreach_body"]
    assert json.loads(captured["messages"][1]["content"])["company"] == "Acme"
    assert approval.status_code == 200
    assert approval.json()["status"] == "Contacted"
