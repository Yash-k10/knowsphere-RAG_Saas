import React from 'react';
import { Building2, Shield, Cpu, Lock, Layers, CheckCircle2, User, Key } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Settings: React.FC = () => {
  const { activeWorkspace, user } = useAuth();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-forest-900 tracking-tight">Workspace & System Settings</h1>
        <p className="text-xs text-earth-600 mt-0.5">
          Configuration, security boundaries, and RAG architecture for this tenant environment.
        </p>
      </div>

      {/* Workspace Details Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-earth-200 shadow-sm space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-earth-100">
          <div className="w-10 h-10 rounded-2xl bg-sage-100 text-sage-800 flex items-center justify-center font-bold">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-forest-900">Workspace Identity</h2>
            <p className="text-xs text-earth-500">Relational tenant partition properties</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-2xl bg-earth-50/70 border border-earth-200">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-earth-500">
              Workspace Name
            </label>
            <p className="text-sm font-semibold text-forest-900 mt-1">{activeWorkspace?.name}</p>
          </div>

          <div className="p-4 rounded-2xl bg-earth-50/70 border border-earth-200">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-earth-500">
              Assigned Role
            </label>
            <p className="text-sm font-semibold text-sage-700 mt-1">{activeWorkspace?.role}</p>
          </div>

          <div className="p-4 rounded-2xl bg-earth-50/70 border border-earth-200">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-earth-500">
              Workspace Slug
            </label>
            <p className="text-sm font-mono text-forest-800 mt-1">{activeWorkspace?.slug}</p>
          </div>

          <div className="p-4 rounded-2xl bg-earth-50/70 border border-earth-200">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-earth-500">
              Tenant UUID
            </label>
            <p className="text-xs font-mono text-earth-600 mt-1 break-all">{activeWorkspace?.id}</p>
          </div>
        </div>
      </div>

      {/* RAG & Security Configuration Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-earth-200 shadow-sm space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-earth-100">
          <div className="w-10 h-10 rounded-2xl bg-earth-100 text-forest-800 flex items-center justify-center font-bold">
            <Shield className="w-5 h-5 text-sage-700" />
          </div>
          <div>
            <h2 className="text-base font-bold text-forest-900">RAG Pipeline & Security Boundaries</h2>
            <p className="text-xs text-earth-500">Verified zero-leakage technical design</p>
          </div>
        </div>

        <div className="space-y-4 text-xs text-forest-800">
          <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-sage-50/70 border border-sage-200">
            <CheckCircle2 className="w-5 h-5 text-sage-700 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-forest-900">Tenant Level Vector Search Scoping</p>
              <p className="text-earth-600 mt-0.5">
                Every similarity query executes with strict SQL predicate <code className="px-1 py-0.5 rounded bg-earth-200">WHERE tenant_id = :authorized_tenant</code>. Chunks belonging to other tenants are excluded before cosine distance calculation.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-sage-50/70 border border-sage-200">
            <CheckCircle2 className="w-5 h-5 text-sage-700 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-forest-900">Local Vector Embeddings</p>
              <p className="text-earth-600 mt-0.5">
                Model: <code className="px-1 py-0.5 rounded bg-earth-200">sentence-transformers/all-MiniLM-L6-v2</code> (384 dimensions). Embedding inference runs 100% locally on CPU via ONNX runtime. No document text is sent to cloud embedding APIs.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-sage-50/70 border border-sage-200">
            <CheckCircle2 className="w-5 h-5 text-sage-700 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-forest-900">Replaceable LLM Generation Layer</p>
              <p className="text-earth-600 mt-0.5">
                Configured with <strong>Google Gemini (gemini-1.5-flash)</strong> via abstract <code className="px-1 py-0.5 rounded bg-earth-200">LLMProvider</code>. Only the top-k retrieved snippets for a given question are transmitted. Can be swapped for internal Ollama or vLLM by changing <code className="px-1 py-0.5 rounded bg-earth-200">LLM_PROVIDER=local</code> in <code className="px-1 py-0.5 rounded bg-earth-200">.env</code>.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Account Profile Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-earth-200 shadow-sm space-y-4">
        <div className="flex items-center gap-3 pb-4 border-b border-earth-100">
          <div className="w-10 h-10 rounded-2xl bg-earth-100 text-forest-800 flex items-center justify-center font-bold">
            <User className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-forest-900">User Account</h2>
            <p className="text-xs text-earth-500">Your profile details</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <span className="text-earth-500 block font-semibold">User Name</span>
            <span className="text-forest-900 font-medium text-sm mt-0.5 block">{user?.name}</span>
          </div>
          <div>
            <span className="text-earth-500 block font-semibold">Email</span>
            <span className="text-forest-900 font-medium text-sm mt-0.5 block">{user?.email}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
