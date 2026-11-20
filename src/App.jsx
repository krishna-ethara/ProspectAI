import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowDown, ArrowDownRight, ArrowUpRight, BadgeCheck, Bell, Building2,
  Check, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Clock3, Download,
  ExternalLink, FileSearch, Filter, Globe2, LayoutDashboard, LoaderCircle, Mail,
  MapPin, Menu, MoreHorizontal, Plus, Search, Send, Settings2, Sparkles, Target,
  TrendingUp, Users, X,
} from "lucide-react";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";
const initials = (name = "") => name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
const colors = ["#dbeafe", "#fce7d5", "#e7e4ff", "#d9f3e5", "#f7e1e9", "#dff0f4"];

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed (${response.status})`);
  }
  return response.headers.get("content-type")?.includes("application/json") ? response.json() : response;
}

function App() {
  const [page, setPage] = useState("Overview");
  const [dashboard, setDashboard] = useState(null);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [config, setConfig] = useState({ tavily: false, openai: false });
  const [query, setQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [selected, setSelected] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [researchBusy, setResearchBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [stats, health] = await Promise.all([request("/api/dashboard"), request("/api/health")]);
      setDashboard(stats);
      setConfig(health.configured);
      const params = new URLSearchParams();
      if (query) params.set("search", query);
      if (priorityFilter) params.set("priority", priorityFilter);
      setLeads(await request(`/api/leads?${params}`));
    } catch (reason) {
      setError(reason.message);
    } finally {
      setLoading(false);
    }
  }, [query, priorityFilter]);

  useEffect(() => { refresh(); }, [refresh]);

  const showNotice = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3800);
  };

  const runResearch = async (form) => {
    setResearchBusy(true);
    setError("");
    try {
      const found = await request("/api/research", { method: "POST", body: JSON.stringify(form) });
      setSearchOpen(false);
      await refresh();
      setPage("Prospects");
      showNotice(found.length ? `${found.length} researched ${found.length === 1 ? "prospect" : "prospects"} added` : "No sourced prospects found. Try a broader search.");
    } catch (reason) {
      setError(reason.message);
    } finally {
      setResearchBusy(false);
    }
  };

  const updateStatus = async (lead, status) => {
    try {
      const updated = await request(`/api/leads/${lead.id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      setLeads((current) => current.map((item) => item.id === lead.id ? updated : item));
      setSelected(updated);
      refresh();
      showNotice(`Lead marked ${status.toLowerCase()}`);
    } catch (reason) { setError(reason.message); }
  };

  const saveDraft = async (lead, subject, body) => {
    const updated = await request(`/api/leads/${lead.id}/outreach`, { method: "PUT", body: JSON.stringify({ subject, body }) });
    setSelected(updated);
    setLeads((current) => current.map((item) => item.id === lead.id ? updated : item));
    showNotice("Draft saved for your review");
    return updated;
  };

  const approveDraft = async (lead) => {
    try {
      const updated = await request(`/api/leads/${lead.id}/approve`, { method: "POST" });
      setSelected(updated);
      refresh();
      showNotice("Approved and marked Contacted. Nothing was sent.");
    } catch (reason) { setError(reason.message); }
  };

  const stats = dashboard || { total_researched: 0, qualified_leads: 0, high_priority: 0, average_score: 0, recent_activity: [] };
  const nav = [
    { group: "WORKSPACE", items: [{ title: "Overview", icon: LayoutDashboard }, { title: "Prospects", icon: Users }] },
    { group: "TOOLS", items: [{ title: "Research", icon: FileSearch, action: () => setSearchOpen(true) }, { title: "Outreach", icon: Mail }] },
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark"><Target size={19} strokeWidth={2.2} /></div><span>Prospect<span className="brand-ai">AI</span></span></div>
        <button className="workspace-switch"><span className="workspace-avatar">K</span><span className="workspace-copy"><b>Krishna</b><small>Personal workspace</small></span><ChevronDown size={15} /></button>
        <div className="nav-scroll">
          {nav.map((section) => <div className="nav-section" key={section.group}><div className="nav-label">{section.group}</div>{section.items.map(({ title, icon: Icon, action }) =>
            <button key={title} className={`nav-item ${page === title ? "active" : ""}`} onClick={() => action ? action() : setPage(title)}><Icon size={17} /><span>{title}</span>{title === "Prospects" && leads.length > 0 && <span className="nav-count">{leads.length}</span>}</button>)}</div>)}
        </div>
        <div className="sidebar-bottom">
          <div className={`connection-card ${config.tavily && config.openai ? "connected" : ""}`}><span className="connection-dot" /><div><b>{config.tavily && config.openai ? "Research ready" : "Setup required"}</b><small>{config.tavily && config.openai ? "Search & AI connected" : "Add API keys to begin"}</small></div><Settings2 size={15} /></div>
          <button className="nav-item muted" onClick={() => showNotice("API keys are configured in backend/.env")}><Settings2 size={17} /><span>Settings</span></button>
          <div className="user-profile"><div className="profile-avatar">K</div><div className="profile-copy"><b>Krishna</b><small>Free plan</small></div><MoreHorizontal size={18} /></div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar"><div className="breadcrumb"><span>Workspace</span><ChevronRight size={14} /><b>{page}</b></div><div className="top-actions"><div className="today-date"><span className="live-dot" /> Research workspace</div><button className="icon-btn" aria-label="Notifications" onClick={() => showNotice("You're all caught up")}><Bell size={17} /></button><div className="top-avatar">K</div></div></header>
        <div className="page-content">
          {error && <div className="alert"><CircleHelp size={17} /><span>{error}</span><button aria-label="Dismiss error" onClick={() => setError("")}><X size={16} /></button></div>}
          {page === "Overview" ? <Overview stats={stats} leads={leads} loading={loading} onResearch={() => setSearchOpen(true)} onOpen={(lead) => setSelected(lead)} onViewAll={() => setPage("Prospects")} /> :
            <Prospects leads={leads} loading={loading} query={query} setQuery={setQuery} priority={priorityFilter} setPriority={setPriorityFilter} onResearch={() => setSearchOpen(true)} onOpen={(lead) => setSelected(lead)} onStatus={updateStatus} />}
          <footer className="app-footer"><span>ProspectAI <span className="footer-dot">·</span> Built for better conversations</span><span>Research responsibly <CircleHelp size={13} /></span></footer>
        </div>
      </main>
      {searchOpen && <ResearchModal onClose={() => setSearchOpen(false)} onSubmit={runResearch} busy={researchBusy} />}
      {selected && <LeadDrawer lead={selected} onClose={() => setSelected(null)} onSave={saveDraft} onApprove={approveDraft} onGenerate={async (lead) => {
        const updated = await request(`/api/leads/${lead.id}/outreach`, { method: "POST" });
        setSelected(updated);
        setLeads((current) => current.map((item) => item.id === lead.id ? updated : item));
        showNotice("Personalized draft generated. Review before approval.");
        return updated;
      }} />}
      {notice && <div className="toast"><Check size={16} />{notice}</div>}
    </div>
  );
}

