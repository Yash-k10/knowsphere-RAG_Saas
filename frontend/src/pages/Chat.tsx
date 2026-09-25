import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MessageSquare,
  Plus,
  Send,
  Sparkles,
  FileText,
  Trash2,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Loader2,
  Bot,
  User as UserIcon,
  HelpCircle,
  ExternalLink
} from 'lucide-react';
import { chatApi } from '../services/api';
import { Conversation, Message, SourceCitation } from '../types';
import { useAuth } from '../context/AuthContext';
import { FormattedMessage } from '../components/FormattedMessage';

export const Chat: React.FC = () => {
  const navigate = useNavigate();
  const { activeWorkspace } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const fetchConversations = async () => {
    try {
      const data = await chatApi.listConversations();
      setConversations(data);
      if (data.length > 0 && !activeConvId) {
        loadConversation(data[0].id);
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, [activeWorkspace?.id]);

  const loadConversation = async (convId: string) => {
    try {
      setLoadingHistory(true);
      setActiveConvId(convId);
      const data = await chatApi.getConversation(convId);
      setMessages(data.messages || []);
    } catch (err) {
      console.error('Failed to load conversation history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleNewChat = () => {
    setActiveConvId(null);
    setMessages([]);
    setInputText('');
  };

  const handleDeleteConversation = async (e: React.MouseEvent, convId: string) => {
    e.stopPropagation();
    try {
      await chatApi.deleteConversation(convId);
      setConversations((prev) => prev.filter((c) => c.id !== convId));
      if (activeConvId === convId) {
        handleNewChat();
      }
    } catch (err) {
      alert('Failed to delete conversation');
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isLoading) return;

    const userText = inputText.trim();
    setInputText('');

    // Optimistic user message
    const tempUserMsg: Message = {
      id: 'temp-' + Date.now(),
      conversation_id: activeConvId || '',
      role: 'user',
      content: userText,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);
    setIsLoading(true);

    try {
      const res = await chatApi.sendMessage({
        conversation_id: activeConvId || undefined,
        message: userText,
      });

      // Update active conversation ID if newly created
      if (!activeConvId) {
        setActiveConvId(res.conversation_id);
        fetchConversations();
      }

      const assistantMsg: Message = {
        id: res.message_id,
        conversation_id: res.conversation_id,
        role: 'assistant',
        content: res.answer,
        sources_meta: res.sources,
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: Message = {
        id: 'err-' + Date.now(),
        conversation_id: activeConvId || '',
        role: 'assistant',
        content: `Error: ${err.response?.data?.detail || 'Failed to generate response. Please check server logs.'}`,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSourceExpand = (sourceKey: string) => {
    setExpandedSources((prev) => ({
      ...prev,
      [sourceKey]: !prev[sourceKey],
    }));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex rounded-3xl overflow-hidden border border-earth-200 bg-white shadow-sm font-sans">
      {/* Conversations Left Rail */}
      <aside className="w-64 border-r border-earth-100 flex flex-col bg-earth-50/50 shrink-0">
        <div className="p-3.5 border-b border-earth-100">
          <button
            onClick={handleNewChat}
            className="w-full py-2 px-3 rounded-xl bg-sage-600 hover:bg-sage-700 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Chat</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-earth-400">
            Recent Conversations
          </div>
          {conversations.length === 0 ? (
            <p className="px-2 py-4 text-xs text-earth-400 text-center">No chats yet</p>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => loadConversation(conv.id)}
                className={`group px-3 py-2 rounded-xl text-xs flex items-center justify-between cursor-pointer transition-all ${
                  conv.id === activeConvId
                    ? 'bg-sage-100 text-forest-900 font-semibold'
                    : 'text-earth-600 hover:bg-earth-100 hover:text-forest-900'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <MessageSquare className="w-3.5 h-3.5 shrink-0 text-sage-600" />
                  <span className="truncate">{conv.title}</span>
                </div>
                <button
                  onClick={(e) => handleDeleteConversation(e, conv.id)}
                  title="Delete conversation"
                  className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-600 transition-opacity"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Main Chat Panel */}
      <div className="flex-1 flex flex-col min-w-0 bg-white">
        {/* Chat Messages Stream */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {messages.length === 0 && !isLoading ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto p-6">
              <div className="w-14 h-14 rounded-2xl bg-sage-50 text-sage-700 flex items-center justify-center mb-4">
                <Sparkles className="w-7 h-7 text-sage-600" />
              </div>
              <h3 className="text-lg font-bold text-forest-900">
                Ask {activeWorkspace?.name || 'KnowSphere'}
              </h3>
              <p className="text-xs text-earth-600 mt-1.5 leading-relaxed">
                Ask questions about your uploaded documents. Answers are synthesized using semantic vector search and isolated directly to your organization.
              </p>
              <div className="mt-6 grid grid-cols-1 gap-2 w-full text-left">
                <button
                  onClick={() => {
                    setInputText("What are the key policies described in our documents?");
                  }}
                  className="p-2.5 rounded-xl border border-earth-200 text-xs text-forest-800 hover:bg-earth-50 transition-colors flex items-center justify-between"
                >
                  <span>"What are the key policies described in our documents?"</span>
                  <Sparkles className="w-3.5 h-3.5 text-sage-500" />
                </button>
                <button
                  onClick={() => {
                    setInputText("What is the leave entitlement and working hours policy?");
                  }}
                  className="p-2.5 rounded-xl border border-earth-200 text-xs text-forest-800 hover:bg-earth-50 transition-colors flex items-center justify-between"
                >
                  <span>"What is the leave entitlement and working hours policy?"</span>
                  <Sparkles className="w-3.5 h-3.5 text-sage-500" />
                </button>
              </div>
            </div>
          ) : (
            messages.map((msg, idx) => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={msg.id || idx}
                  className={`flex gap-3 max-w-3xl ${isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
                >
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold ${
                      isUser
                        ? 'bg-earth-200 text-forest-900'
                        : 'bg-sage-600 text-white shadow-sm shadow-sage-200'
                    }`}
                  >
                    {isUser ? <UserIcon className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>

                  <div className="space-y-3 min-w-0 max-w-2xl">
                    {/* Message Bubble */}
                    <div
                      className={`p-4 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                        isUser
                          ? 'bg-sage-600 text-white shadow-sm'
                          : 'bg-earth-50 text-forest-900 border border-earth-200'
                      }`}
                    >
                      <FormattedMessage content={msg.content} isUser={isUser} />
                    </div>

                    {/* Sources Attribution Rail */}
                    {!isUser && msg.sources_meta && msg.sources_meta.length > 0 && (
                      <div className="space-y-2 pt-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-sage-700">
                            <FileText className="w-3.5 h-3.5" />
                            <span>Knowledge Base Sources ({msg.sources_meta.length})</span>
                          </div>
                          <button
                            onClick={() => navigate('/knowledge-base')}
                            className="text-[11px] font-medium text-sage-600 hover:text-sage-800 flex items-center gap-1 transition-colors"
                          >
                            <span>Open Knowledge Base</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {msg.sources_meta.map((source: SourceCitation, sIdx: number) => {
                            const sourceKey = `${msg.id}-${sIdx}`;
                            const isExpanded = !!expandedSources[sourceKey];
                            return (
                              <div
                                key={sIdx}
                                className="p-3 rounded-xl border border-earth-200 bg-white shadow-2xs hover:border-sage-400 transition-colors"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0 flex-1">
                                    <button
                                      onClick={() => navigate('/knowledge-base')}
                                      className="font-semibold text-xs text-forest-900 hover:text-sage-700 text-left truncate flex items-center gap-1 group w-full"
                                      title="Open in Knowledge Base"
                                    >
                                      <span className="truncate">📄 {source.document_name}</span>
                                      <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 text-sage-600 shrink-0 transition-opacity" />
                                    </button>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      {source.page && (
                                        <span className="text-[10px] text-earth-500 font-medium">
                                          Page {source.page}
                                        </span>
                                      )}
                                      <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-sage-50 text-sage-700 font-mono font-medium">
                                        {(source.similarity * 100).toFixed(0)}% match
                                      </span>
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => toggleSourceExpand(sourceKey)}
                                    className="p-1 text-earth-400 hover:text-earth-600 rounded"
                                    title="Toggle excerpt"
                                  >
                                    {isExpanded ? (
                                      <ChevronUp className="w-3.5 h-3.5" />
                                    ) : (
                                      <ChevronDown className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                </div>
                                {isExpanded && (
                                  <div className="mt-2 pt-2 border-t border-earth-100 text-[11px] text-earth-600 italic bg-earth-50/70 p-2 rounded-lg">
                                    "{source.snippet}"
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* General AI Knowledge Attribution */}
                    {!isUser && (!msg.sources_meta || msg.sources_meta.length === 0) && (
                      <div className="flex items-center gap-1.5 text-[11px] font-medium text-earth-500 pt-0.5">
                        <Sparkles className="w-3.5 h-3.5 text-sage-600 shrink-0" />
                        <span>Answered using General AI Knowledge (Not found in organization documents)</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {isLoading && (
            <div className="flex gap-3 max-w-3xl mr-auto">
              <div className="w-8 h-8 rounded-xl bg-sage-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                <Bot className="w-4 h-4" />
              </div>
              <div className="p-4 rounded-2xl bg-earth-50 border border-earth-200 text-xs text-forest-800 flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-sage-600 animate-spin" />
                <span>Searching isolated vector chunks & synthesizing grounded answer...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-4 border-t border-earth-100 bg-white">
          <form onSubmit={handleSendMessage} className="relative flex items-center">
            <textarea
              rows={1}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question about your organization's documents... (Press Enter to send)"
              className="w-full pr-14 pl-4 py-3 rounded-2xl border border-earth-200 bg-earth-50/40 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-sage-500 focus:bg-white resize-none transition-all placeholder:text-earth-400"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || isLoading}
              className="absolute right-2.5 w-9 h-9 rounded-xl bg-sage-600 hover:bg-sage-700 text-white flex items-center justify-center transition-colors disabled:opacity-40"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
          <div className="mt-2 flex items-center justify-between text-[11px] text-earth-400 px-1">
            <span>Tenant isolation boundary enforced. Only documents in {activeWorkspace?.name} are queried.</span>
            <span>Powered by Local Embeddings + Gemini</span>
          </div>
        </div>
      </div>
    </div>
  );
};
