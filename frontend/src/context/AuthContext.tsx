import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Workspace } from '../types';
import { authApi } from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, orgName?: string) => Promise<void>;
  logout: () => void;
  switchWorkspace: (workspaceId: string) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('knowsphere_token'));
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchUserData = async () => {
    try {
      const data = await authApi.getMe();
      setUser(data.user);
      setWorkspaces(data.workspaces);

      const savedTenantId = localStorage.getItem('knowsphere_tenant_id');
      const matchingWorkspace = data.workspaces.find((w) => w.id === savedTenantId);

      if (matchingWorkspace) {
        setActiveWorkspace(matchingWorkspace);
      } else if (data.workspaces.length > 0) {
        setActiveWorkspace(data.workspaces[0]);
        localStorage.setItem('knowsphere_tenant_id', data.workspaces[0].id);
      }
    } catch (err) {
      console.error('Failed to load user session:', err);
      logout();
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchUserData();
    } else {
      setIsLoading(false);
    }
  }, [token]);

  const login = async (email: string, password: string) => {
    const formData = new FormData();
    formData.append('username', email);
    formData.append('password', password);
    const data = await authApi.login(formData);
    localStorage.setItem('knowsphere_token', data.access_token);
    setToken(data.access_token);
  };

  const register = async (name: string, email: string, password: string, orgName?: string) => {
    const data = await authApi.register({
      name,
      email,
      password,
      organization_name: orgName,
    });
    localStorage.setItem('knowsphere_token', data.access_token);
    setToken(data.access_token);
  };

  const logout = () => {
    localStorage.removeItem('knowsphere_token');
    localStorage.removeItem('knowsphere_tenant_id');
    setToken(null);
    setUser(null);
    setWorkspaces([]);
    setActiveWorkspace(null);
  };

  const switchWorkspace = (workspaceId: string) => {
    const target = workspaces.find((w) => w.id === workspaceId);
    if (target) {
      setActiveWorkspace(target);
      localStorage.setItem('knowsphere_tenant_id', target.id);
      window.location.reload(); // Refresh state cleanly for switched tenant
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        workspaces,
        activeWorkspace,
        isLoading,
        login,
        register,
        logout,
        switchWorkspace,
        refreshUser: fetchUserData,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