function Overview({ stats, leads, loading, onResearch, onOpen, onViewAll }) {
  const cards = [
    { title: "Businesses researched", value: stats.total_researched, note: "Across your workspace", icon: Building2, accent: "violet", trend: "Your research library" },
    { title: "Qualified leads", value: stats.qualified_leads, note: "Marked as qualified", icon: BadgeCheck, accent: "green", trend: "Ready for next steps" },
    { title: "High priority", value: stats.high_priority, note: "Score of 70 or higher", icon: TrendingUp, accent: "orange", trend: "Strongest-fit prospects" },
    { title: "Average lead score", value: stats.average_score, note: "Out of 100 points", icon: Target, accent: "blue", trend: "Evidence-based scoring" },
  ];
  return <div className="page-enter">
    <div className="welcome-row"><div><div className="eyebrow"><span className="eyebrow-dot" /> YOUR SALES WORKSPACE</div><h1>Good morning, Krishna <span className="wave">✳</span></h1><p className="page-subtitle">Find your next great customer. Start with a little research.</p></div><button className="primary-btn" onClick={onResearch}><Plus size={17} /> Find prospects</button></div>
    <div className="stat-grid">{cards.map(({ title, value, note, icon: Icon, accent, trend }) => <div className="stat-card" key={title}><div className="stat-top"><span>{title}</span><span className={`stat-icon ${accent}`}><Icon size={17} /></span></div><div className="stat-value">{loading ? <span className="skeleton number-skeleton" /> : value}</div><div className="stat-foot"><span>{note}</span><span className="stat-trend"><ArrowUpRight size={13} /> {trend}</span></div></div>)}</div>
    <div className="section-heading"><div><h2>Recent prospects</h2><p>Your latest researched businesses, all in one place.</p></div><button className="text-button" onClick={onViewAll}>View all prospects <ArrowUpRight size={15} /></button></div>
    <div className="table-card"><div className="table-scroll"><table><thead><tr><th>BUSINESS</th><th>INDUSTRY</th><th>LOCATION</th><th>LEAD SCORE</th><th>STATUS</th><th /></tr></thead><tbody>
      {loading ? [1, 2, 3].map((item) => <tr key={item}><td colSpan="6"><span className="skeleton row-skeleton" /></td></tr>) : leads.slice(0, 5).map((lead, index) => <LeadRow key={lead.id} lead={lead} index={index} onClick={() => onOpen(lead)} />)}
      {!loading && leads.length === 0 && <tr><td colSpan="6"><EmptyState onResearch={onResearch} /></td></tr>}
    </tbody></table></div><div className="table-footer"><span>Showing <b>{Math.min(leads.length, 5)}</b> of <b>{leads.length}</b> researched businesses</span><div className="pagination"><button disabled><ChevronLeft size={15} /></button><button className="current-page">1</button><button disabled><ChevronRight size={15} /></button></div></div></div>
    <div className="insight-banner"><div className="insight-icon"><Sparkles size={18} /></div><div><b>Better research. More relevant conversations.</b><p>Every lead comes with source links, a transparent score, and AI-assisted notes for your review.</p></div><button className="insight-link" onClick={onResearch}>Research a business <ArrowUpRight size={15} /></button></div>
  </div>;
}

