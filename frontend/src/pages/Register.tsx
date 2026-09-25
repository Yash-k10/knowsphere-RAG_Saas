import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Sparkles, Shield, ArrowRight, Lock, Mail, User as UserIcon, Building2, Key, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../services/api';

export const Register: React.FC = () => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [orgName, setOrgName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [detectedCompany, setDetectedCompany] = useState<{ name: string; slug: string } | null>(null);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (mode !== 'join') {
      setDetectedCompany(null);
      setCodeError(null);
      return;
    }

    const trimmed = joinCode.trim().toUpperCase();
    if (!trimmed || trimmed.length < 5) {
      setDetectedCompany(null);
      setCodeError(null);
      return;
    }

    const timeout = setTimeout(async () => {
      setIsVerifyingCode(true);
      setCodeError(null);
      try {
        const data = await authApi.lookupWorkspace(trimmed);
        setDetectedCompany({ name: data.name, slug: data.slug });
      } catch (err: any) {
        setDetectedCompany(null);
        setCodeError(err.response?.data?.detail || 'No organization found for this code.');
      } finally {
        setIsVerifyingCode(false);
      }
    }, 350);

    return () => clearTimeout(timeout);
  }, [joinCode, mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === 'join') {
        if (!joinCode.trim()) {
          setError('Please provide a valid workspace invite code.');
          setLoading(false);
          return;
        }
        await register(name, email, password, undefined, joinCode.trim().toUpperCase());
      } else {
        await register(name, email, password, orgName);
      }
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Registration failed');
    } finally {
      setLoading(false);
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
            Enterprise Private RAG Knowledge Assistant
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-sm border border-earth-200 p-6 sm:p-8">
          {/* Mode Switcher Tabs */}
          <div className="grid grid-cols-2 p-1 bg-earth-100/70 rounded-2xl mb-6">
            <button
              type="button"
              onClick={() => {
                setMode('create');
                setError(null);
              }}
              className={`py-2 text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                mode === 'create'
                  ? 'bg-white text-forest-900 shadow-xs'
                  : 'text-earth-600 hover:text-forest-900'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Create Company</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('join');
                setError(null);
              }}
              className={`py-2 text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                mode === 'join'
                  ? 'bg-white text-forest-900 shadow-xs'
                  : 'text-earth-600 hover:text-forest-900'
              }`}
            >
              <Key className="w-3.5 h-3.5" />
              <span>Join with Code</span>
            </button>
          </div>

          <div className="mb-5">
            <h2 className="text-lg font-bold text-forest-900">
              {mode === 'create' ? 'Create a New Organization' : 'Join Existing Organization'}
            </h2>
            <p className="text-xs text-earth-500 mt-0.5">
              {mode === 'create'
                ? 'Create a workspace to upload documents and invite your team.'
                : 'Enter your team’s invite code to access shared documents immediately.'}
            </p>
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
                Full Name
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-earth-400 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Alex Morgan"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-earth-300 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            {mode === 'create' ? (
              <div>
                <label className="block text-xs font-semibold text-forest-800 mb-1.5">
                  Company / Organization Name
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-earth-400 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    required
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder="e.g. Acme Technologies"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-earth-300 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-forest-800">
                    Workspace Invite Code
                  </label>
                  <span className="text-[10px] text-sage-600 font-medium">From your Leader / CEO</span>
                </div>
                <div className="relative">
                  <Key className="w-4 h-4 text-earth-400 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    required
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="e.g. KS-8B4N9X"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-earth-300 text-sm uppercase tracking-wider font-mono focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-transparent transition-all"
                  />
                </div>

                {/* Live Company Name Preview */}
                {isVerifyingCode && (
                  <div className="mt-2.5 p-3 rounded-2xl bg-earth-100/70 border border-earth-200 text-forest-800 text-xs flex items-center gap-2 animate-in fade-in">
                    <Loader2 className="w-4 h-4 text-sage-600 animate-spin" />
                    <span>Verifying organization code...</span>
                  </div>
                )}

                {detectedCompany && !isVerifyingCode && (
                  <div className="mt-2.5 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-950 flex items-center justify-between shadow-2xs animate-in zoom-in-95 duration-200">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">Company Found</span>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        </div>
                        <p className="text-sm font-bold text-emerald-950 mt-0.5">{detectedCompany.name}</p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-md bg-emerald-200/80 text-emerald-900 text-[10px] font-bold">
                      Verified
                    </span>
                  </div>
                )}

                {codeError && !isVerifyingCode && (
                  <div className="mt-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                    <span>{codeError}</span>
                  </div>
                )}

                <p className="text-[11px] text-earth-500 mt-1.5">
                  Ask your workspace owner for their 6-character code (found in Team Members page).
                </p>
              </div>
            )}

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
              <label className="block text-xs font-semibold text-forest-800 mb-1.5">
                Password (min 6 characters)
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-earth-400 absolute left-3.5 top-3.5" />
                <input
                  type="password"
                  required
                  minLength={6}
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
              className="w-full mt-2 py-3 rounded-xl bg-sage-600 hover:bg-sage-700 text-white font-semibold text-sm shadow-sm shadow-sage-200 transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
            >
              <span>
                {loading
                  ? mode === 'create'
                    ? 'Creating Workspace...'
                    : 'Joining Workspace...'
                  : mode === 'create'
                  ? 'Create Account & Workspace'
                  : 'Join Organization Workspace'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-earth-100 text-center">
            <p className="text-xs text-earth-600">
              Already have an account?{' '}
              <Link to="/login" className="font-semibold text-sage-700 hover:text-sage-800 underline">
                Sign In
              </Link>
            </p>
          </div>
        </div>

        {/* Security Footer Note */}
        <div className="mt-8 flex items-center justify-center gap-2 text-xs text-earth-500">
          <Shield className="w-3.5 h-3.5 text-sage-600" />
          <span>Strict relational multi-tenant document isolation enabled</span>
        </div>
      </div>
    </div>
  );
};
