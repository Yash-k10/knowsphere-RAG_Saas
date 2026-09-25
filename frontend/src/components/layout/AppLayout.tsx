import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Files,
  MessageSquare,
  Users,
  Settings,
  LogOut,
  ChevronDown,
  Plus,
  ShieldCheck,
  Sparkles,
  Building2,
  Menu,
  X
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { tenantApi } from '../../services/api';

export const AppLayout: React.FC = () => {
  const { user, activeWorkspace, workspaces, switchWorkspace, logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [isOrgDropdownOpen, setIsOrgDropdownOpen] = useState(false);
  const [isCreateOrgModalOpen, setIsCreateOrgModalOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [isCreatingOrg, setIsCreatingOrg] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim()) return;
    try {
      setIsCreatingOrg(true);
      const created = await tenantApi.createTenant(newOrgName.trim());
      await refreshUser();
      switchWorkspace(created.id);
      setIsCreateOrgModalOpen(false);
      setNewOrgName('');
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to create workspace');
    } finally {
      setIsCreatingOrg(false);
    }
  };

  const navItems = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Knowledge Base', path: '/knowledge-base', icon: Files },
    { label: 'AI Assistant', path: '/chat', icon: MessageSquare },
    { label: 'Team Members', path: '/members', icon: Users },
    { label: 'Workspace Settings', path: '/settings', icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-earth-50 overflow-hidden font-sans">
      {/* Mobile Menu Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-forest-900/30 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-earth-200 flex flex-col transition-transform duration-300 lg:static lg:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="p-5 border-b border-earth-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sage-600 to-forest-700 flex items-center justify-center text-white shadow-sm shadow-sage-200">
              <Sparkles className="w-5 h-5 text-sage-100" />
            </div>
            <div>
              <span className="font-bold text-lg text-forest-900 tracking-tight">KnowSphere</span>
              <p className="text-[11px] font-medium text-sage-600">Enterprise Private RAG</p>
            </div>
          </div>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="p-1 rounded-lg hover:bg-earth-100 text-earth-500 lg:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Active Workspace Switcher */}
        <div className="p-4 border-b border-earth-100 relative">
          <div className="text-[10px] font-bold uppercase tracking-wider text-earth-400 mb-1 px-1">
            Current Workspace
          </div>
          <button
            onClick={() => setIsOrgDropdownOpen(!isOrgDropdownOpen)}
            className="w-full flex items-center justify-between p-2.5 rounded-xl border border-earth-200 bg-earth-50/60 hover:bg-earth-100/60 transition-colors text-left"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-sage-100 text-sage-700 flex items-center justify-center font-bold text-xs shrink-0">
                <Building2 className="w-4 h-4" />
              </div>
              <div className="truncate">
                <div className="text-sm font-semibold text-forest-900 truncate">
                  {activeWorkspace?.name || 'Loading...'}
                </div>
                <div className="text-[11px] text-sage-600 font-medium">
                  {activeWorkspace?.role || 'MEMBER'}
                </div>
              </div>
            </div>
            <ChevronDown className="w-4 h-4 text-earth-400 shrink-0" />
          </button>

          {/* Switcher Dropdown */}
          {isOrgDropdownOpen && (
            <div className="absolute left-4 right-4 top-20 mt-1 bg-white rounded-xl shadow-lg border border-earth-200 py-1.5 z-30 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-3 py-1.5 text-[11px] font-semibold text-earth-400 uppercase tracking-wider">
                Switch Organization
              </div>
              {workspaces.map((ws) => (
                <button
                  key={ws.id}
                  onClick={() => {
                    switchWorkspace(ws.id);
                    setIsOrgDropdownOpen(false);
                  }}
                  className={`w-full px-3 py-2 text-left flex items-center justify-between text-xs hover:bg-earth-50 transition-colors ${
                    ws.id === activeWorkspace?.id ? 'bg-sage-50 text-sage-800 font-semibold' : 'text-forest-800'
                  }`}
                >
                  <span className="truncate">{ws.name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-earth-100 text-earth-600 shrink-0">
                    {ws.role}
                  </span>
                </button>
              ))}
              <div className="border-t border-earth-100 mt-1 pt-1">
                <button
                  onClick={() => {
                    setIsOrgDropdownOpen(false);
                    setIsCreateOrgModalOpen(true);
                  }}
                  className="w-full px-3 py-2 text-left text-xs font-medium text-sage-700 hover:bg-sage-50 flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Create New Workspace
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-sage-600 text-white shadow-sm shadow-sage-200'
                      : 'text-forest-700 hover:bg-earth-100 hover:text-forest-900'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Tenant Isolation Guard Badge */}
        <div className="p-3 mx-3 my-2 rounded-xl bg-sage-50 border border-sage-200 text-forest-800">
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="w-4 h-4 text-sage-700 shrink-0" />
            <span className="text-xs font-bold text-sage-800">Tenant Isolation Active</span>
          </div>
          <p className="text-[11px] text-sage-700 leading-tight">
            Queries and vectors are cryptographically scoped to this organization only.
          </p>
        </div>

        {/* User Profile Footer */}
        <div className="p-4 border-t border-earth-200 flex items-center justify-between bg-earth-50/50">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-earth-300 text-forest-800 flex items-center justify-center font-bold text-xs uppercase shrink-0">
              {user?.name?.slice(0, 2) || 'U'}
            </div>
            <div className="truncate">
              <div className="text-xs font-bold text-forest-900 truncate">{user?.name}</div>
              <div className="text-[11px] text-earth-500 truncate">{user?.email}</div>
            </div>
          </div>
          <button
            onClick={() => {
              logout();
              navigate('/login');
            }}
            title="Log Out"
            className="p-1.5 rounded-lg text-earth-400 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-earth-200 px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 -ml-2 rounded-lg text-forest-800 hover:bg-earth-100 lg:hidden"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-sage-100 text-sage-800 border border-sage-200 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-sage-600 animate-pulse"></span>
                {activeWorkspace?.name || 'Workspace'}
              </span>
              <span className="text-xs text-earth-400 font-mono hidden sm:inline">
                ID: {activeWorkspace?.id?.slice(0, 8)}...
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <NavLink
              to="/chat"
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-sage-50 text-sage-800 hover:bg-sage-100 text-xs font-semibold border border-sage-200 transition-colors"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Ask KnowSphere
            </NavLink>
          </div>
        </header>

        {/* Viewport */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>

      {/* Create Organization Modal */}
      {isCreateOrgModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-forest-900/40 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-earth-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-forest-900">Create New Workspace</h3>
              <button
                onClick={() => setIsCreateOrgModalOpen(false)}
                className="p-1 rounded-lg text-earth-400 hover:bg-earth-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateOrg}>
              <p className="text-xs text-earth-600 mb-4">
                Each workspace provides a strictly isolated private knowledge base for your company or team.
              </p>
              <label className="block text-xs font-semibold text-forest-800 mb-1">
                Workspace / Organization Name
              </label>
              <input
                type="text"
                required
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                placeholder="e.g. Acme Research Labs"
                className="w-full px-3.5 py-2.5 rounded-xl border border-earth-300 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-transparent mb-5"
              />
              <div className="flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsCreateOrgModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-earth-700 hover:bg-earth-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingOrg}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-sage-600 hover:bg-sage-700 text-white transition-colors disabled:opacity-60"
                >
                  {isCreatingOrg ? 'Creating...' : 'Create Workspace'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
