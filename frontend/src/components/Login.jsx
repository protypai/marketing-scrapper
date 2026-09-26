import React, { useState } from 'react';

export default function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState('admin@protypai.com');
  const [password, setPassword] = useState('Admin@PumpPharma2026');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const formData = new URLSearchParams();
      formData.append('username', email);
      formData.append('password', password);

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'Invalid email or password');
      }

      const data = await res.json();
      localStorage.setItem('access_token', data.access_token);
      if (onLoginSuccess) onLoginSuccess(data.access_token);
      else window.location.href = '/';
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
      <div className="max-w-md w-full bg-white border border-slate-200/80 rounded-3xl shadow-xl p-8 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center p-2 rounded-2xl bg-slate-50 border border-slate-200/80 shadow-xs mb-1">
            <img 
              src="/static/logos/protypai-square.png" 
              alt="ProtypAI Logo" 
              className="w-14 h-14 object-contain rounded-xl" 
              onError={(e) => { e.target.src = '/static/logos/protypai-logo.svg'; }}
            />
          </div>
          <div>
            <div className="flex items-center justify-center space-x-1.5 mb-1">
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-indigo-600 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-full">
                ProtypAI Suite
              </span>
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">LeadHub Discovery</h1>
            <p className="text-xs text-slate-500 mt-1">Multi-Category Audience Scraper & Lead Engine</p>
          </div>

          {/* Product Badges */}
          <div className="flex items-center justify-center space-x-3 pt-2">
            <div className="bg-amber-50/80 border border-amber-200 px-3 py-1.5 rounded-xl text-xs font-bold text-amber-900 flex items-center space-x-2 shadow-2xs">
              <i className="fa-solid fa-gas-pump text-amber-600"></i>
              <span>PumpPilot (Fuel)</span>
            </div>
            <div className="bg-emerald-50/80 border border-emerald-200 px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-900 flex items-center space-x-2 shadow-2xs">
              <img src="/static/logos/pharmaflow-logo.svg" alt="PharmaFlow" className="w-4 h-4 object-contain" onError={(e) => { e.target.style.display='none'; }} />
              <span>PharmaFlow (ERP)</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs text-center font-semibold">
            {error}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">Email Address</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 text-sm">
                <i className="fa-solid fa-envelope"></i>
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@protypai.com"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:bg-white text-xs font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">Password</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 text-sm">
                <i className="fa-solid fa-lock"></i>
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:bg-white text-xs font-medium"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none text-sm"
              >
                <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md shadow-indigo-600/20 transition duration-150 text-xs flex items-center justify-center space-x-2"
          >
            {loading ? (
              <span>Authenticating...</span>
            ) : (
              <>
                <span>Sign In to ProtypAI Dashboard</span>
                <i className="fa-solid fa-arrow-right"></i>
              </>
            )}
          </button>
        </form>

        <div className="pt-4 border-t border-slate-200 text-center text-[11px] text-slate-400 font-medium">
          Protected by ProtypAI Authentication & Encrypted Storage
        </div>
      </div>
    </div>
  );
}
