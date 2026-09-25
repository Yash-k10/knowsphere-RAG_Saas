import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Files,
  Users,
  MessageSquare,
  Database,
  Loader2,
  ArrowUpRight,
  ShieldCheck,
  Cpu,
  Layers,
  Sparkles,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { tenantApi } from '../services/api';
import { DashboardStats } from '../types';

export const Dashboard: React.FC = () => {
  const { activeWorkspace } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const data = await tenantApi.getDashboard();
      setStats(data);
    } catch (err) {
      console.error('Failed to load dashboard metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [activeWorkspace?.id]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-sage-700 via-sage-600 to-forest-800 rounded-3xl p-6 sm:p-8 text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-sage-100 text-xs font-medium">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Multi-Tenant AI Workspace</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            {activeWorkspace?.name || 'Workspace Dashboard'}
          </h1>
          <p className="text-sage-100/90 text-sm max-w-xl leading-relaxed">
            Your private organization knowledge base is ready. Documents are securely chunked, locally vectorized, and indexed in PostgreSQL for isolated similarity search.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={fetchStats}
            title="Refresh metrics"
            className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <Link
            to="/knowledge-base"
            className="px-4 py-2.5 rounded-xl bg-white text-forest-900 hover:bg-earth-100 font-semibold text-xs transition-colors flex items-center gap-2 shadow-sm"
          >
            <Files className="w-4 h-4 text-sage-700" />
            <span>Upload Documents</span>
          </Link>
          <Link
            to="/chat"
            className="px-4 py-2.5 rounded-xl bg-sage-900/60 hover:bg-sage-900/80 text-white font-semibold text-xs border border-white/20 transition-colors flex items-center gap-2"
          >
            <MessageSquare className="w-4 h-4 text-sage-200" />
            <span>New Chat</span>
          </Link>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="bg-white p-5 rounded-2xl border border-earth-200 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-earth-500 uppercase tracking-wider">
              Documents
            </p>
            <h3 className="text-2xl font-bold text-forest-900">
              {loading ? '-' : stats?.total_documents || 0}
            </h3>
            <span className="text-[11px] text-sage-600 font-medium">In knowledge base</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-sage-50 text-sage-700 flex items-center justify-center">
            <Files className="w-6 h-6" />
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white p-5 rounded-2xl border border-earth-200 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-earth-500 uppercase tracking-wider">
              Vector Chunks
            </p>
            <h3 className="text-2xl font-bold text-forest-900">
              {loading ? '-' : stats?.total_chunks || 0}
            </h3>
            <span className="text-[11px] text-sage-600 font-medium">384-d local embeddings</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-earth-100 text-earth-700 flex items-center justify-center">
            <Database className="w-6 h-6" />
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white p-5 rounded-2xl border border-earth-200 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-earth-500 uppercase tracking-wider">
              Conversations
            </p>
            <h3 className="text-2xl font-bold text-forest-900">
              {loading ? '-' : stats?.total_conversations || 0}
            </h3>
            <span className="text-[11px] text-sage-600 font-medium">AI query sessions</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-sage-50 text-sage-700 flex items-center justify-center">
            <MessageSquare className="w-6 h-6" />
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-white p-5 rounded-2xl border border-earth-200 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-earth-500 uppercase tracking-wider">
              Team Members
            </p>
            <h3 className="text-2xl font-bold text-forest-900">
              {loading ? '-' : stats?.total_members || 0}
            </h3>
            <span className="text-[11px] text-sage-600 font-medium">Authorized in workspace</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-earth-100 text-earth-700 flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Processing Status Banner if files are ingesting */}
      {stats && stats.documents_processing > 0 && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-amber-600 animate-spin shrink-0" />
            <div>
              <p className="text-xs font-bold">
                {stats.documents_processing} document(s) currently being parsed and vectorized.
              </p>
              <p className="text-[11px] text-amber-700">
                Text extraction, sliding window chunking, and local embedding inference in progress.
              </p>
            </div>
          </div>
          <Link
            to="/knowledge-base"
            className="text-xs font-semibold text-amber-800 hover:text-amber-900 underline"
          >
            View status
          </Link>
        </div>
      )}

      {/* Architecture & Portfolio Explainer Box */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-earth-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sage-100 text-sage-800 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-forest-900">KnowSphere System Architecture</h2>
              <p className="text-xs text-earth-500">How multi-tenant RAG is enforced in this system</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="p-4 rounded-2xl bg-earth-50/70 border border-earth-200/80 space-y-2">
            <div className="flex items-center gap-2 text-sage-700 font-bold text-xs uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4" />
              <span>1. Strict Tenant Scoping</span>
            </div>
            <p className="text-xs text-forest-700 leading-relaxed">
              Every database query and vector similarity lookup is strictly bound to <code className="px-1 py-0.5 rounded bg-earth-200 text-[10px]">tenant_id == authorized_tenant</code> on the server. Cross-tenant leakage is mathematically impossible.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-earth-50/70 border border-earth-200/80 space-y-2">
            <div className="flex items-center gap-2 text-sage-700 font-bold text-xs uppercase tracking-wider">
              <Cpu className="w-4 h-4" />
              <span>2. Local Embeddings</span>
            </div>
            <p className="text-xs text-forest-700 leading-relaxed">
              Raw documents and chunks never leave backend infrastructure. Embeddings are generated on-premise using an open-source ONNX model (<code className="px-1 py-0.5 rounded bg-earth-200 text-[10px]">all-MiniLM-L6-v2</code>).
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-earth-50/70 border border-earth-200/80 space-y-2">
            <div className="flex items-center gap-2 text-sage-700 font-bold text-xs uppercase tracking-wider">
              <Layers className="w-4 h-4" />
              <span>3. Modular LLM Provider</span>
            </div>
            <p className="text-xs text-forest-700 leading-relaxed">
              Generation uses an abstract <code className="px-1 py-0.5 rounded bg-earth-200 text-[10px]">LLMProvider</code> interface. Configured for Google Gemini in V1, ready to switch to local Ollama/vLLM without code changes.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