function Prospects({ leads, loading, query, setQuery, priority, setPriority, onResearch, onOpen, onStatus }) {
  return <div className="page-enter"><div className="welcome-row prospects-heading"><div><div className="eyebrow"><span className="eyebrow-dot" /> LEAD MANAGEMENT</div><h1>Your prospects</h1><p className="page-subtitle">A considered list of businesses worth getting to know.</p></div><button className="primary-btn" onClick={onResearch}><Plus size={17} /> Find prospects</button></div>
    <div className="toolbar"><div className="search-field"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search businesses..." /></div><label className="filter-field"><Filter size={15} /><select value={priority} onChange={(event) => setPriority(event.target.value)}><option value="">All priorities</option><option>High</option><option>Medium</option><option>Low</option></select><ChevronDown size={14} /></label><a className="outline-btn export-btn" href={`${API}/api/leads.csv`}><Download size={15} /> Export CSV</a></div>
    <div className="table-card prospects-table"><div className="table-scroll"><table><thead><tr><th>BUSINESS</th><th>INDUSTRY</th><th>LOCATION</th><th>LEAD SCORE</th><th>STATUS</th><th /></tr></thead><tbody>{loading ? [1, 2, 3].map((item) => <tr key={item}><td colSpan="6"><span className="skeleton row-skeleton" /></td></tr>) : leads.map((lead, index) => <LeadRow key={lead.id} lead={lead} index={index} onClick={() => onOpen(lead)} onStatus={onStatus} />)}{!loading && leads.length === 0 && <tr><td colSpan="6"><EmptyState onResearch={onResearch} /></td></tr>}</tbody></table></div><div className="table-footer"><span>{leads.length} {leads.length === 1 ? "prospect" : "prospects"}</span><div className="pagination"><button disabled><ChevronLeft size={15} /></button><button className="current-page">1</button><button disabled><ChevronRight size={15} /></button></div></div></div>
  </div>;
}

