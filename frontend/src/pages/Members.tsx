import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Shield, Trash2, X, AlertCircle, CheckCircle2, Key, Copy, Check } from 'lucide-react';
import { membersApi } from '../services/api';
import { TenantMember, TenantRole } from '../types';
import { useAuth } from '../context/AuthContext';

export const Members: React.FC = () => {
  const { activeWorkspace, user } = useAuth();
  const [members, setMembers] = useState<TenantMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<TenantRole>('MEMBER');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const canManage = activeWorkspace?.role === 'OWNER' || activeWorkspace?.role === 'ADMIN';

  const handleCopyCode = () => {
    if (activeWorkspace?.join_code) {
      navigator.clipboard.writeText(activeWorkspace.join_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const data = await membersApi.list();
      setMembers(data);
    } catch (err) {
      console.error('Failed to load members:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, [activeWorkspace?.id]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      setIsSubmitting(true);
      await membersApi.invite(inviteEmail.trim(), inviteRole);
      setSuccess(`Added ${inviteEmail} to ${activeWorkspace?.name}!`);
      setInviteEmail('');
      setIsModalOpen(false);
      fetchMembers();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to add member');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRoleChange = async (memberId: string, newRole: TenantRole) => {
    try {
      await membersApi.updateRole(memberId, newRole);
      fetchMembers();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to update role');
    }
  };

  const handleRemove = async (memberId: string, memberName: string) => {
    if (!confirm(`Are you sure you want to remove ${memberName} from this workspace?`)) return;
    try {
      await membersApi.remove(memberId);
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to remove member');
    }
  };

  const getRoleBadge = (role: TenantRole) => {
    switch (role) {
      case 'OWNER':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
            OWNER
          </span>
        );
      case 'ADMIN':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sage-50 text-sage-700 border border-sage-200">
            ADMIN
          </span>
        );
      case 'MEMBER':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-earth-100 text-earth-700 border border-earth-200">
            MEMBER
          </span>
        );
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-forest-900 tracking-tight">Organization Members</h1>
          <p className="text-xs text-earth-600 mt-0.5">
            Manage who has access to <span className="font-semibold text-sage-800">{activeWorkspace?.name}</span>'s documents and AI assistant.
          </p>
        </div>

        {canManage && (
          <button
            onClick={() => {
              setError(null);
              setIsModalOpen(true);
            }}
            className="px-4 py-2.5 rounded-xl bg-sage-600 hover:bg-sage-700 text-white font-semibold text-xs transition-colors flex items-center gap-2 shadow-sm self-start sm:self-auto"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Member</span>
          </button>
        )}
      </div>

      {/* Workspace Join Code Share Card */}
      <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-sage-50 via-white to-earth-50 border border-sage-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-2xl bg-sage-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <Key className="w-5 h-5 text-sage-100" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-sage-900">Workspace Join Code</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-sage-100 text-sage-800 font-semibold">1-Click Join</span>
            </div>
            <p className="text-xs text-earth-600 mt-0.5">
              Share this code with employees so they can register or join this workspace directly.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="px-4 py-2 rounded-xl bg-white border border-earth-300 font-mono text-sm font-bold text-forest-900 tracking-widest shadow-2xs">
            {activeWorkspace?.join_code || 'Loading...'}
          </div>
          <button
            type="button"
            onClick={handleCopyCode}
            className="px-3.5 py-2 rounded-xl bg-sage-600 hover:bg-sage-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied!' : 'Copy Code'}</span>
          </button>
        </div>
      </div>

      {success && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{success}</span>
        </div>
      )}

      {/* Members Table */}
      <div className="bg-white rounded-3xl border border-earth-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-earth-50/60 text-earth-500 font-semibold border-b border-earth-100 uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-6">Member</th>
                <th className="py-3.5 px-4">Role</th>
                <th className="py-3.5 px-4">Joined Date</th>
                {canManage && <th className="py-3.5 px-6 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-earth-100 text-forest-800">
              {loading ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-earth-400">
                    Loading team members...
                  </td>
                </tr>
              ) : members.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-earth-400">
                    No members found.
                  </td>
                </tr>
              ) : (
                members.map((m) => {
                  const isSelf = m.user_id === user?.id;
                  return (
                    <tr key={m.id} className="hover:bg-earth-50/40 transition-colors">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-earth-200 text-forest-900 flex items-center justify-center font-bold text-xs uppercase shrink-0">
                            {m.user?.name?.slice(0, 2) || 'U'}
                          </div>
                          <div>
                            <div className="font-semibold text-forest-900 flex items-center gap-2">
                              <span>{m.user?.name}</span>
                              {isSelf && (
                                <span className="text-[10px] text-earth-400 font-normal">(You)</span>
                              )}
                            </div>
                            <div className="text-[11px] text-earth-500">{m.user?.email}</div>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-4">
                        {canManage && !isSelf && m.role !== 'OWNER' ? (
                          <select
                            value={m.role}
                            onChange={(e) => handleRoleChange(m.id, e.target.value as TenantRole)}
                            className="text-xs py-1 px-2 rounded-lg border border-earth-200 bg-white focus:outline-none focus:ring-1 focus:ring-sage-500"
                          >
                            <option value="MEMBER">MEMBER</option>
                            <option value="ADMIN">ADMIN</option>
                            <option value="OWNER">OWNER</option>
                          </select>
                        ) : (
                          getRoleBadge(m.role)
                        )}
                      </td>

                      <td className="py-4 px-4 text-earth-500">
                        {new Date(m.created_at).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>

                      {canManage && (
                        <td className="py-4 px-6 text-right">
                          {!isSelf && m.role !== 'OWNER' && (
                            <button
                              onClick={() => handleRemove(m.id, m.user.name)}
                              className="p-1.5 rounded-lg text-earth-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                              title="Remove Member"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invite Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-forest-900/40 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-earth-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-forest-900">Add Workspace Member</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-earth-400 hover:bg-earth-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleInvite} className="space-y-4">
              <p className="text-xs text-earth-600">
                Grant access to this workspace by entering the registered user's email address.
              </p>

              <div>
                <label className="block text-xs font-semibold text-forest-800 mb-1">
                  User Email Address
                </label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-earth-300 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-sage-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-forest-800 mb-1">
                  Assigned Role
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as TenantRole)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-earth-300 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-sage-500"
                >
                  <option value="MEMBER">MEMBER (Can view documents & chat with AI)</option>
                  <option value="ADMIN">ADMIN (Can upload docs, manage chats & members)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-earth-700 hover:bg-earth-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-sage-600 hover:bg-sage-700 text-white transition-colors disabled:opacity-60"
                >
                  {isSubmitting ? 'Adding...' : 'Add Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
