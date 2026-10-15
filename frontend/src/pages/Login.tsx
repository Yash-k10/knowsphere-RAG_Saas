import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Shield,
  ArrowRight,
  Lock,
  Mail,
  AlertCircle,
  Building2,
  FileText,
  HelpCircle,
  Zap,
  CheckCircle2,
  Copy,
  Check
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../services/api';

interface DemoAccount {
  company_name: string;
  slug: string;
  join_code: string;
  user_name: string;
  role_title: string;
  email: string;
  password: string;
  industry: string;
  accent_color: string;
  sample_question: string;
  doc_filename: string;
}

const FALLBACK_DEMO_ACCOUNTS: DemoAccount[] = [
  {
    company_name: "Acme Cloud Technologies",
    slug: "acme-cloud",
    join_code: "ACME-DEMO",
    user_name: "Sarah Connor",
    role_title: "Head of Engineering (Admin)",
    email: "demo.acme@knowsphere.io",
    password: "Password123!",
    industry: "Cloud Infrastructure & SaaS",
    accent_color: "emerald",
    sample_question: "What is the annual paid vacation allowance and rollover policy?",
    doc_filename: "Acme_Cloud_Employee_Handbook_2026.txt"
  },
  {
    company_name: "BioNova Health Sciences",
    slug: "bionova-health",
    join_code: "BION-DEMO",
    user_name: "Dr. Marcus Vance",
    role_title: "Chief Compliance Officer (Admin)",
    email: "demo.apex@knowsphere.io",
    password: "Password123!",
    industry: "Biotech & Clinical Compliance",
    accent_color: "teal",
    sample_question: "What is the required timeline for reporting a Serious Adverse Event (SAE)?",
    doc_filename: "BioNova_Clinical_Compliance_Protocol.txt"
  }
];