function LeadRow({ lead, index, onClick, onStatus }) {
  return <tr className="lead-row" onClick={onClick}><td><div className="company-cell"><div className="company-avatar" style={{ background: colors[index % colors.length] }}>{initials(lead.name)}</div><div className="company-name"><b>{lead.name}</b><small>{lead.website ? new URL(lead.website).hostname.replace(/^www\./, "") : "Website not available"}</small></div></div></td><td><span className="industry-tag">{lead.industry || "Not identified"}</span></td><td><span className="location-cell"><MapPin size={13} />{lead.location || "Not identified"}</span></td><td><div className="score-cell"><div className="score-track"><span className={`score-fill ${lead.priority.toLowerCase()}`} style={{ width: `${lead.score}%` }} /></div><b>{lead.score}</b><span className={`priority-pill ${lead.priority.toLowerCase()}`}>{lead.priority}</span></div></td><td onClick={(event) => event.stopPropagation()}>{onStatus ? <select className={`status-select ${lead.status.toLowerCase()}`} value={lead.status} onChange={(event) => onStatus(lead, event.target.value)}><option>New</option><option>Contacted</option><option>Qualified</option><option>Disqualified</option></select> : <StatusPill status={lead.status} />}</td><td><button className="row-arrow" aria-label={`View ${lead.name}`}><ArrowUpRight size={16} /></button></td></tr>;
}

function StatusPill({ status }) {
  return <span className={`status-pill ${status.toLowerCase()}`}><span />{status}</span>;
}

function EmptyState({ onResearch }) {
  return <div className="empty-state"><div className="empty-icon"><FileSearch size={22} /></div><b>No prospects yet</b><span>Search public web sources to find and evaluate potential customers.</span><button className="outline-btn" onClick={onResearch}><Plus size={15} /> Start researching</button></div>;
}

function ResearchModal({ onClose, onSubmit, busy }) {
  const [form, setForm] = useState({ industry: "", location: "", keywords: "", offering: "", max_results: 5 });
  const [localError, setLocalError] = useState("");
  const change = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const submit = (event) => {
    event.preventDefault();
    if (form.industry.trim().length < 2 || form.location.trim().length < 2 || form.offering.trim().length < 3) {
      setLocalError("Add an industry, location, and the service you offer to get relevant results.");
      return;
    }
    setLocalError("");
    onSubmit({ ...form, max_results: Number(form.max_results) });
  };
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !busy && onClose()}><section className="research-modal"><div className="modal-top"><div className="modal-icon"><FileSearch size={20} /></div><button className="icon-btn" onClick={onClose} disabled={busy}><X size={18} /></button></div><div className="modal-title"><div className="eyebrow"><span className="eyebrow-dot" /> NEW RESEARCH</div><h2>Who are you looking for?</h2><p>We’ll search public sources and build a sourced, evidence-based prospect brief.</p></div>
    <form onSubmit={submit}><div className="form-grid"><label>Industry <span>*</span><input value={form.industry} onChange={change("industry")} placeholder="e.g. Healthcare technology" maxLength="100" required /></label><label>Location <span>*</span><input value={form.location} onChange={change("location")} placeholder="e.g. Austin, Texas" maxLength="100" required /></label><label className="wide-field">What service do you offer? <span>*</span><input value={form.offering} onChange={change("offering")} placeholder="e.g. Revenue operations consulting" maxLength="500" required /></label><label className="wide-field">Additional keywords <small>OPTIONAL</small><input value={form.keywords} onChange={change("keywords")} placeholder="e.g. recently funded, growing team" maxLength="300" /></label><label className="wide-field">Number of results<select value={form.max_results} onChange={change("max_results")}><option value="5">5 businesses</option><option value="8">8 businesses</option><option value="10">10 businesses</option></select></label></div>
    {localError && <p className="form-error">{localError}</p>}<div className="modal-note"><Globe2 size={15} /><span>Research uses public web sources. AI findings are hypotheses and include links for your review.</span></div><div className="modal-actions"><button type="button" className="outline-btn" onClick={onClose} disabled={busy}>Cancel</button><button type="submit" className="primary-btn" disabled={busy}>{busy ? <><LoaderCircle className="spin" size={16} /> Researching…</> : <><Sparkles size={16} /> Start research</>}</button></div></form></section></div>;
}

