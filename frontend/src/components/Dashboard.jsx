import React, { useState, useEffect } from 'react';

export default function Dashboard() {
  const token = localStorage.getItem('access_token');
  if (!token) {
    window.location.href = '/login';
  }

  const apiFetch = async (url, options = {}) => {
    options.headers = options.headers || {};
    options.headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(url, options);
    if (res.status === 401) {
      localStorage.removeItem('access_token');
      window.location.href = '/login';
      throw new Error('Unauthorized');
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'API Request Failed');
    }
    return res.json();
  };

  const [currentUser, setCurrentUser] = useState(null);
  const [projects, setProjects] = useState([]);
  const [cities, setCities] = useState([]);
  const [currentProject, setCurrentProject] = useState(null);
  const [selectedCityId, setSelectedCityId] = useState('');

  const [activeTab, setActiveTab] = useState('UNREVIEWED');
  const [searchQuery, setSearchQuery] = useState('');
  const [minFollowers, setMinFollowers] = useState('1000');
  const [statusFilter, setStatusFilter] = useState('');

  const [leads, setLeads] = useState([]);
  const [selectedLead, setSelectedLead] = useState(null);
  const [selectedLeadIds, setSelectedLeadIds] = useState([]);

  const [tabCounts, setTabCounts] = useState({ UNREVIEWED: 0, KEEP: 0, REVIEW_LATER: 0, REJECT: 0 });
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [activeJob, setActiveJob] = useState(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const [leadNotes, setLeadNotes] = useState([]);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [notesDrawerLead, setNotesDrawerLead] = useState(null);

  const [discoveryModalOpen, setDiscoveryModalOpen] = useState(false);
  const [discoveryQueries, setDiscoveryQueries] = useState(null);
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminForm, setAdminForm] = useState({ email: '', password: '', full_name: '' });

  useEffect(() => {
    async function init() {
      try {
        const u = await apiFetch('/api/auth/me');
        setCurrentUser(u);

        const p = await apiFetch('/api/projects');
        setProjects(p);
        if (p.length > 0) setCurrentProject(p[0]);

        const c = await apiFetch('/api/projects/cities');
        setCities(c);
        if (c.length > 0) setSelectedCityId(c[0].id.toString());
      } catch (e) {
        console.error('Init Error:', e);
      }
    }
    init();
  }, []);

  const loadLeads = async () => {
    if (!currentProject || !selectedCityId) return;
    setLoadingLeads(true);
    try {
      let url = `/api/leads?project_id=${currentProject.id}&city_id=${selectedCityId}&min_followers=${minFollowers}&review_state=${activeTab}`;
      if (searchQuery.trim()) url += `&search=${encodeURIComponent(searchQuery.trim())}`;
      if (statusFilter) url += `&status=${encodeURIComponent(statusFilter)}`;

      const data = await apiFetch(url);
      setLeads(data);
      if (data.length > 0 && !selectedLead) {
        setSelectedLead(data[0]);
      } else if (data.length === 0) {
        setSelectedLead(null);
      }
    } catch (e) {
      console.error('Load Leads Error:', e);
    } finally {
      setLoadingLeads(false);
    }
  };

  const loadTabCounts = async () => {
    if (!currentProject || !selectedCityId) return;
    const states = ['UNREVIEWED', 'KEEP', 'REVIEW_LATER', 'REJECT'];
    const counts = { UNREVIEWED: 0, KEEP: 0, REVIEW_LATER: 0, REJECT: 0 };
    for (const st of states) {
      try {
        const res = await apiFetch(`/api/leads?project_id=${currentProject.id}&city_id=${selectedCityId}&min_followers=${minFollowers}&review_state=${st}`);
        counts[st] = res.length;
      } catch (e) {}
    }
    setTabCounts(counts);
  };

  useEffect(() => {
    loadLeads();
    loadTabCounts();
  }, [currentProject, selectedCityId, activeTab, minFollowers, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => loadLeads(), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (selectedLead) {
      apiFetch(`/api/leads/${selectedLead.id}/notes`)
        .then(n => setLeadNotes(n))
        .catch(() => setLeadNotes([]));
    }
  }, [selectedLead]);

  useEffect(() => {
    let interval;
    if (activeJob && (activeJob.status === 'pending' || activeJob.status === 'running')) {
      interval = setInterval(async () => {
        try {
          const updated = await apiFetch(`/api/leads/jobs/${activeJob.id}`);
          setActiveJob(updated);
          if (updated.status === 'completed' || updated.status === 'failed') {
            clearInterval(interval);
            loadLeads();
            loadTabCounts();
          }
        } catch (e) {}
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [activeJob]);

  const triggerApifyCollection = async () => {
    if (!currentProject || !selectedCityId) return;
    try {
      const res = await apiFetch(`/api/leads/rescrape?project_id=${currentProject.id}&city_id=${selectedCityId}`, {
        method: 'POST',
      });
      setActiveJob(res);
    } catch (e) {
      alert('Failed to start Apify collection: ' + e.message);
    }
  };

  const handleSeedDemoLeads = async () => {
    try {
      await apiFetch('/api/leads/seed-demo', { method: 'POST' });
      loadLeads();
      loadTabCounts();
    } catch (e) {
      alert('Failed to seed target leads: ' + e.message);
    }
  };

  const handleSetReviewState = async (leadId, newState) => {
    try {
      const updated = await apiFetch(`/api/leads/${leadId}/review`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ review_state: newState }),
      });
      loadTabCounts();
      loadLeads();
      if (selectedLead && selectedLead.id === leadId) {
        setSelectedLead(updated);
      }
    } catch (e) {
      alert('Failed to update decision: ' + e.message);
    }
  };

  const openNotesDrawer = async (lead) => {
    setNotesDrawerLead(lead);
    try {
      const notes = await apiFetch(`/api/leads/${lead.id}/notes`);
      setLeadNotes(notes);
    } catch (e) {
      setLeadNotes([]);
    }
  };

  const submitNote = async () => {
    const targetLead = notesDrawerLead || selectedLead;
    if (!newNoteContent.trim() || !targetLead) return;
    try {
      await apiFetch(`/api/leads/${targetLead.id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note_content: newNoteContent.trim() }),
      });
      setNewNoteContent('');
      const notes = await apiFetch(`/api/leads/${targetLead.id}/notes`);
      setLeadNotes(notes);
      loadLeads();
    } catch (e) {
      alert('Failed to save note: ' + e.message);
    }
  };

  const handleExport = async (format) => {
    if (!currentProject) return;
    setIsExporting(true);
    try {
      let url = `/api/leads/export?project_id=${currentProject.id}&format=${format}&review_state=${activeTab}`;
      if (selectedCityId) url += `&city_id=${selectedCityId}`;

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `influencer_leads_${activeTab.toLowerCase()}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (e) {
      alert('Export failed: ' + e.message);
    } finally {
      setIsExporting(false);
      setExportOpen(false);
    }
  };

  const toggleSelectAll = (e) => {
    if (e.target.checked) setSelectedLeadIds(leads.map(l => l.id));
    else setSelectedLeadIds([]);
  };

  const toggleSelectOne = (id) => {
    if (selectedLeadIds.includes(id)) setSelectedLeadIds(selectedLeadIds.filter(i => i !== id));
    else setSelectedLeadIds([...selectedLeadIds, id]);
  };

  const openDiscoveryModal = async () => {
    if (!currentProject || !selectedCityId) return;
    try {
      const data = await apiFetch(`/api/leads/discovery-queries?project_id=${currentProject.id}&city_id=${selectedCityId}`);
      setDiscoveryQueries(data);
      setDiscoveryModalOpen(true);
    } catch (e) {
      alert('Failed to load discovery categories: ' + e.message);
    }
  };

  const openAdminModal = async () => {
    setAdminModalOpen(true);
    try {
      const users = await apiFetch('/api/admin/users');
      setAdminUsers(users);
    } catch (e) {}
  };

  const createTeamUser = async () => {
    if (!adminForm.email || !adminForm.password || !adminForm.full_name) return;
    try {
      await apiFetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...adminForm, role: 'member' }),
      });
      setAdminForm({ email: '', password: '', full_name: '' });
      const users = await apiFetch('/api/admin/users');
      setAdminUsers(users);
    } catch (e) {
      alert('Failed to create user: ' + e.message);
    }
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    window.location.href = '/login';
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-slate-50 font-sans">
      {/* Top Navigation Header */}
      <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0 z-30 shadow-2xs">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200/80 p-1 flex items-center justify-center shadow-xs">
            <img 
              src="/static/logos/protypai-square.png" 
              alt="ProtypAI" 
              className="w-8 h-8 object-contain rounded-lg" 
              onError={(e) => { e.target.src = '/static/logos/protypai-logo.svg'; }}
            />
          </div>
          <div>
            <h1 className="font-extrabold text-lg text-slate-900 tracking-tight flex items-center space-x-2">
              <span>ProtypAI LeadHub</span>
              <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">
                Discovery Engine
              </span>
            </h1>
            <p className="text-[11px] text-slate-500 font-medium">Apify Multi-Source Collection & Human Review Queue</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button 
            onClick={openDiscoveryModal} 
            className="px-3.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold flex items-center space-x-2 transition shadow-2xs"
          >
            <i className="fa-solid fa-layer-group text-indigo-600"></i>
            <span>Discovery Categories</span>
          </button>

          {currentUser?.role === 'admin' && (
            <button 
              onClick={openAdminModal} 
              className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 flex items-center space-x-2 transition shadow-2xs"
            >
              <i className="fa-solid fa-user-shield text-slate-600"></i>
              <span>Admin Panel</span>
            </button>
          )}

          <div className="relative">
            <button className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 flex items-center justify-center transition">
              <i className="fa-solid fa-bell text-xs"></i>
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[9px] font-extrabold flex items-center justify-center">
                3
              </span>
            </button>
          </div>

          <div className="flex items-center space-x-3 bg-slate-100/80 px-3 py-1 rounded-xl border border-slate-200/80">
            <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
              {currentUser?.full_name ? currentUser.full_name.charAt(0).toUpperCase() : 'A'}
            </div>
            <div className="text-left">
              <div className="text-xs font-bold text-slate-900 leading-none">{currentUser?.full_name || 'Admin User'}</div>
              <div className="text-[10px] font-semibold text-slate-500 uppercase leading-none mt-1">{currentUser?.role || 'ADMIN'}</div>
            </div>
            <button onClick={logout} title="Logout" className="text-slate-400 hover:text-red-600 ml-2 transition">
              <i className="fa-solid fa-right-from-bracket text-xs"></i>
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace Layout: 3 Columns */}
      <div className="flex-1 flex overflow-hidden">
        {/* 1. LEFT SIDEBAR */}
        <aside className="w-64 bg-white border-r border-slate-200 flex flex-col justify-between shrink-0 p-4 shadow-2xs overflow-y-auto custom-scrollbar">
          <div className="space-y-5">
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-2 px-1">TARGET PRODUCT</div>
              <div className="space-y-2">
                {projects.map(p => {
                  const isPump = p.slug === 'pumppilot';
                  const isSelected = currentProject?.id === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setCurrentProject(p)}
                      className={`w-full text-left p-3 rounded-xl text-xs font-bold flex items-center justify-between transition border ${
                        isSelected 
                          ? (isPump ? 'bg-amber-600 border-amber-600 text-white shadow-md shadow-amber-600/20' : 'bg-emerald-600 border-emerald-600 text-white shadow-md shadow-emerald-600/20') 
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5 min-w-0">
                        {isPump ? (
                          <div className="w-7 h-7 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0">
                            <i className="fa-solid fa-gas-pump text-xs"></i>
                          </div>
                        ) : (
                          <div className="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0">
                            <img src="/static/logos/pharmaflow-logo.svg" alt="PharmaFlow" className="w-4 h-4 object-contain" onError={(e) => { e.target.style.display='none'; }} />
                          </div>
                        )}
                        <div className="truncate">
                          <div className="font-bold text-xs">{p.name}</div>
                          <div className={`text-[10px] font-normal truncate ${isSelected ? 'text-white/80' : 'text-slate-500'}`}>
                            {isPump ? 'Fuel stations, dealers, fleet' : 'Medical stores, pharmacists'}
                          </div>
                        </div>
                      </div>
                      <i className="fa-solid fa-chevron-right text-[10px] opacity-70 ml-1"></i>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="bg-slate-50/90 p-3.5 rounded-xl border border-slate-200 space-y-1.5">
              <div className="text-xs font-bold text-slate-800 flex items-center justify-between">
                <span>Discovery Philosophy</span>
                <i className="fa-solid fa-lightbulb text-indigo-600"></i>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                {currentProject?.slug === 'pumppilot'
                  ? 'Petrol pump operations, shift automation, tank dips, credit sales, and transport fleet manager software.'
                  : 'Pharmacy ERP sales, medicine distribution, GST billing, and retail chemist shop automation.'}
              </p>
              <a href="#strategy" onClick={(e) => { e.preventDefault(); openDiscoveryModal(); }} className="text-[11px] font-bold text-indigo-600 hover:underline flex items-center space-x-1 pt-1">
                <span>View Strategy</span>
                <i className="fa-solid fa-arrow-right text-[9px]"></i>
              </a>
            </div>

            <nav className="space-y-1 pt-1">
              <a href="#" className="flex items-center space-x-3 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100/80">
                <i className="fa-solid fa-compass text-indigo-600 w-4"></i>
                <span>New Discovery</span>
              </a>
              <a href="#" className="flex items-center space-x-3 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100/60">
                <i className="fa-solid fa-users text-slate-400 w-4"></i>
                <span>Leads</span>
              </a>
              <a href="#" className="flex items-center space-x-3 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100/60">
                <i className="fa-solid fa-bookmark text-slate-400 w-4"></i>
                <span>Saved Searches</span>
              </a>
              <a href="#" className="flex items-center space-x-3 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100/60">
                <i className="fa-solid fa-chart-pie text-slate-400 w-4"></i>
                <span>Analytics</span>
              </a>
            </nav>
          </div>

          {/* Sidebar Footer: Discovery Credits */}
          <div className="bg-indigo-50/70 p-3.5 rounded-xl border border-indigo-100 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-indigo-900">
              <div className="flex items-center space-x-1.5">
                <i className="fa-solid fa-database text-indigo-600 text-xs"></i>
                <span>Discovery Credits</span>
              </div>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-extrabold text-indigo-950">2,450</span>
              <span className="text-[11px] font-bold text-slate-500">/ 5,000</span>
            </div>
            <div className="w-full h-1.5 bg-indigo-200/80 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-600 rounded-full w-[49%]"></div>
            </div>
            <button className="w-full mt-1 py-1.5 bg-white hover:bg-indigo-600 text-indigo-700 hover:text-white border border-indigo-200 rounded-lg text-[11px] font-bold transition flex items-center justify-center space-x-1.5 shadow-2xs">
              <i className="fa-solid fa-leaf text-emerald-600"></i>
              <span>Upgrade Plan</span>
            </button>
          </div>
        </aside>

        {/* 2. MIDDLE WORKSPACE MAIN CONTENT */}
        <main className="flex-1 flex flex-col min-w-0 bg-slate-50 overflow-y-auto custom-scrollbar">
          {/* Top Summary Cards & Global Actions */}
          <div className="p-6 pb-2 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Card 1: Human Review Queue */}
              <div 
                onClick={() => setActiveTab('UNREVIEWED')}
                className={`p-4 rounded-2xl border transition cursor-pointer flex items-center justify-between ${
                  activeTab === 'UNREVIEWED' ? 'bg-indigo-50/80 border-indigo-300 ring-2 ring-indigo-500/20 shadow-sm' : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
                      <i className="fa-solid fa-user-group text-xs"></i>
                    </div>
                    <span className="text-xs font-bold text-slate-700">Human Review Queue</span>
                  </div>
                  <div className="text-2xl font-extrabold text-slate-900 tracking-tight">{tabCounts.UNREVIEWED}</div>
                  <span className="inline-block text-[10px] font-bold text-indigo-700 bg-indigo-100/80 px-2 py-0.5 rounded-md">Needs Review</span>
                </div>
              </div>

              {/* Card 2: Qualified Lead Pool */}
              <div 
                onClick={() => setActiveTab('KEEP')}
                className={`p-4 rounded-2xl border transition cursor-pointer flex items-center justify-between ${
                  activeTab === 'KEEP' ? 'bg-emerald-50/80 border-emerald-300 ring-2 ring-emerald-500/20 shadow-sm' : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                      <i className="fa-solid fa-circle-check text-xs"></i>
                    </div>
                    <span className="text-xs font-bold text-slate-700">Qualified Lead Pool</span>
                  </div>
                  <div className="text-2xl font-extrabold text-slate-900 tracking-tight">{tabCounts.KEEP}</div>
                  <span className="inline-block text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md">
                    + 12% High Potential
                  </span>
                </div>
              </div>

              {/* Card 3: Review Later */}
              <div 
                onClick={() => setActiveTab('REVIEW_LATER')}
                className={`p-4 rounded-2xl border transition cursor-pointer flex items-center justify-between ${
                  activeTab === 'REVIEW_LATER' ? 'bg-amber-50/80 border-amber-300 ring-2 ring-amber-500/20 shadow-sm' : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                      <i className="fa-solid fa-clock text-xs"></i>
                    </div>
                    <span className="text-xs font-bold text-slate-700">Review Later</span>
                  </div>
                  <div className="text-2xl font-extrabold text-slate-900 tracking-tight">{tabCounts.REVIEW_LATER}</div>
                  <span className="inline-block text-[10px] font-bold text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-md">Under Review</span>
                </div>
              </div>

              {/* Card 4: Rejected */}
              <div 
                onClick={() => setActiveTab('REJECT')}
                className={`p-4 rounded-2xl border transition cursor-pointer flex items-center justify-between ${
                  activeTab === 'REJECT' ? 'bg-rose-50/80 border-rose-300 ring-2 ring-rose-500/20 shadow-sm' : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <div className="w-7 h-7 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center">
                      <i className="fa-solid fa-circle-xmark text-xs"></i>
                    </div>
                    <span className="text-xs font-bold text-slate-700">Rejected</span>
                  </div>
                  <div className="text-2xl font-extrabold text-slate-900 tracking-tight">{tabCounts.REJECT}</div>
                  <span className="inline-block text-[10px] font-bold text-rose-700 bg-rose-100/80 px-2 py-0.5 rounded-md">Not Relevant</span>
                </div>
              </div>
            </div>

            {/* Live Apify Job Status Notification Banner */}
            {activeJob && (
              <div className={`p-4 rounded-2xl border flex items-center justify-between shadow-xs transition ${
                activeJob.status === 'pending' || activeJob.status === 'running'
                  ? 'bg-indigo-50 border-indigo-200 text-indigo-900'
                  : activeJob.status === 'completed'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}>
                <div className="flex items-center space-x-3">
                  {activeJob.status === 'pending' || activeJob.status === 'running' ? (
                    <i className="fa-solid fa-circle-notch fa-spin text-indigo-600 text-lg"></i>
                  ) : activeJob.status === 'completed' ? (
                    <i className="fa-solid fa-circle-check text-emerald-600 text-lg"></i>
                  ) : (
                    <i className="fa-solid fa-triangle-exclamation text-rose-600 text-lg"></i>
                  )}
                  <div>
                    <div className="font-extrabold text-xs">
                      {activeJob.status === 'pending' || activeJob.status === 'running'
                        ? `Apify Live Scraping in Progress (Job #${activeJob.id})`
                        : activeJob.status === 'completed'
                        ? `Apify Collection Complete! Discovered ${activeJob.leads_found} target profiles.`
                        : `Apify Scraping Notice: Account usage cap reached on Apify Free tier.`}
                    </div>
                    <div className="text-[11px] opacity-80 mt-0.5">
                      {activeJob.status === 'pending' || activeJob.status === 'running'
                        ? 'Executing Instagram hashtag discovery and profile enrichment actor...'
                        : activeJob.status === 'completed'
                        ? 'All newly collected profiles have been saved to local database and loaded below.'
                        : (activeJob.error_message || 'Apify monthly usage hard limit exceeded. Click "Load Target Leads" to test features with verified demo leads.')}
                    </div>
                  </div>
                </div>

                {activeJob.status === 'failed' && (
                  <button 
                    onClick={handleSeedDemoLeads}
                    className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow-xs transition flex items-center space-x-1.5 shrink-0"
                  >
                    <i className="fa-solid fa-database"></i>
                    <span>Load Target Leads</span>
                  </button>
                )}
              </div>
            )}

            {/* Top Action Row */}
            <div className="flex items-center justify-between bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-extrabold text-slate-900">Queue View:</span>
                <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-lg">
                  {activeTab === 'UNREVIEWED' ? 'Human Review Queue' : activeTab === 'KEEP' ? 'Qualified Lead Pool' : activeTab === 'REVIEW_LATER' ? 'Review Later' : 'Rejected Leads'}
                </span>
              </div>

              <div className="flex items-center space-x-3">
                <button 
                  onClick={triggerApifyCollection} 
                  disabled={activeJob && (activeJob.status === 'pending' || activeJob.status === 'running')}
                  className={`px-4 py-2 text-white font-bold rounded-xl shadow-md text-xs flex items-center space-x-2 transition ${
                    activeJob && (activeJob.status === 'pending' || activeJob.status === 'running')
                      ? 'bg-indigo-400 cursor-not-allowed'
                      : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20'
                  }`}
                >
                  <i className={`fa-solid ${activeJob && (activeJob.status === 'pending' || activeJob.status === 'running') ? 'fa-circle-notch fa-spin' : 'fa-arrows-rotate'}`}></i>
                  <span>{activeJob && (activeJob.status === 'pending' || activeJob.status === 'running') ? 'Scraping Apify...' : 'Run Apify Collection'}</span>
                </button>

                <div className="relative inline-block text-left">
                  <button 
                    onClick={() => setExportOpen(!exportOpen)} 
                    disabled={isExporting}
                    className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-semibold rounded-xl text-xs flex items-center space-x-2 transition shadow-xs"
                  >
                    <i className="fa-solid fa-download"></i>
                    <span>Export Leads</span>
                    <i className="fa-solid fa-chevron-down text-[10px]"></i>
                  </button>
                  {exportOpen && (
                    <div className="absolute right-0 mt-2 w-44 bg-white border border-slate-200 rounded-xl shadow-lg z-20 py-1">
                      <button onClick={() => handleExport('csv')} className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 flex items-center space-x-2 font-semibold">
                        <i className="fa-solid fa-file-csv text-emerald-600 text-sm"></i>
                        <span>Export CSV</span>
                      </button>
                      <button onClick={() => handleExport('xlsx')} className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 flex items-center space-x-2 font-semibold">
                        <i className="fa-solid fa-file-excel text-emerald-700 text-sm"></i>
                        <span>Export Excel (.xlsx)</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Filter Controls Bar */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">SELECT TARGET CITY</label>
                <div className="relative">
                  <select 
                    value={selectedCityId} 
                    onChange={(e) => setSelectedCityId(e.target.value)} 
                    className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs rounded-xl pl-8 pr-3 py-2 focus:outline-none focus:border-indigo-600 font-bold"
                  >
                    {cities.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <i className="fa-solid fa-location-dot absolute left-2.5 top-2.5 text-slate-400 text-xs"></i>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">SEARCH ACCOUNT / BIO</label>
                <div className="relative">
                  <input 
                    type="text" 
                    value={searchQuery} 
                    onChange={(e) => setSearchQuery(e.target.value)} 
                    placeholder="Search name, @username, or keyword..." 
                    className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs rounded-xl pl-8 pr-3 py-2 focus:outline-none focus:border-indigo-600 font-medium" 
                  />
                  <i className="fa-solid fa-magnifying-glass absolute left-2.5 top-2.5 text-slate-400 text-xs"></i>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">MIN FOLLOWERS</label>
                <select 
                  value={minFollowers} 
                  onChange={(e) => setMinFollowers(e.target.value)} 
                  className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-600 font-bold"
                >
                  <option value="0">All Followers</option>
                  <option value="1000">≥ 1,000 Followers</option>
                  <option value="5000">≥ 5,000 Followers</option>
                  <option value="10000">≥ 10,000 Followers</option>
                  <option value="25000">≥ 25,000 Followers</option>
                  <option value="50000">≥ 50,000 Followers</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">OUTREACH STATUS</label>
                <select 
                  value={statusFilter} 
                  onChange={(e) => setStatusFilter(e.target.value)} 
                  className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-600 font-bold"
                >
                  <option value="">All Outreach Statuses</option>
                  <option value="New">New</option>
                  <option value="Contacted">Contacted</option>
                  <option value="In Talks">In Talks</option>
                  <option value="Onboarded">Onboarded</option>
                </select>
              </div>
            </div>
          </div>

          {/* Lead Table */}
          <div className="p-6 pt-2 flex-1">
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100/70 text-[10px] uppercase font-extrabold tracking-wider text-slate-500 border-b border-slate-200">
                      <th className="py-3 px-3 w-10 text-center">
                        <input type="checkbox" onChange={toggleSelectAll} checked={selectedLeadIds.length > 0 && selectedLeadIds.length === leads.length} className="rounded border-slate-300 text-indigo-600" />
                      </th>
                      <th className="py-3 px-4 w-5/12">DISCOVERY MATCH & PROFILE</th>
                      <th className="py-3 px-4 w-2/12">SIGNALS & CITY</th>
                      <th className="py-3 px-4 w-2/12">CONTACT DETAILS</th>
                      <th className="py-3 px-4 text-center w-2/12">HUMAN DECISION</th>
                      <th className="py-3 px-4 text-center w-1/12">NOTES</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {loadingLeads ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-400">
                          <i className="fa-solid fa-circle-notch fa-spin text-2xl mb-2 text-indigo-600"></i>
                          <p className="font-semibold text-slate-600">Loading discovery queue...</p>
                        </td>
                      </tr>
                    ) : leads.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-400">
                          <p className="font-bold text-slate-700 text-sm">No accounts found in this queue state.</p>
                          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                            Click 'Run Apify Collection' above to scrape live Instagram accounts, or click below to populate target leads.
                          </p>
                          <div className="mt-3">
                            <button 
                              onClick={handleSeedDemoLeads}
                              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-md shadow-indigo-600/20 transition inline-flex items-center space-x-2"
                            >
                              <i className="fa-solid fa-database"></i>
                              <span>Load Target Leads Queue</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      leads.map(l => {
                        const isSelectedRow = selectedLead?.id === l.id;
                        return (
                          <tr 
                            key={l.id} 
                            onClick={() => setSelectedLead(l)} 
                            className={`cursor-pointer transition border-b border-slate-100 ${isSelectedRow ? 'bg-amber-50/40 border-amber-200' : 'hover:bg-slate-50/80'}`}
                          >
                            <td className="py-3.5 px-3 text-center align-top pt-4" onClick={(e) => e.stopPropagation()}>
                              <input type="checkbox" checked={selectedLeadIds.includes(l.id)} onChange={() => toggleSelectOne(l.id)} className="rounded border-slate-300 text-indigo-600" />
                            </td>
                            <td className="py-3.5 px-4 align-top">
                              <div className="flex items-start space-x-3">
                                <div className="shrink-0 flex flex-col items-center space-y-1">
                                  <div className="bg-emerald-50 text-emerald-700 border border-emerald-200 font-extrabold px-2 py-0.5 rounded-md text-[11px] shadow-2xs">
                                    {l.discovery_score}
                                  </div>
                                  <span className="text-[9px] text-slate-400 font-bold uppercase">Match</span>
                                </div>
                                <img 
                                  src={l.profile_pic_url ? `/api/leads/proxy-image?url=${encodeURIComponent(l.profile_pic_url)}` : 'https://ui-avatars.com/api/?name=' + encodeURIComponent(l.full_name || l.username) + '&background=6366f1&color=fff&bold=true'} 
                                  referrerPolicy="no-referrer"
                                  onError={(e) => { e.target.src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(l.full_name || l.username) + '&background=6366f1&color=fff&bold=true'; }} 
                                  className="w-10 h-10 rounded-full border border-slate-200 object-cover shadow-2xs shrink-0" 
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="font-bold text-slate-900 text-xs leading-tight flex items-center space-x-1">
                                    <span>{l.full_name || l.username}</span>
                                    <i className="fa-solid fa-circle-check text-indigo-600 text-[11px]"></i>
                                  </div>
                                  <div className="text-[11px] text-indigo-600 font-medium truncate mt-0.5">@{l.username}</div>
                                  <div className="text-[11px] text-slate-500 mt-0.5">
                                    <i className="fa-solid fa-users text-slate-400 mr-1"></i>
                                    <b>{l.follower_count.toLocaleString()}</b> followers
                                  </div>
                                  {l.bio_text && (
                                    <p className="text-[11px] text-slate-600 mt-1 line-clamp-2 leading-normal">{l.bio_text}</p>
                                  )}
                                </div>
                              </div>
                            </td>

                            <td className="py-3.5 px-4 align-top">
                              <div className="space-y-1.5">
                                <div>
                                  <span className="bg-indigo-600 text-white font-bold px-2.5 py-0.5 rounded-md text-[10px] uppercase shadow-2xs">{l.city_name}</span>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {(l.discovery_signals || []).slice(0, 3).map((s, idx) => (
                                    <span key={idx} className="bg-slate-100 text-slate-700 border border-slate-200 px-1.5 py-0.5 rounded text-[10px] font-medium flex items-center">
                                      <i className="fa-solid fa-check text-emerald-600 text-[9px] mr-1"></i>{s}
                                    </span>
                                  ))}
                                  {(l.discovery_signals || []).length > 3 && (
                                    <span className="text-[9px] text-indigo-600 font-bold bg-indigo-50 border border-indigo-200 px-1 py-0.5 rounded">+{(l.discovery_signals || []).length - 3} more</span>
                                  )}
                                </div>
                              </div>
                            </td>

                            <td className="py-3.5 px-4 align-top">
                              <div className="space-y-1.5">
                                {l.public_phone && (
                                  <div className="flex items-center space-x-1.5">
                                    <span className="text-emerald-800 font-semibold text-xs"><i className="fa-solid fa-phone text-emerald-600 mr-1"></i>{l.public_phone}</span>
                                    {l.whatsapp_link && (
                                      <a href={l.whatsapp_link} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="bg-emerald-50 text-emerald-700 border border-emerald-300 px-1.5 py-0.5 rounded text-[10px] font-bold">
                                        WhatsApp
                                      </a>
                                    )}
                                  </div>
                                )}
                                {l.public_email && (
                                  <div>
                                    <a href={`mailto:${l.public_email}`} onClick={(e) => e.stopPropagation()} className="text-indigo-600 hover:underline font-medium text-xs break-all">
                                      <i className="fa-solid fa-envelope text-indigo-500 mr-1"></i>{l.public_email}
                                    </a>
                                  </div>
                                )}
                                {!l.public_phone && !l.public_email && (
                                  <div className="text-slate-500 text-[11px] font-medium bg-slate-100 px-2 py-1 rounded-lg border border-slate-200 inline-flex items-center">
                                    Check Bio / DM
                                  </div>
                                )}
                              </div>
                            </td>

                            <td className="py-3.5 px-4 text-center align-top" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-center space-x-1">
                                <button 
                                  onClick={() => handleSetReviewState(l.id, 'KEEP')} 
                                  className={`px-2.5 py-1 ${l.review_state === 'KEEP' ? 'bg-emerald-600 text-white font-bold shadow-xs' : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'} rounded-lg text-xs transition flex items-center space-x-1`}
                                >
                                  <i className="fa-solid fa-check text-[10px]"></i>
                                  <span>Keep</span>
                                </button>
                                <button 
                                  onClick={() => handleSetReviewState(l.id, 'REVIEW_LATER')} 
                                  className={`px-2.5 py-1 ${l.review_state === 'REVIEW_LATER' ? 'bg-amber-500 text-white font-bold shadow-xs' : 'bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200'} rounded-lg text-xs transition flex items-center space-x-1`}
                                >
                                  <i className="fa-solid fa-clock text-[10px]"></i>
                                  <span>Review</span>
                                </button>
                                <button 
                                  onClick={() => handleSetReviewState(l.id, 'REJECT')} 
                                  className={`px-2.5 py-1 ${l.review_state === 'REJECT' ? 'bg-rose-600 text-white font-bold shadow-xs' : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'} rounded-lg text-xs transition flex items-center space-x-1`}
                                >
                                  <i className="fa-solid fa-xmark text-[10px]"></i>
                                  <span>Reject</span>
                                </button>
                              </div>
                            </td>

                            <td className="py-3.5 px-4 text-center align-top" onClick={(e) => e.stopPropagation()}>
                              <button onClick={() => openNotesDrawer(l)} className="p-1.5 text-slate-500 hover:text-indigo-600 transition">
                                <i className="fa-solid fa-comment-dots text-sm"></i>
                                <span className="text-[10px] block text-slate-400 font-medium">Notes ({l.notes_count})</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </main>

        {/* 3. RIGHT PANEL PROFILE PREVIEW (EXACT MOCKUP MATCH `media_1790390906140.png`) */}
        <aside className="w-80 bg-white border-l border-slate-200 flex flex-col justify-between shrink-0 shadow-2xs overflow-y-auto custom-scrollbar">
          {selectedLead ? (
            <div className="p-4 space-y-4">
              {/* Panel Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-extrabold text-sm text-slate-900">Profile Preview</h3>
                <button onClick={() => setSelectedLead(null)} className="text-slate-400 hover:text-slate-600">
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>

              {/* Cover & Avatar Header */}
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <img 
                    src={selectedLead.profile_pic_url ? `/api/leads/proxy-image?url=${encodeURIComponent(selectedLead.profile_pic_url)}` : 'https://ui-avatars.com/api/?name=' + encodeURIComponent(selectedLead.full_name || selectedLead.username) + '&background=6366f1&color=fff&bold=true'} 
                    referrerPolicy="no-referrer"
                    onError={(e) => { e.target.src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(selectedLead.full_name || selectedLead.username) + '&background=6366f1&color=fff&bold=true'; }} 
                    className="w-14 h-14 rounded-full border-2 border-slate-200 object-cover shadow-sm shrink-0" 
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-extrabold text-slate-900 text-sm flex items-center space-x-1 truncate">
                      <span className="truncate">{selectedLead.full_name || selectedLead.username}</span>
                      <i className="fa-solid fa-circle-check text-indigo-600 text-xs shrink-0"></i>
                    </div>
                    <div className="text-xs text-indigo-600 font-semibold truncate">@{selectedLead.username}</div>
                    <div className="text-[11px] text-slate-500 truncate mt-0.5">{selectedLead.city_name} Local News & Updates</div>
                  </div>
                </div>

                {/* Followers | Following | Posts Stat Bar */}
                <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-xl text-center border border-slate-200/80">
                  <div>
                    <div className="text-xs font-extrabold text-slate-900">{selectedLead.follower_count > 1000 ? (selectedLead.follower_count / 1000).toFixed(1) + 'K' : selectedLead.follower_count}</div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Followers</div>
                  </div>
                  <div className="border-x border-slate-200">
                    <div className="text-xs font-extrabold text-slate-900">{(selectedLead.following_count || 1240).toLocaleString()}</div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Following</div>
                  </div>
                  <div>
                    <div className="text-xs font-extrabold text-slate-900">{(selectedLead.media_count || 3280).toLocaleString()}</div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Posts</div>
                  </div>
                </div>

                {/* Category Badges */}
                <div className="flex flex-wrap gap-1">
                  <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold px-2 py-0.5 rounded-md">News</span>
                  <span className="bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-bold px-2 py-0.5 rounded-md">Local</span>
                  <span className="bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-bold px-2 py-0.5 rounded-md">Business</span>
                  <span className="bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-bold px-2 py-0.5 rounded-md">Education</span>
                  <span className="bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-bold px-2 py-0.5 rounded-md">Community</span>
                </div>

                {/* Bio Description & Meta Links */}
                <div className="space-y-1.5 text-xs text-slate-700 leading-relaxed bg-slate-50/60 p-3 rounded-xl border border-slate-200/60">
                  <p className="font-medium text-[11px]">{selectedLead.bio_text || "Colleges • Students • Education • Jobs • City News • Updates • DM for Promotions • Collabs"}</p>
                  <div className="pt-1 space-y-1 text-[11px] text-slate-500 font-semibold">
                    <div className="flex items-center space-x-1.5">
                      <i className="fa-solid fa-location-dot text-rose-500"></i>
                      <span>{selectedLead.city_name}, Andhra Pradesh</span>
                    </div>
                    {selectedLead.external_url && (
                      <div className="flex items-center space-x-1.5 truncate">
                        <i className="fa-solid fa-link text-indigo-500"></i>
                        <a href={selectedLead.external_url} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline truncate">{selectedLead.external_url}</a>
                      </div>
                    )}
                  </div>
                </div>

                {/* Recent Content Grid (4 Images) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                    <span>Recent Content (4)</span>
                    <a href={`https://instagram.com/${selectedLead.username}`} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline text-[11px]">View All →</a>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    <div className="relative aspect-square bg-slate-800 rounded-lg overflow-hidden group">
                      <img src={selectedLead.profile_pic_url ? `/api/leads/proxy-image?url=${encodeURIComponent(selectedLead.profile_pic_url)}` : 'https://picsum.photos/120'} className="w-full h-full object-cover opacity-90 group-hover:scale-105 transition" />
                      <span className="absolute bottom-1 left-1 text-[9px] font-bold text-white bg-black/60 px-1 py-0.2 rounded flex items-center space-x-0.5">
                        <i className="fa-solid fa-play text-[7px]"></i><span>12.4K</span>
                      </span>
                    </div>
                    <div className="relative aspect-square bg-slate-800 rounded-lg overflow-hidden group">
                      <img src="https://picsum.photos/121" className="w-full h-full object-cover opacity-90 group-hover:scale-105 transition" />
                      <span className="absolute bottom-1 left-1 text-[9px] font-bold text-white bg-black/60 px-1 py-0.2 rounded flex items-center space-x-0.5">
                        <i className="fa-solid fa-play text-[7px]"></i><span>8.1K</span>
                      </span>
                    </div>
                    <div className="relative aspect-square bg-slate-800 rounded-lg overflow-hidden group">
                      <img src="https://picsum.photos/122" className="w-full h-full object-cover opacity-90 group-hover:scale-105 transition" />
                      <span className="absolute bottom-1 left-1 text-[9px] font-bold text-white bg-black/60 px-1 py-0.2 rounded flex items-center space-x-0.5">
                        <i className="fa-solid fa-play text-[7px]"></i><span>6.7K</span>
                      </span>
                    </div>
                    <div className="relative aspect-square bg-slate-800 rounded-lg overflow-hidden group">
                      <img src="https://picsum.photos/123" className="w-full h-full object-cover opacity-90 group-hover:scale-105 transition" />
                      <span className="absolute bottom-1 left-1 text-[9px] font-bold text-white bg-black/60 px-1 py-0.2 rounded flex items-center space-x-0.5">
                        <i className="fa-solid fa-play text-[7px]"></i><span>5.3K</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Discovery Signals */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                    <span>Discovery Signals (6)</span>
                    <span className="text-indigo-600 text-[11px] font-bold">View All →</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center">
                      <i className="fa-solid fa-check mr-1 text-[8px]"></i>#{selectedLead.city_name.toLowerCase()}
                    </span>
                    <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center">
                      <i className="fa-solid fa-check mr-1 text-[8px]"></i>City Match
                    </span>
                    <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center">
                      <i className="fa-solid fa-check mr-1 text-[8px]"></i>Local Page
                    </span>
                    <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center">
                      <i className="fa-solid fa-check mr-1 text-[8px]"></i>Business Content
                    </span>
                    <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center">
                      <i className="fa-solid fa-check mr-1 text-[8px]"></i>News/Media
                    </span>
                    <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center">
                      <i className="fa-solid fa-check mr-1 text-[8px]"></i>Multi-Source Match
                    </span>
                  </div>
                </div>

                {/* Human Review Decision Buttons */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="text-xs font-bold text-slate-800">Human Review</div>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button 
                      onClick={() => handleSetReviewState(selectedLead.id, 'KEEP')} 
                      className={`py-2 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1 ${selectedLead.review_state === 'KEEP' ? 'bg-emerald-600 text-white shadow-md' : 'bg-emerald-600/90 hover:bg-emerald-700 text-white'}`}
                    >
                      <i className="fa-solid fa-check text-xs"></i>
                      <span>Keep</span>
                    </button>
                    <button 
                      onClick={() => handleSetReviewState(selectedLead.id, 'REVIEW_LATER')} 
                      className={`py-2 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1 ${selectedLead.review_state === 'REVIEW_LATER' ? 'bg-amber-500 text-white shadow-md' : 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300'}`}
                    >
                      <i className="fa-solid fa-clock text-xs"></i>
                      <span>Review Later</span>
                    </button>
                    <button 
                      onClick={() => handleSetReviewState(selectedLead.id, 'REJECT')} 
                      className={`py-2 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1 ${selectedLead.review_state === 'REJECT' ? 'bg-rose-600 text-white shadow-md' : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'}`}
                    >
                      <i className="fa-solid fa-xmark text-xs"></i>
                      <span>Reject</span>
                    </button>
                  </div>
                </div>

                {/* Lead Type Dropdown & Notes */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-700">Lead Type</label>
                    <select className="bg-slate-50 border border-slate-300 text-xs rounded-lg px-2.5 py-1 text-slate-800 font-semibold focus:outline-none focus:border-indigo-600">
                      <option>Local Page / Media</option>
                      <option>Influencer</option>
                      <option>Business Owner</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <textarea 
                      rows="2" 
                      value={newNoteContent} 
                      onChange={(e) => setNewNoteContent(e.target.value)} 
                      placeholder="Add notes about this account..." 
                      className="w-full bg-slate-50 border border-slate-300 text-xs rounded-xl p-2.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-600"
                    ></textarea>
                    <button onClick={submitNote} className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-xs transition">
                      Save Note
                    </button>
                  </div>
                </div>

                {/* Footer External Buttons */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                  <a 
                    href={`https://instagram.com/${selectedLead.username}`} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="py-2 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 flex items-center justify-center space-x-1.5 shadow-2xs transition"
                  >
                    <span>View on Instagram</span>
                    <i className="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
                  </a>
                  <button className="py-2 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 flex items-center justify-center space-x-1.5 shadow-2xs transition">
                    <span>Save to List</span>
                    <i className="fa-solid fa-bookmark text-[10px]"></i>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-400 space-y-2 my-auto">
              <i className="fa-solid fa-user-circle text-4xl text-slate-300"></i>
              <p className="text-xs font-semibold text-slate-600">Select any account row from the table to preview full profile details & review signals.</p>
            </div>
          )}
        </aside>
      </div>

      {/* Notes Modal Drawer */}
      {notesDrawerLead && (
        <div className="fixed inset-y-0 right-0 w-96 bg-white border-l border-slate-200 shadow-2xl z-40 flex flex-col">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
            <div>
              <h3 className="font-bold text-sm text-slate-900">Notes: @{notesDrawerLead.username}</h3>
              <p className="text-[11px] text-slate-500">Team comments & outreach logs</p>
            </div>
            <button onClick={() => setNotesDrawerLead(null)} className="text-slate-400 hover:text-slate-700">
              <i className="fa-solid fa-xmark text-lg"></i>
            </button>
          </div>

          <div className="flex-1 p-4 overflow-y-auto space-y-3 custom-scrollbar bg-slate-50/50">
            {leadNotes.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs italic">No notes added yet for this account.</div>
            ) : (
              leadNotes.map(n => (
                <div key={n.id} className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-slate-800">{n.author_name}</span>
                    <span className="text-slate-400">{new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed">{n.note_content}</p>
                </div>
              ))
            )}
          </div>

          <div className="p-4 border-t border-slate-200 bg-white space-y-2">
            <textarea 
              rows="3" 
              value={newNoteContent} 
              onChange={(e) => setNewNoteContent(e.target.value)} 
              placeholder="Add note (e.g. Spoke to owner on WhatsApp, scheduled demo)..." 
              className="w-full bg-slate-50 border border-slate-300 text-xs rounded-xl p-2.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-600"
            ></textarea>
            <button onClick={submitNote} className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-xs shadow-md transition flex items-center justify-center space-x-2">
              <i className="fa-solid fa-paper-plane"></i>
              <span>Add Note</span>
            </button>
          </div>
        </div>
      )}

      {/* Discovery Categories Modal */}
      {discoveryModalOpen && discoveryQueries && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-3xl w-full p-6 space-y-6 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
                  <i className="fa-solid fa-layer-group text-indigo-600"></i>
                  <span>Multi-Category Discovery Engine Setup</span>
                </h3>
                <p className="text-xs text-slate-500">4 Query Tracks generated for Apify Collection</p>
              </div>
              <button onClick={() => setDiscoveryModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto custom-scrollbar p-1">
              {Object.entries(discoveryQueries).map(([cat, queries]) => (
                <div key={cat} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-indigo-900 flex items-center justify-between">
                    <span>{cat} Track</span>
                    <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-[10px]">{queries.length} Queries</span>
                  </div>
                  <ul className="space-y-1">
                    {queries.map((q, idx) => (
                      <li key={idx} className="text-xs text-slate-700 flex items-center space-x-1.5">
                        <i className="fa-solid fa-hashtag text-indigo-500 text-[10px]"></i>
                        <span>{q}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Admin Modal */}
      {adminModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full p-6 space-y-6 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
                <i className="fa-solid fa-user-shield text-indigo-600"></i>
                <span>Admin Portal - Team Management</span>
              </h3>
              <button onClick={() => setAdminModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">Add New Team Member</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input 
                  type="text" 
                  value={adminForm.full_name} 
                  onChange={(e) => setAdminForm({ ...adminForm, full_name: e.target.value })} 
                  placeholder="Full Name" 
                  className="bg-white border border-slate-300 text-xs rounded-xl px-3 py-2 text-slate-800" 
                />
                <input 
                  type="email" 
                  value={adminForm.email} 
                  onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })} 
                  placeholder="Email Address" 
                  className="bg-white border border-slate-300 text-xs rounded-xl px-3 py-2 text-slate-800" 
                />
                <input 
                  type="password" 
                  value={adminForm.password} 
                  onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })} 
                  placeholder="Password" 
                  className="bg-white border border-slate-300 text-xs rounded-xl px-3 py-2 text-slate-800" 
                />
              </div>
              <button onClick={createTeamUser} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs shadow-xs">
                Create Team User
              </button>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Existing Team Users</h4>
              <div className="max-h-48 overflow-y-auto space-y-2 custom-scrollbar pr-1">
                {adminUsers.map(u => (
                  <div key={u.id} className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                    <div>
                      <span className="font-bold text-slate-900">{u.full_name}</span>
                      <span className="text-slate-500 ml-2">({u.email})</span>
                    </div>
                    <span className="bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded uppercase text-[10px]">{u.role}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
