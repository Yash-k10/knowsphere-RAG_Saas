import axios from 'axios';
import {
  User,
  Workspace,
  DocumentItem,
  Conversation,
  Message,
  TenantMember,
  DashboardStats,
  TenantRole
} from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export const apiClient = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: inject JWT token and active Tenant ID
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('knowsphere_token');
  const activeTenantId = localStorage.getItem('knowsphere_tenant_id');

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (activeTenantId) {
    config.headers['X-Tenant-ID'] = activeTenantId;
  }
  return config;
});

// Response Interceptor: handle 401
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      if (!window.location.pathname.includes('/login') && !window.location.pathname.includes('/register')) {
        localStorage.removeItem('knowsphere_token');
        localStorage.removeItem('knowsphere_tenant_id');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth Service
export const authApi = {
  async register(data: { name: string; email: string; password: string; organization_name?: string }) {
    const res = await apiClient.post<{ access_token: string; token_type: string }>('/auth/register', data);
    return res.data;
  },
  async login(formData: FormData) {
    const res = await apiClient.post<{ access_token: string; token_type: string }>('/auth/login', formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    return res.data;
  },
  async getMe() {
    const res = await apiClient.get<{ user: User; workspaces: Workspace[] }>('/auth/me');
    return res.data;
  },
};

// Tenant Service
export const tenantApi = {
  async createTenant(name: string) {
    const res = await apiClient.post<Workspace>('/tenants', { name });
    return res.data;
  },
  async getCurrentTenant() {
    const res = await apiClient.get<Workspace>('/tenants/current');
    return res.data;
  },
  async getDashboard() {
    const res = await apiClient.get<DashboardStats>('/tenants/dashboard');
    return res.data;
  },
};

// Documents Service
export const documentsApi = {
  async upload(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiClient.post<DocumentItem>('/documents/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },
  async list() {
    const res = await apiClient.get<DocumentItem[]>('/documents');
    return res.data;
  },
  async getById(id: string) {
    const res = await apiClient.get<DocumentItem>(`/documents/${id}`);
    return res.data;
  },
  async delete(id: string) {
    await apiClient.delete(`/documents/${id}`);
  },
};

// Chat Service
export const chatApi = {
  async sendMessage(data: { conversation_id?: string; message: string }) {
    const res = await apiClient.post<{
      conversation_id: string;
      answer: string;
      sources: any[];
      message_id: string;
    }>('/chat', data);
    return res.data;
  },
  async listConversations() {
    const res = await apiClient.get<Conversation[]>('/conversations');
    return res.data;
  },
  async getConversation(id: string) {
    const res = await apiClient.get<Conversation>(`/conversations/${id}`);
    return res.data;
  },
  async deleteConversation(id: string) {
    await apiClient.delete(`/conversations/${id}`);
  },
};

// Members Service
export const membersApi = {
  async list() {
    const res = await apiClient.get<TenantMember[]>('/members');
    return res.data;
  },
  async invite(email: string, role: TenantRole = 'MEMBER') {
    const res = await apiClient.post<TenantMember>('/members', { email, role });
    return res.data;
  },
  async updateRole(memberId: string, role: TenantRole) {
    const res = await apiClient.patch<TenantMember>(`/members/${memberId}`, { role });
    return res.data;
  },
  async remove(memberId: string) {
    await apiClient.delete(`/members/${memberId}`);
  },
};