function LeadDrawer({ lead: initialLead, onClose, onSave, onApprove, onGenerate }) {
  const [lead, setLead] = useState(initialLead);
  const [subject, setSubject] = useState(initialLead.outreach_subject || "");
  const [body, setBody] = useState(initialLead.outreach_body || "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    setLead(initialLead);
    setSubject(initialLead.outreach_subject || "");
    setBody(initialLead.outreach_body || "");
  }, [initialLead.id]);
  const doGenerate = async () => {
    setBusy(true); setMessage("");
    try { const updated = await onGenerate(lead); setLead(updated); setSubject(updated.outreach_subject || ""); setBody(updated.outreach_body || ""); }
    catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  };
  const doSave = async () => {
    setBusy(true); setMessage("");
    try { setLead(await onSave(lead, subject, body)); }
    catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  };
  const doApprove = async () => {
    setBusy(true); setMessage("");
    try { await onApprove(lead); }
    catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  };
  return <div className="drawer-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><aside className="lead-drawer"><div className="drawer-header"><div className="eyebrow"><span className="eyebrow-dot" /> PROSPECT BRIEF</div><button className="icon-btn" onClick={onClose}><X size={18} /></button></div><div className="drawer-scroll"><div className="drawer-company"><div className="drawer-company-avatar">{initials(lead.name)}</div><div><h2>{lead.name}</h2><div className="drawer-subtitle">{lead.industry || "Industry not identified"} <span>·</span> {lead.location || "Location not identified"}</div></div></div>{lead.website && <a className="website-link" href={lead.website} target="_blank" rel="noreferrer"><Globe2 size={15} />{new URL(lead.website).hostname.replace(/^www\./, "")}<ExternalLink size={13} /></a>}
      <div className="score-summary"><div className="score-big"><span>{lead.score}</span><small>/ 100</small></div><div><span className={`priority-pill ${lead.priority.toLowerCase()}`}>{lead.priority} priority</span><p>{lead.rationale}</p></div></div>
      {lead.description && <section className="detail-section"><h3>Company snapshot</h3><p className="detail-copy">{lead.description}</p></section>}
      <section className="detail-section"><h3>Potential challenges</h3><ul className="insight-list">{lead.challenges.length ? lead.challenges.map((item, index) => <li key={index}><span className="list-marker amber"><ArrowDownRight size={13} /></span>{item}</li>) : <li className="muted-copy">No challenges identified in the available sources.</li>}</ul></section>
      <section className="detail-section"><h3>Potential opportunities</h3><ul className="insight-list">{lead.opportunities.length ? lead.opportunities.map((item, index) => <li key={index}><span className="list-marker green"><ArrowUpRight size={13} /></span>{item}</li>) : <li className="muted-copy">No opportunities identified in the available sources.</li>}</ul></section>
      <section className="detail-section"><div className="section-title-row"><h3>Research sources</h3><span className="source-count">{lead.sources.length} sources</span></div><div className="sources-list">{lead.sources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="source-card"><span className="source-icon"><Globe2 size={15} /></span><span className="source-text"><b>{source.title || source.url}</b><small>{source.url}</small><span>{source.evidence}</span></span><ExternalLink size={14} /></a>)}</div></section>
      <section className="detail-section outreach-section"><div className="section-title-row"><div><h3>Personalized outreach</h3><p>AI-assisted draft. Review and edit before approval.</p></div></div><button className="generate-btn" onClick={doGenerate} disabled={busy}>{busy ? <LoaderCircle className="spin" size={15} /> : <Sparkles size={15} />}{lead.outreach_body ? "Regenerate draft" : "Generate email draft"}</button>{(lead.outreach_body || subject || body) && <div className="draft-editor"><label>Subject<input value={subject} onChange={(event) => setSubject(event.target.value)} maxLength="500" /></label><label>Email body<textarea value={body} onChange={(event) => setBody(event.target.value)} rows="8" maxLength="10000" /></label><button className="outline-btn save-draft" onClick={doSave} disabled={busy}><Check size={14} /> Save draft</button></div>}{message && <div className="inline-error">{message}</div>}<div className="approval-note"><BadgeCheck size={15} /><span>Approval only updates your lead status. ProspectAI does not send emails.</span></div></section>
    </div><div className="drawer-footer"><div><span className="status-pill new"><span />{lead.status}</span><small>Added {new Date(lead.created_at).toLocaleDateString()}</small></div><button className="primary-btn approve-btn" disabled={busy || !lead.outreach_subject || !lead.outreach_body} onClick={doApprove}><Check size={15} /> Approve draft</button></div></aside></div>;
}

export default App;