export const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [demoLoggingIn, setDemoLoggingIn] = useState<string | null>(null);
  const [demoAccounts, setDemoAccounts] = useState<DemoAccount[]>(FALLBACK_DEMO_ACCOUNTS);
  const [copiedAccount, setCopiedAccount] = useState<string | null>(null);

  useEffect(() => {
    // Attempt to fetch fresh demo accounts from backend, fallback gracefully to static constants
    authApi.getDemoAccounts()
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setDemoAccounts(data);
        }
      })
      .catch(() => {
        // Silently preserve fallback demo accounts
      });
  }, []);

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

  const handleQuickDemoLogin = async (acc: DemoAccount) => {
    setError(null);
    setEmail(acc.email);
    setPassword(acc.password);
    setDemoLoggingIn(acc.email);
    try {
      await login(acc.email, acc.password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.detail || `Failed to sign in as ${acc.company_name}`);
    } finally {
      setDemoLoggingIn(null);
    }
  };

  const copyCredentials = (acc: DemoAccount, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(`Email: ${acc.email}\nPassword: ${acc.password}`);
    setCopiedAccount(acc.email);
    setTimeout(() => setCopiedAccount(null), 2000);
  };

  return (
    <div className="min-h-screen bg-earth-50 flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8 font-sans">
      <div className="w-full max-w-5xl">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-sage-600 to-forest-700 text-white shadow-md shadow-sage-200 mb-3">
            <Sparkles className="w-7 h-7 text-sage-100" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-forest-900 tracking-tight">KnowSphere</h1>
          <p className="text-xs sm:text-sm text-sage-700 mt-1 max-w-lg mx-auto">
            Enterprise Multi-Tenant RAG SaaS — with strict relational & vector isolation across organizations.
          </p>
        </div>

        {/* 2-Column Responsive Card Container */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Left Column: Direct Reviewer Demo Workspaces (Cols 1-7) */}
          <div className="lg:col-span-7 bg-white rounded-3xl shadow-sm border border-earth-200 p-6 sm:p-7 flex flex-col justify-between">
            <div>
              {/* Header Badge */}
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sage-100 border border-sage-200 text-sage-800 text-xs font-semibold">
                  <Zap className="w-3.5 h-3.5 text-sage-600 fill-sage-600" />
                  <span>Reviewer & Interviewer Quick Access</span>
                </div>
                <span className="text-[11px] font-medium text-earth-500">
                  Password: <code className="bg-earth-100 px-1.5 py-0.5 rounded text-forest-800 font-mono">Password123!</code>
                </span>
              </div>

              <h2 className="text-lg font-bold text-forest-900 tracking-tight">
                Explore Two Pre-Seeded Corporate Tenants
              </h2>
              <p className="text-xs text-earth-600 mt-1 mb-5 leading-relaxed">
                Experience multi-tenant boundaries firsthand. Each company below operates in a strictly isolated vector space with distinct internal documents and administrative access.
              </p>

              {/* Company Demo Cards */}
              <div className="space-y-4">
                {demoAccounts.map((acc, idx) => {
                  const isAcme = acc.slug.includes('acme');
                  const isCurrentLogging = demoLoggingIn === acc.email;
                  const borderHover = isAcme
                    ? 'hover:border-emerald-400 hover:shadow-emerald-50'
                    : 'hover:border-teal-400 hover:shadow-teal-50';
                  const badgeColor = isAcme
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-teal-50 text-teal-800 border-teal-200';
                  const avatarBg = isAcme
                    ? 'from-emerald-600 to-forest-800 text-emerald-50'
                    : 'from-teal-600 to-forest-800 text-teal-50';

                  return (
                    <div
                      key={acc.email}
                      className={`relative rounded-2xl border border-earth-200 bg-earth-50/60 p-4 transition-all duration-200 ${borderHover} shadow-sm`}
                    >
                      {/* Top Row: Company Icon, Name, Industry, Copy */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${avatarBg} flex items-center justify-center font-bold text-sm shadow-sm`}>
                            <Building2 className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-sm font-bold text-forest-900">{acc.company_name}</h3>
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badgeColor}`}>
                                {acc.industry}
                              </span>
                            </div>
                            <p className="text-[11px] text-earth-500 mt-0.5">
                              {acc.user_name} • <span className="text-forest-700 font-medium">{acc.role_title}</span>
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => copyCredentials(acc, e)}
                          title="Copy Email & Password"
                          className="text-earth-400 hover:text-earth-600 p-1.5 rounded-lg hover:bg-earth-200/50 transition-colors"
                        >
                          {copiedAccount === acc.email ? (
                            <Check className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>

                      {/* Seeded Document Preview & Sample Question */}
                      <div className="mt-3 pt-3 border-t border-earth-200/80 space-y-1.5 text-xs">
                        <div className="flex items-center gap-1.5 text-forest-800 font-medium">
                          <FileText className="w-3.5 h-3.5 text-sage-600 shrink-0" />
                          <span className="truncate">Pre-indexed: <code className="font-mono text-[11px] bg-white px-1.5 py-0.5 rounded border border-earth-200">{acc.doc_filename}</code></span>
                        </div>
                        <div className="flex items-start gap-1.5 text-earth-600 bg-white/70 p-2 rounded-xl border border-earth-150">
                          <HelpCircle className="w-3.5 h-3.5 text-earth-400 shrink-0 mt-0.5" />
                          <span className="text-[11px] leading-relaxed italic">
                            Try asking in chat: &ldquo;{acc.sample_question}&rdquo;
                          </span>
                        </div>
                      </div>

                      {/* 1-Click Login CTA */}
                      <div className="mt-3.5 flex items-center gap-2">
                        <button
                          type="button"
                          disabled={loading || !!demoLoggingIn}
                          onClick={() => handleQuickDemoLogin(acc)}
                          className={`flex-1 py-2 px-3.5 rounded-xl font-semibold text-xs text-white shadow-sm transition-all flex items-center justify-center gap-1.5 ${
                            isAcme
                              ? 'bg-emerald-700 hover:bg-emerald-800 shadow-emerald-200'
                              : 'bg-teal-700 hover:bg-teal-800 shadow-teal-200'
                          } disabled:opacity-60`}
                        >
                          {isCurrentLogging ? (
                            <>
                              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              <span>Signing In as {idx === 0 ? 'Acme Cloud' : 'BioNova'}...</span>
                            </>
                          ) : (
                            <>
                              <Zap className="w-3.5 h-3.5 fill-current" />
                              <span>1-Click Login as {acc.company_name.split(' ')[0]}</span>
                              <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setEmail(acc.email);
                            setPassword(acc.password);
                          }}
                          title="Fill credentials into form"
                          className="px-2.5 py-2 rounded-xl border border-earth-300 hover:bg-white text-earth-600 text-xs font-medium transition-colors"
                        >
                          Fill Form
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Strict Multi-Tenant Isolation Callout */}
            <div className="mt-5 p-3 rounded-2xl bg-sage-50 border border-sage-200 text-sage-800 text-[11px] flex items-start gap-2.5">
              <Shield className="w-4 h-4 text-sage-600 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                <strong>Strict Tenant Boundaries:</strong> Document embeddings and chat queries are partitioned at the database index level. Asking Acme Cloud about clinical trial protocols returns zero results, verifying data privacy.
              </p>
            </div>
          </div>

          {/* Right Column: Standard Manual Sign In (Cols 8-12) */}
          <div className="lg:col-span-5 bg-white rounded-3xl shadow-sm border border-earth-200 p-6 sm:p-7 flex flex-col justify-between">
            <div>
              <div className="mb-5">
                <h2 className="text-lg font-bold text-forest-900 tracking-tight">Direct Sign In</h2>
                <p className="text-xs text-earth-500 mt-0.5">
                  Enter existing credentials or choose a demo account.
                </p>
              </div>

              {error && (
                <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
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
                  disabled={loading || !!demoLoggingIn}
                  className="w-full mt-2 py-3 rounded-xl bg-sage-600 hover:bg-sage-700 text-white font-semibold text-sm shadow-sm shadow-sage-200 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  <span>{loading ? 'Authenticating...' : 'Sign In'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </div>

            <div className="mt-6 pt-5 border-t border-earth-100 text-center space-y-3">
              <p className="text-xs text-earth-600">
                Evaluating fresh onboarding?{' '}
                <Link to="/register" className="font-semibold text-sage-700 hover:text-sage-800 underline">
                  Register New Organization
                </Link>
              </p>
              <div className="flex items-center justify-center gap-1.5 text-[11px] text-earth-400">
                <CheckCircle2 className="w-3.5 h-3.5 text-sage-500" />
                <span>JWT Bearer Auth • AES-256 Tenant Vault</span>
              </div>
            </div>
          </div>
        </div>

        {/* Global Security Assurance Footer */}
        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-earth-500">
          <Shield className="w-4 h-4 text-sage-600" />
          <span>Multi-Tenant Relational & Vector Isolation Active</span>
        </div>
      </div>
    </div>
  );
};
