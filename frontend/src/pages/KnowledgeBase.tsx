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
  Layers,
  Eye,
  ExternalLink,
  Download,
  X
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

  // File Viewer Modal State
  const [viewingDoc, setViewingDoc] = useState<DocumentItem | null>(null);
  const [fileBlobUrl, setFileBlobUrl] = useState<string | null>(null);
  const [fileText, setFileText] = useState<string | null>(null);
  const [loadingFile, setLoadingFile] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

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
      if (viewingDoc?.id === docId) {
        closeFileViewer();
      }
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to delete document');
    }
  };

  const handleViewFile = async (doc: DocumentItem) => {
    closeFileViewer();
    setViewingDoc(doc);
    setLoadingFile(true);
    setFileError(null);

    try {
      const blob = await documentsApi.getFileBlob(doc.id);
      const url = URL.createObjectURL(blob);
      setFileBlobUrl(url);

      const ext = doc.filename.split('.').pop()?.toLowerCase();
      if (ext === 'txt' || ext === 'md' || doc.file_type.toLowerCase() === 'txt') {
        const text = await blob.text();
        setFileText(text);
      } else {
        setFileText(null);
      }
    } catch (err: any) {
      console.error('Failed to load file blob:', err);
      setFileError(err.response?.data?.detail || 'Unable to load file content.');
    } finally {
      setLoadingFile(false);
    }
  };

  const closeFileViewer = () => {
    if (fileBlobUrl) {
      URL.revokeObjectURL(fileBlobUrl);
    }
    setViewingDoc(null);
    setFileBlobUrl(null);
    setFileText(null);
    setFileError(null);
    setLoadingFile(false);
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
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
            PROCESSING
          </span>
        );
      case 'UPLOADING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
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
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-forest-900 tracking-tight">
            Knowledge Base
          </h1>
          <p className="text-xs sm:text-sm text-earth-600 mt-1">
            Documents uploaded here are chunked and embedded strictly within{' '}
            <strong className="text-forest-800">{activeWorkspace?.name || 'your workspace'}</strong>.
          </p>
        </div>
        <button
          onClick={fetchDocuments}
          className="self-start sm:self-auto inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-earth-200 bg-white hover:bg-earth-50 text-earth-700 text-xs font-semibold transition-all shadow-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Upload Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-3xl p-8 sm:p-10 text-center cursor-pointer transition-all ${
          isDragging
            ? 'border-sage-500 bg-sage-50/60 scale-[0.99]'
            : 'border-earth-300 bg-white hover:border-sage-400 hover:bg-earth-50/40'
        }`}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              handleFileUpload(e.target.files[0]);
            }
          }}
          accept=".pdf,.docx,.txt"
          className="hidden"
        />
        <div className="flex flex-col items-center">
          <div className="w-14 h-14 rounded-2xl bg-sage-50 text-sage-600 flex items-center justify-center mb-4 border border-sage-100 shadow-xs">
            {isUploading ? (
              <Loader2 className="w-7 h-7 animate-spin text-sage-600" />
            ) : (
              <UploadCloud className="w-7 h-7 text-sage-600" />
            )}
          </div>
          <p className="text-sm font-semibold text-forest-900">
            {isUploading ? 'Uploading and dispatching RAG pipeline...' : 'Click or drag documents to upload'}
          </p>
          <p className="text-xs text-earth-500 mt-1 max-w-sm">
            Supported formats: <strong className="text-forest-800 font-medium">PDF, DOCX, TXT</strong> (Max 15 MB). Text is parsed, chunked, and locally embedded with pgvector.
          </p>
        </div>
      </div>

      {uploadError && (
        <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{uploadError}</span>
        </div>
      )}

      {/* Documents Table */}
      <div className="bg-white rounded-3xl shadow-sm border border-earth-200 overflow-hidden">
        {/* Search Bar */}
        <div className="p-4 sm:p-5 border-b border-earth-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-earth-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search documents by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-earth-200 text-xs focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-transparent"
            />
          </div>
          <span className="text-xs text-earth-500 font-medium self-end sm:self-auto">
            {filteredDocs.length} {filteredDocs.length === 1 ? 'document' : 'documents'}
          </span>
        </div>

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
                          <button
                            type="button"
                            onClick={() => handleViewFile(doc)}
                            className="truncate font-semibold text-forest-900 hover:text-sage-700 hover:underline text-left block"
                            title="Click to view file"
                          >
                            {doc.filename}
                          </button>
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
                      <div className="flex items-center justify-end gap-1.5">
                        {/* View File Option */}
                        <button
                          type="button"
                          onClick={() => handleViewFile(doc)}
                          className="px-2.5 py-1.5 rounded-lg text-sage-700 bg-sage-50 hover:bg-sage-100 border border-sage-200 transition-colors flex items-center gap-1.5 font-semibold text-xs shadow-2xs"
                          title="View Original File"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View File</span>
                        </button>

                        {/* Delete Option */}
                        <button
                          type="button"
                          onClick={() => handleDelete(doc.id, doc.filename)}
                          className="p-1.5 rounded-lg text-earth-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Delete Document"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modern Original File Viewer Modal */}
      {viewingDoc && (
        <div className="fixed inset-0 z-50 bg-forest-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-earth-200 w-full max-w-4xl h-[86vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 sm:px-6 sm:py-4 border-b border-earth-200 flex items-center justify-between gap-3 bg-earth-50/50">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-sage-100 text-sage-800 flex items-center justify-center font-bold text-xs shrink-0">
                  {viewingDoc.file_type}
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-bold text-forest-900 truncate">
                    {viewingDoc.filename}
                  </h3>
                  <p className="text-[11px] text-earth-500">
                    {formatFileSize(viewingDoc.file_size)} • {viewingDoc.total_chunks} Vector Chunks
                  </p>
                </div>
              </div>

              {/* Header Action Buttons */}
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={documentsApi.getFileUrl(viewingDoc.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1.5 rounded-xl border border-earth-200 bg-white hover:bg-earth-50 text-earth-700 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs"
                  title="Open in a dedicated browser tab"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Open in Tab</span>
                </a>

                <a
                  href={documentsApi.getFileUrl(viewingDoc.id, true)}
                  download={viewingDoc.filename}
                  className="px-2.5 py-1.5 rounded-xl bg-sage-600 hover:bg-sage-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
                  title="Download file"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Download</span>
                </a>

                <button
                  type="button"
                  onClick={closeFileViewer}
                  className="p-1.5 rounded-xl text-earth-400 hover:text-earth-700 hover:bg-earth-200/50 transition-colors"
                  title="Close viewer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body: File Content Viewer */}
            <div className="flex-1 overflow-auto bg-earth-50/30 relative">
              {loadingFile ? (
                <div className="flex flex-col items-center justify-center h-full text-earth-500 py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-sage-600 mb-3" />
                  <p className="text-sm font-semibold text-forest-800">Loading original file content...</p>
                  <p className="text-xs text-earth-400 mt-1">Streaming securely from workspace storage</p>
                </div>
              ) : fileError ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-6">
                  <AlertTriangle className="w-10 h-10 text-amber-500 mb-3" />
                  <h4 className="text-sm font-bold text-forest-900 mb-1">Unable to Preview File</h4>
                  <p className="text-xs text-earth-600 max-w-md mb-4">{fileError}</p>
                  <a
                    href={documentsApi.getFileUrl(viewingDoc.id, true)}
                    className="px-4 py-2 rounded-xl bg-sage-600 text-white font-semibold text-xs flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Download File Instead
                  </a>
                </div>
              ) : viewingDoc.file_type.toLowerCase() === 'pdf' ? (
                /* PDF Viewer using native browser iframe */
                <iframe
                  src={fileBlobUrl || documentsApi.getFileUrl(viewingDoc.id)}
                  title={viewingDoc.filename}
                  className="w-full h-full border-0"
                />
              ) : fileText !== null ? (
                /* Text & Markdown Clean Reader */
                <div className="p-6 sm:p-8 font-mono text-xs leading-relaxed text-forest-900 bg-white/80 min-h-full">
                  <pre className="whitespace-pre-wrap break-words font-mono text-xs text-forest-900 leading-relaxed">
                    {fileText}
                  </pre>
                </div>
              ) : (
                /* DOCX or binary format download & preview prompt */
                <div className="flex flex-col items-center justify-center h-full text-center p-8">
                  <div className="w-16 h-16 rounded-3xl bg-sage-100 text-sage-700 flex items-center justify-center mb-4">
                    <FileText className="w-8 h-8" />
                  </div>
                  <h4 className="text-base font-bold text-forest-900 mb-1">
                    {viewingDoc.filename}
                  </h4>
                  <p className="text-xs text-earth-600 max-w-md mb-6 leading-relaxed">
                    This document is stored in its original {viewingDoc.file_type} format. You can download it directly or open it in your desktop application.
                  </p>
                  <div className="flex items-center gap-3">
                    <a
                      href={documentsApi.getFileUrl(viewingDoc.id, true)}
                      download={viewingDoc.filename}
                      className="px-5 py-2.5 rounded-xl bg-sage-600 hover:bg-sage-700 text-white font-semibold text-xs flex items-center gap-2 shadow-sm transition-all"
                    >
                      <Download className="w-4 h-4" />
                      Download {viewingDoc.filename}
                    </a>
                    <a
                      href={documentsApi.getFileUrl(viewingDoc.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2.5 rounded-xl border border-earth-300 hover:bg-white text-earth-700 font-semibold text-xs flex items-center gap-2 transition-all"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Open Raw
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
