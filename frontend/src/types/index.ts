export type TenantRole = 'OWNER' | 'ADMIN' | 'MEMBER';

export interface User {
  id: string;
  name: string;
  email: string;
  created_at: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  join_code?: string;
  role: TenantRole;
}

export type DocumentStatus = 'UPLOADING' | 'PROCESSING' | 'READY' | 'FAILED';

export interface DocumentItem {
  id: string;
  tenant_id: string;
  filename: string;
  file_type: string;
  file_size: number;
  processing_status: DocumentStatus;
  error_message: string | null;
  total_chunks: number;
  created_at: string;
  uploaded_by: string | null;
}

export interface SourceCitation {
  document_id: string;
  document_name: string;
  page: number | null;
  similarity: number;
  snippet: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  sources_meta?: SourceCitation[] | null;
  created_at: string;
}

export interface Conversation {
  id: string;
  tenant_id: string;
  title: string;
  created_at: string;
  messages?: Message[];
}

export interface TenantMember {
  id: string;
  tenant_id: string;
  user_id: string;
  role: TenantRole;
  created_at: string;
  user: User;
}

export interface DashboardStats {
  tenant_name: string;
  total_documents: number;
  total_members: number;
  total_conversations: number;
  total_chunks: number;
  documents_processing: number;
}
