import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Sparkles, Shield, ArrowRight, Lock, Mail, AlertCircle, Building2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const DEMO_ACCOUNTS = [
  {
    company: 'Acme Technologies',
    email: 'demo.acme@knowsphere.io',
    password: 'Password123!',
  },
  {
    company: 'BioNova Health',
    email: 'demo.apex@knowsphere.io',
    password: 'Password123!',
  },
];

export const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeDemo, setActiveDemo] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectDemo = async (demo: typeof DEMO_ACCOUNTS[0]) => {
    setError(null);
    setEmail(demo.email);
    setPassword(demo.password);
    setActiveDemo(demo.company);
    setLoading(true);
    try {
      await login(demo.email, demo.password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.detail || `Failed to sign in as ${demo.company}`);
    } finally {
      setLoading(false);
      setActiveDemo(null);
    }
  };

  return (
    <div className="min-h-screen bg-earth-50 flex flex-col justify-center items-center p-4 sm:p-6 font-sans">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-sage-600 to-forest-700 text-white shadow-md shadow-sage-200 mb-3">
            <Sparkles className="w-7 h-7 text-sage-100" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-forest-900 tracking-tight">KnowSphere</h1>
          <p className="text-xs sm:text-sm text-sage-700 mt-1">
            Your organization's private knowledge, intelligently searchable.
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-sm border border-earth-200 p-6 sm:p-8">
          <div className="mb-5">
            <h2 className="text-lg font-bold text-forest-900">Sign In to Your Workspace</h2>
            <p className="text-xs text-earth-500 mt-0.5">
              Enter your credentials or choose a demo account below.
            </p>
          </div>

          {/* Clean & Simple Demo Accounts Section */}
          <div className="mb-5 p-3.5 rounded-2xl bg-earth-50 border border-earth-200">
            <p className="text-[11px] font-semibold text-earth-600 uppercase tracking-wider mb-2.5">
              ⚡ Demo Accounts (Click to test):
            </p>
            <div className="grid grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map((demo) => {
                const isSelected = activeDemo === demo.company;
                return (
                  <button
                    key={demo.company}
                    type="button"
                    disabled={loading}
                    onClick={() => handleSelectDemo(demo)}
                    className="p-2.5 rounded-xl border border-earth-200 bg-white hover:border-sage-500 hover:bg-sage-50/50 text-left transition-all group disabled:opacity-60 shadow-xs"
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <Building2 className="w-3.5 h-3.5 text-sage-600" />
                      <span className="text-xs font-bold text-forest-900 group-hover:text-sage-700 truncate">
                        {demo.company}
                      </span>
                    </div>
                    <p className="text-[10px] text-earth-500 truncate font-mono">
                      {isSelected ? 'Signing in...' : demo.email.split('@')[0]}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <div className="mb-5 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-forest-800 mb-1.5">
                Work Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-earth-400 absolute left-3.5 top-3.5" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-earth-300 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-semibold text-forest-800">
                  Password
                </label>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-earth-400 absolute left-3.5 top-3.5" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-earth-300 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 rounded-xl bg-sage-600 hover:bg-sage-700 text-white font-semibold text-sm shadow-sm shadow-sage-200 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <span>{loading ? 'Authenticating...' : 'Sign In'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-earth-100 text-center">
            <p className="text-xs text-earth-600">
              Need a new organization workspace?{' '}
              <Link to="/register" className="font-semibold text-sage-700 hover:text-sage-800 underline">
                Create Account
              </Link>
            </p>
          </div>
        </div>

        {/* Security Assurance Footer */}
        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-earth-500">
          <Shield className="w-4 h-4 text-sage-600" />
          <span>Multi-Tenant Relational & Vector Isolation Active</span>
        </div>
      </div>
    </div>
  );
};
