import React, { useEffect, useState, useRef } from 'react';
import {
  UploadCloud,
  FileText,
  Trash2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Search,
  File,
  Layers
} from 'lucide-react';
import { documentsApi } from '../services/api';
import { DocumentItem, DocumentStatus } from '../types';
import { useAuth } from '../context/AuthContext';

export const KnowledgeBase: React.FC = () => {
  const { activeWorkspace } = useAuth();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDocuments = async () => {
    try {
      const data = await documentsApi.list();
      setDocuments(data);
    } catch (err: any) {
      console.error('Failed to load documents:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [activeWorkspace?.id]);

  // Auto-polling for active background ingestion tasks
  useEffect(() => {
    const hasPending = documents.some(
      (d) => d.processing_status === 'UPLOADING' || d.processing_status === 'PROCESSING'
    );
    if (!hasPending) return;

    const interval = setInterval(() => {
      fetchDocuments();
    }, 2500);

    return () => clearInterval(interval);
  }, [documents]);

  const handleFileUpload = async (file: File) => {
    setUploadError(null);
    const validExtensions = ['.pdf', '.docx', '.txt'];
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();

    if (!validExtensions.includes(ext)) {
      setUploadError(`Unsupported file format. Please upload PDF, DOCX, or TXT.`);
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setUploadError(`File exceeds maximum size of 15 MB.`);
      return;
    }

    try {
      setIsUploading(true);
      await documentsApi.upload(file);
      await fetchDocuments();
    } catch (err: any) {
      setUploadError(err.response?.data?.detail || 'Failed to upload document');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleDelete = async (docId: string, filename: string) => {
    if (!confirm(`Are you sure you want to permanently delete "${filename}" and its vector chunks?`)) {
      return;
    }
    try {
      await documentsApi.delete(docId);
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to delete document');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getStatusBadge = (status: DocumentStatus) => {
    switch (status) {
      case 'READY':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            READY
          </span>
        );
      case 'PROCESSING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
            <Loader2 className="w-3.5 h-3.5 text-amber-600 animate-spin" />
            PROCESSING
          </span>
        );
      case 'UPLOADING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <Clock className="w-3.5 h-3.5 text-blue-600" />
            UPLOADING
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
            <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
            FAILED
          </span>
        );
    }
  };

  const filteredDocs = documents.filter((d) =>
    d.filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-forest-900 tracking-tight">Organization Knowledge Base</h1>
          <p className="text-xs text-earth-600 mt-0.5">
            Documents uploaded here are chunked and vectorized strictly inside <span className="font-semibold text-sage-800">{activeWorkspace?.name}</span>.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchDocuments}
            title="Refresh list"
            className="p-2.5 rounded-xl border border-earth-200 bg-white hover:bg-earth-50 text-earth-600 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2.5 rounded-xl bg-sage-600 hover:bg-sage-700 text-white font-semibold text-xs transition-colors flex items-center gap-2 shadow-sm"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Upload Document</span>
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => e.target.files && handleFileUpload(e.target.files[0])}
            accept=".pdf,.docx,.txt"
            className="hidden"
          />
        </div>
      </div>

      {uploadError && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center justify-between">
          <span>{uploadError}</span>
          <button onClick={() => setUploadError(null)} className="text-red-900 font-bold ml-2">×</button>
        </div>
      )}

      {/* Drag & Drop Upload Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-3xl p-8 text-center cursor-pointer transition-all ${
          isDragging
            ? 'border-sage-500 bg-sage-50/60 scale-[1.005]'
            : 'border-earth-300 bg-white hover:border-sage-400 hover:bg-earth-50/40'
        }`}
      >
        <div className="w-14 h-14 mx-auto rounded-2xl bg-sage-50 text-sage-700 flex items-center justify-center mb-3">
          {isUploading ? (
            <Loader2 className="w-7 h-7 text-sage-600 animate-spin" />
          ) : (
            <UploadCloud className="w-7 h-7 text-sage-600" />
          )}
        </div>
        <h3 className="text-sm font-bold text-forest-900">
          {isUploading ? 'Uploading & Preparing Ingestion...' : 'Click to upload or drag and drop documents'}
        </h3>
        <p className="text-xs text-earth-500 mt-1">
          Supports <span className="font-semibold text-forest-700">PDF, DOCX, TXT</span> up to 15 MB
        </p>
      </div>

      {/* Search and Table Container */}
      <div className="bg-white rounded-3xl border border-earth-200 shadow-sm overflow-hidden">
        {/* Search Toolbar */}
        <div className="p-4 border-b border-earth-100 flex items-center justify-between gap-4">
          <div className="relative w-full max-w-sm">
            <Search className="w-4 h-4 text-earth-400 absolute left-3 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search documents by name..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-earth-200 focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-transparent"
            />
          </div>
          <span className="text-xs text-earth-500 shrink-0 font-medium">
            {filteredDocs.length} {filteredDocs.length === 1 ? 'document' : 'documents'}
          </span>
        </div>

        {/* Documents Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-earth-50/60 text-earth-500 font-semibold border-b border-earth-100 uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-6">Document</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Chunks</th>
                <th className="py-3.5 px-4">Size</th>
                <th className="py-3.5 px-4">Uploaded</th>
                <th className="py-3.5 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-earth-100 text-forest-800">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-earth-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-sage-600" />
                    Loading knowledge base...
                  </td>
                </tr>
              ) : filteredDocs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-earth-400">
                    <FileText className="w-10 h-10 text-earth-300 mx-auto mb-2" />
                    <p className="font-semibold text-forest-800">No documents found</p>
                    <p className="text-xs text-earth-500 mt-0.5">
                      Upload your first policy, handbook, or FAQ document to enable AI retrieval.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredDocs.map((doc) => (
                  <tr key={doc.id} className="hover:bg-earth-50/50 transition-colors">
                    <td className="py-4 px-6 font-medium text-forest-900">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-earth-100 text-sage-700 flex items-center justify-center font-bold text-[10px] shrink-0">
                          {doc.file_type}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-forest-900">{doc.filename}</p>
                          {doc.error_message && (
                            <p className="text-[11px] text-red-600 truncate">{doc.error_message}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">{getStatusBadge(doc.processing_status)}</td>
                    <td className="py-4 px-4 font-mono font-semibold text-sage-800">
                      <div className="flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-earth-400" />
                        <span>{doc.total_chunks}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-earth-600">{formatFileSize(doc.file_size)}</td>
                    <td className="py-4 px-4 text-earth-500">
                      {new Date(doc.created_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <button
                        onClick={() => handleDelete(doc.id, doc.filename)}
                        className="p-1.5 rounded-lg text-earth-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Delete Document"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
