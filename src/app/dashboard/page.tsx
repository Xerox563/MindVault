"use client";

import { useAuth, useUser, SignOutButton } from "@clerk/nextjs";
import ReactMarkdown from "react-markdown";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Upload, FileText, X, Cloud, Brain, Menu, ChevronRight, Search, Plus,
  MoreHorizontal, ChevronDown, Check, Cpu, HardDrive, FileSpreadsheet,
  FileIcon, ScrollText, ChevronUp, Loader2, AlertCircle, Zap, Settings, Key,
  Trash2, RefreshCw, Link2, Sparkles, DollarSign, Table, Hash, FileJson,
  Copy, CopyCheck, ArrowDown, SquarePen, SendHorizontal, Quote, History,
  Users, UserPlus, Crown, Eye, Pencil
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useTheme } from "@/components/ThemeProvider";
import { GradientText } from "@/components/animations";
import DocumentViewer from "@/components/DocumentViewer";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const WS_URL = API_URL.replace(/^http/, "ws");

interface FileItem { id: number; filename: string; file_type: string; file_size: number; uploaded_at?: string; source_type?: string; source?: string; processing_status?: string; processing_progress?: number; processing_total?: number; processing_error?: string | null; }
interface Message { id: string; role: "user" | "assistant"; content: string; streaming?: boolean; sources?: Source[]; timestamp?: string; fromCache?: boolean; cacheHits?: number; }
interface Source { filename?: string; file_name?: string; page?: string; file_id?: number; chunk_id?: number; content?: string; source_type?: string; source?: string; }
interface LLMProvider { id: string; name: string; type: "cloud" | "local"; model: string; available: boolean; }
interface Integration { id: string; name: string; description: string; icon: string; connected: boolean; }
interface ApiKeyStatus { provider: string; configured: boolean; source: "user" | "server" | "none"; }
interface DriveFile { id: string; name: string; mimeType: string; synced?: boolean; }
interface ChatHistoryItem { id: number; question: string; answer: string; created_at: string; }
interface WorkspaceSummary { id: number; name: string; role: "owner" | "editor" | "viewer"; member_count: number; }
interface WorkspaceMemberItem { id: number; email: string; role: string; status: string; }

const PROVIDER_LABELS: Record<string, string> = { mistral: "Mistral AI", ollama: "Ollama", gemini: "Google Gemini", openrouter: "OpenRouter" };
const base_provider_client = (providerId: string) => {
  for (const prefix of ["ollama", "mistral", "gemini", "openrouter"]) {
    if (providerId === prefix || providerId.startsWith(`${prefix}-`)) return prefix;
  }
  return providerId;
};
const SOURCE_ICONS: Record<string, React.ElementType> = { local: FileIcon, drive: Cloud, sheets: Table, slack: Hash, notion: FileJson };
const SOURCE_COLORS: Record<string, string> = { local: "text-gray-400", drive: "text-blue-400", sheets: "text-green-400", slack: "text-purple-400", notion: "text-yellow-400" };
const INTEGRATION_ICONS: Record<string, React.ElementType> = { google_drive: Cloud, google_sheets: Table, slack: Hash, notion: FileJson };
const INTEGRATION_COLORS: Record<string, string> = { google_drive: "text-blue-400", google_sheets: "text-green-400", slack: "text-purple-400", notion: "text-yellow-400" };

const FileTypeIcon = ({ type, className = "" }: { type: string; className?: string }) => {
  if (type?.includes('pdf')) return <FileText className={`${className} text-red-400`} />;
  if (type?.includes('xlsx') || type?.includes('csv')) return <FileSpreadsheet className={`${className} text-green-400`} />;
  if (type?.includes('doc') || type?.includes('docx')) return <ScrollText className={`${className} text-blue-400`} />;
  return <FileIcon className={`${className} text-gray-400`} />;
};

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return "0 KB";
  const k = 1024; const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
};

const formatDate = (dateStr?: string) => {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[date.getMonth()]} ${date.getDate()}`;
};

const formatDateTime = (dateStr: string) => {
  const date = new Date(dateStr);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const time = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return isToday ? `Today, ${time}` : `${formatDate(dateStr)}, ${time}`;
};

const getCurrentTime = () => {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const formattedHours = hours % 12 || 12;
  const formattedMinutes = minutes.toString().padStart(2, '0');
  return `${formattedHours}:${formattedMinutes} ${ampm}`;
};

export default function Dashboard() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const { theme } = useTheme();
  
  const [files, setFiles] = useState<FileItem[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showAllFiles, setShowAllFiles] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [providers, setProviders] = useState<LLMProvider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<LLMProvider | null>(null);
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [showIntegrations, setShowIntegrations] = useState(false);
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([]);
  const [driveFilesLoading, setDriveFilesLoading] = useState(false);
  const [syncingFileId, setSyncingFileId] = useState<string | null>(null);
  const [connectingDrive, setConnectingDrive] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [apiKeys, setApiKeys] = useState<ApiKeyStatus[]>([]);
  const [embeddingModels, setEmbeddingModels] = useState<LLMProvider[]>([]);
  const [currentEmbeddingProvider, setCurrentEmbeddingProvider] = useState<string | null>(null);
  const [embeddingModelsLoading, setEmbeddingModelsLoading] = useState(false);
  const [savingEmbeddingProvider, setSavingEmbeddingProvider] = useState(false);
  const [apiKeyInputs, setApiKeyInputs] = useState<Record<string, string>>({});
  const [savingProvider, setSavingProvider] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [viewerFile, setViewerFile] = useState<{ fileName: string; content: string; loading: boolean; highlight?: string } | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<number | null>(null);
  const [showWorkspaceSwitcher, setShowWorkspaceSwitcher] = useState(false);
  const [showWorkspacePanel, setShowWorkspacePanel] = useState(false);
  const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMemberItem[]>([]);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"editor" | "viewer">("viewer");
  const [workspaceBusy, setWorkspaceBusy] = useState(false);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const activeStream = useRef<AbortController | null>(null);
  const watchedFileIds = useRef<Set<number>>(new Set());

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const nearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 120;
    if (nearBottom) scrollToBottom();
  }, [messages]);

  const handleScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    setShowScrollButton(distanceFromBottom > 240);
  };

  useEffect(() => () => activeStream.current?.abort(), []);

  const copyMessage = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1500);
    } catch { /* clipboard unavailable */ }
  };

  const startNewChat = () => {
    activeStream.current?.abort();
    setMessages([]);
    setInputMessage("");
  };

  const autoResizeTextarea = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  };

  useEffect(() => {
    autoResizeTextarea();
  }, [inputMessage]);

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      fetchFiles();
      fetchLLMStatus();
      fetchIntegrations();
      fetchWorkspaces();
    }
  }, [isLoaded, isSignedIn]);

  useEffect(() => {
    const handleDriveMessage = (event: MessageEvent) => {
      if (event.data === "google-drive-connected") fetchIntegrations();
    };
    window.addEventListener("message", handleDriveMessage);
    return () => window.removeEventListener("message", handleDriveMessage);
  }, []);

  const getAuthToken = async () => await getToken();

  const fetchFiles = async () => {
    const token = await getAuthToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/files`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data: FileItem[] = await res.json();
        setFiles(data);
        // pick up watching any file still being indexed from a previous session (e.g. tab reload mid-upload)
        for (const f of data) {
          if ((f.processing_status === "pending" || f.processing_status === "processing") && !watchedFileIds.current.has(f.id)) {
            watchedFileIds.current.add(f.id);
            watchFileProgress(f.id, token);
          }
        }
      }
    } catch (error) { console.error("Failed to fetch files:", error); }
  };

  const fetchLLMStatus = async () => {
    const token = await getAuthToken();
    if (!token) return;
    setModelsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/llm/status`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        const availableProviders = data.providers || [];
        setProviders(availableProviders);
        if (availableProviders.length > 0) {
          const defaultProvider = availableProviders.find((p: LLMProvider) => p.id === data.current_provider) || availableProviders[0];
          setSelectedProvider(defaultProvider);
        }
      }
    } catch (error) { console.error("Failed to fetch LLM status:", error); }
    finally { setModelsLoading(false); }
  };

  const setLLMProvider = async (providerId: string) => {
    const token = await getAuthToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/llm/set-provider/${providerId}`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const provider = providers.find(p => p.id === providerId);
        if (provider) setSelectedProvider(provider);
      }
    } catch (error) { console.error("Failed to set provider:", error); }
  };

  const fetchIntegrations = async () => {
    const token = await getAuthToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/integrations`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        console.log("Integrations:", data);
        setIntegrations(data);
      } else {
        console.error("Failed to fetch integrations:", res.status);
      }
    } catch (error) { console.error("Failed to fetch integrations:", error); }
  };

  const fetchWorkspaces = async () => {
    const token = await getAuthToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/workspaces`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setWorkspaces(data.workspaces || []);
        setActiveWorkspaceId(data.active_workspace_id ?? null);
      }
    } catch (error) { console.error("Failed to fetch workspaces:", error); }
  };

  const createWorkspace = async () => {
    const name = newWorkspaceName.trim();
    if (!name) return;
    const token = await getAuthToken();
    if (!token) return;
    setWorkspaceBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/workspaces`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        setNewWorkspaceName("");
        await fetchWorkspaces();
        await fetchFiles();
        setMessages([]);
      } else {
        const error = await res.json().catch(() => ({}));
        alert(error.detail || "Failed to create workspace");
      }
    } catch (error) { console.error("Failed to create workspace:", error); }
    finally { setWorkspaceBusy(false); }
  };

  const switchWorkspace = async (workspaceId: number | null) => {
    const token = await getAuthToken();
    if (!token) return;
    setShowWorkspaceSwitcher(false);
    try {
      const res = await fetch(`${API_URL}/api/workspaces/switch`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ workspace_id: workspaceId }),
      });
      if (res.ok) {
        setActiveWorkspaceId(workspaceId);
        setMessages([]);
        await fetchFiles();
      }
    } catch (error) { console.error("Failed to switch workspace:", error); }
  };

  const openWorkspacePanel = async () => {
    setShowWorkspaceSwitcher(false);
    setShowWorkspacePanel(true);
    if (activeWorkspaceId) await fetchWorkspaceMembers(activeWorkspaceId);
  };

  const fetchWorkspaceMembers = async (workspaceId: number) => {
    const token = await getAuthToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/workspaces/${workspaceId}/members`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setWorkspaceMembers(await res.json());
    } catch (error) { console.error("Failed to fetch workspace members:", error); }
  };

  const inviteToWorkspace = async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!email || !activeWorkspaceId) return;
    const token = await getAuthToken();
    if (!token) return;
    setWorkspaceBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/workspaces/${activeWorkspaceId}/invite`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email, role: inviteRole }),
      });
      if (res.ok) {
        setInviteEmail("");
        await fetchWorkspaceMembers(activeWorkspaceId);
        await fetchWorkspaces();
      } else {
        const error = await res.json().catch(() => ({}));
        alert(error.detail || "Failed to invite member");
      }
    } catch (error) { console.error("Failed to invite member:", error); }
    finally { setWorkspaceBusy(false); }
  };

  const removeWorkspaceMember = async (memberId: number) => {
    if (!activeWorkspaceId) return;
    const token = await getAuthToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/workspaces/${activeWorkspaceId}/members/${memberId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        await fetchWorkspaceMembers(activeWorkspaceId);
        await fetchWorkspaces();
      }
    } catch (error) { console.error("Failed to remove member:", error); }
  };

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) || null;
  const canManageFiles = !activeWorkspace || activeWorkspace.role !== "viewer";

  const fetchDriveFiles = async () => {
    const token = await getAuthToken();
    if (!token) return;
    setDriveFilesLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/drive/files`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setDriveFiles(await res.json());
    } catch (error) { console.error("Failed to fetch Drive files:", error); }
    finally { setDriveFilesLoading(false); }
  };

  const connectIntegration = async (integrationId: string) => {
    console.log("Connecting integration:", integrationId);
    const token = await getAuthToken();
    if (!token) { console.log("No token"); alert("Not authenticated"); return; }
    setConnectingDrive(true);
    let url = "";
    try {
      if (integrationId === "google_drive" || integrationId === "google_sheets") {
        const res = await fetch(`${API_URL}/api/auth/google/connect`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        url = data.auth_url;
      } else if (integrationId === "slack") {
        const res = await fetch(`${API_URL}/api/integrations/connect/slack`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        url = data.install_url;
      } else if (integrationId === "notion") {
        const res = await fetch(`${API_URL}/api/integrations/connect/notion`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        url = data.auth_url;
      }
      console.log("Got URL:", url);
      if (url) {
        const popup = window.open(url, "integration-connect", "width=500,height=700");
        if (!popup) alert("Popup blocked! Please allow popups for this site.");
      } else {
        alert("No URL returned from server");
      }
    } catch (error) { console.error("Failed:", error); alert("Error: " + error); }
    finally { setConnectingDrive(false); }
  };

  const connectGoogleDrive = async () => connectIntegration("google_drive");

  const syncDriveFile = async (fileId: string) => {
    const token = await getAuthToken();
    if (!token) return;
    setSyncingFileId(fileId);
    try {
      const res = await fetch(`${API_URL}/api/sync/drive/${fileId}`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) fetchFiles();
      else { const error = await res.json(); alert(error.detail || "Failed to sync file"); }
    } catch (error) { console.error("Failed to sync Drive file:", error); }
    finally { setSyncingFileId(null); }
  };

  const fetchApiKeys = async () => {
    const token = await getAuthToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/settings/api-keys`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setApiKeys(await res.json());
    } catch (error) { console.error("Failed to fetch API keys:", error); }
  };

  const saveApiKey = async (provider: string) => {
    const token = await getAuthToken();
    const apiKey = apiKeyInputs[provider]?.trim();
    if (!token || !apiKey) return;
    setSavingProvider(provider);
    try {
      const res = await fetch(`${API_URL}/api/settings/api-keys`, {
        method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ provider, api_key: apiKey }),
      });
      if (res.ok) {
        setApiKeyInputs((prev) => ({ ...prev, [provider]: "" }));
        await fetchApiKeys();
        await fetchLLMStatus();
        await fetchEmbeddingStatus();
      } else { const error = await res.json(); alert(error.detail || "Failed to save API key"); }
    } catch (error) { console.error("Failed to save API key:", error); }
    finally { setSavingProvider(null); }
  };

  const removeApiKey = async (provider: string) => {
    const token = await getAuthToken();
    if (!token) return;
    setSavingProvider(provider);
    try {
      const res = await fetch(`${API_URL}/api/settings/api-keys/${provider}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { await fetchApiKeys(); await fetchLLMStatus(); await fetchEmbeddingStatus(); }
    } catch (error) { console.error("Failed to remove API key:", error); }
    finally { setSavingProvider(null); }
  };

  const fetchEmbeddingStatus = async () => {
    const token = await getAuthToken();
    if (!token) return;
    setEmbeddingModelsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/llm/embedding-status`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setEmbeddingModels(data.providers || []);
        setCurrentEmbeddingProvider(data.current_provider ?? null);
      }
    } catch (error) { console.error("Failed to fetch embedding status:", error); }
    finally { setEmbeddingModelsLoading(false); }
  };

  const setEmbeddingProvider = async (providerId: string) => {
    const token = await getAuthToken();
    if (!token) return;
    setSavingEmbeddingProvider(true);
    try {
      const res = await fetch(`${API_URL}/api/llm/set-embedding-provider/${encodeURIComponent(providerId)}`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setCurrentEmbeddingProvider(providerId);
    } catch (error) { console.error("Failed to set embedding provider:", error); }
    finally { setSavingEmbeddingProvider(false); }
  };

  const openSettings = () => { setShowSettings(true); fetchApiKeys(); fetchEmbeddingStatus(); };
  const openIntegrations = () => { setShowIntegrations(true); if (integrations.find((i) => i.id === "google_drive")?.connected) fetchDriveFiles(); };

  const handleUpload = async (file: File) => {
    const token = await getAuthToken();
    if (!token) { alert("Please sign in first"); return; }
    const validTypes = ['.pdf', '.docx', '.txt', '.csv', '.xlsx', '.md'];
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!validTypes.includes(ext)) { alert(`Invalid file type. Allowed: ${validTypes.join(', ')}`); return; }
    
    setUploading(true);
    setUploadProgress(0);
    const formData = new FormData();
    formData.append("uploaded_file", file);

    try {
      const res = await fetch(`${API_URL}/api/upload`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: formData });
      if (res.ok) {
        const uploaded = await res.json();
        setUploading(false);
        setUploadProgress(0);
        watchedFileIds.current.add(uploaded.id);
        watchFileProgress(uploaded.id, token);
        await fetchFiles(); // shows the new file immediately with a "queued" state
      } else {
        const error = await res.json();
        alert(error.detail || "Upload failed");
        setUploading(false);
      }
    } catch (error) { console.error("Upload failed:", error); alert("Upload failed. Please try again."); setUploading(false); }
  };

  const watchFileProgress = (fileId: number, token: string) => {
    const ws = new WebSocket(`${WS_URL}/ws/files/${fileId}/progress?token=${encodeURIComponent(token)}`);
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.status === "ping") return;
      if (data.status === "processing") {
        setFiles((prev) => prev.map((f) => f.id === fileId ? { ...f, processing_status: "processing", processing_progress: data.progress, processing_total: data.total } : f));
      } else if (data.status === "complete" || data.status === "error") {
        setFiles((prev) => prev.map((f) => f.id === fileId ? { ...f, processing_status: data.status, processing_progress: data.progress ?? f.processing_progress, processing_total: data.total ?? f.processing_total, processing_error: data.message } : f));
        ws.close();
      }
    };
    ws.onerror = () => ws.close();
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;
    const userMessage: Message = { id: Date.now().toString(), role: "user", content: inputMessage, timestamp: getCurrentTime() };
    setMessages((prev) => [...prev, userMessage]);
    setInputMessage("");
    setIsLoading(true);

    const assistantId = (Date.now() + 1).toString();
    let sources: Source[] = [];
    let started = false;
    const controller = new AbortController();
    activeStream.current = controller;

    const addAssistantMessage = (text: string) => {
      setIsLoading(false);
      setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: text, timestamp: getCurrentTime() }]);
    };

    try {
      const token = await getAuthToken();
      const res = await fetch(`${API_URL}/api/ask/stream`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ question: userMessage.content }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const error = await res.json().catch(() => ({}));
        addAssistantMessage(`Error: ${error.detail || "Failed to get response"}`);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() || "";

        for (const raw of events) {
          const line = raw.trim();
          if (!line.startsWith("data:")) continue;
          const event = JSON.parse(line.slice(5).trim());

          if (event.type === "sources") {
            sources = event.sources;
          } else if (event.type === "chunk") {
            if (!started) {
              started = true;
              setIsLoading(false);
              setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: event.text, streaming: true, timestamp: getCurrentTime() }]);
            } else {
              setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, content: m.content + event.text } : m));
            }
          } else if (event.type === "error") {
            addAssistantMessage(`Error: ${event.message}`);
          } else if (event.type === "done") {
            setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, streaming: false, sources, fromCache: event.from_cache, cacheHits: event.cache_hits } : m));
          }
        }
      }
    } catch (error) {
      if ((error as Error).name === "AbortError") return;
      console.error("Chat failed:", error);
      addAssistantMessage("Sorry, I couldn't process your request. Please try again.");
    } finally {
      setIsLoading(false);
      activeStream.current = null;
    }
  };

  const getSourceIcon = (sourceType?: string) => {
    const s = sourceType || "local";
    const Icon = SOURCE_ICONS[s] || FileIcon;
    return { Icon, color: SOURCE_COLORS[s] || "text-gray-400" };
  };

  const openSourceViewer = async (source: Source) => {
    const fileName = source.file_name || source.filename || "Document";
    if (!source.file_id) {
      setViewerFile({ fileName, content: "", loading: false, highlight: source.content });
      return;
    }
    setViewerFile({ fileName, content: "", loading: true, highlight: source.content });
    const token = await getAuthToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/files/${source.file_id}/content`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setViewerFile({ fileName: data.filename || fileName, content: data.content || "", loading: false, highlight: source.content });
      } else {
        setViewerFile({ fileName, content: "", loading: false, highlight: source.content });
      }
    } catch (error) {
      console.error("Failed to load file content:", error);
      setViewerFile({ fileName, content: "", loading: false, highlight: source.content });
    }
  };

  const openHistory = async () => {
    setShowHistory(true);
    setHistoryLoading(true);
    const token = await getAuthToken();
    if (!token) { setHistoryLoading(false); return; }
    try {
      const res = await fetch(`${API_URL}/api/chat/history`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setChatHistory(await res.json());
    } catch (error) {
      console.error("Failed to fetch chat history:", error);
    } finally {
      setHistoryLoading(false);
    }
  };

  const loadHistoryItem = (item: ChatHistoryItem) => {
    activeStream.current?.abort();
    const time = formatDateTime(item.created_at);
    setMessages([
      { id: `h-${item.id}-q`, role: "user", content: item.question, timestamp: time },
      { id: `h-${item.id}-a`, role: "assistant", content: item.answer, timestamp: time },
    ]);
    setShowHistory(false);
  };

  if (!isLoaded) return (
    <div className={`min-h-screen ${theme === "dark" ? "bg-[#111111]" : "bg-slate-100"} flex items-center justify-center`}>
      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
        <Loader2 className="w-8 h-8 text-purple-500" />
      </motion.div>
    </div>
  );

  if (!isSignedIn) return (
    <div className={`min-h-screen ${theme === "dark" ? "bg-[#111111]" : "bg-slate-100"} flex flex-col items-center justify-center`}>
      <p className="text-white mb-4">Please sign in to access the dashboard</p>
      <Link href="/login"><button className="px-6 py-3 bg-purple-600 rounded-lg text-white font-medium hover:bg-purple-700">Sign In</button></Link>
    </div>
  );

  const bgColor = theme === "dark" ? "bg-[#111111]" : "bg-slate-100";
  const cardBg = theme === "dark" ? "bg-[#1a1a1a]" : "bg-white";
  const borderColor = theme === "dark" ? "border-white/10" : "border-slate-200";
  const inputBg = theme === "dark" ? "bg-[#1a1a1a]" : "bg-slate-50";
  const userMsgBg = theme === "dark" ? "bg-[#2d2d2d]" : "bg-purple-600";
  const textPrimary = theme === "dark" ? "text-white" : "text-slate-900";
  const textSecondary = theme === "dark" ? "text-gray-400" : "text-slate-600";
  const glassClass = theme === "dark" ? "glass" : "bg-white/80 backdrop-blur-md shadow-sm";

  return (
    <div className={`min-h-screen ${bgColor} ${textPrimary} flex`}>
      <AnimatePresence mode="wait">
        {sidebarOpen && (
          <motion.aside
            initial={{ x: -280, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -280, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className={`w-[280px] ${borderColor} border-r flex flex-col h-screen ${cardBg}`}
          >
            <div className={`p-4 ${borderColor} border-b`}>
              <Link href="/" className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
                  <Brain className="w-5 h-5 text-white" />
                </div>
                <span className="font-semibold text-lg">MindVault</span>
              </Link>

              <div className="relative">
                <button
                  onClick={() => setShowWorkspaceSwitcher((s) => !s)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg ${inputBg} ${borderColor} border hover:border-purple-500/30 transition-colors text-left`}
                >
                  <Users className="w-4 h-4 text-purple-400 shrink-0" />
                  <span className="flex-1 text-sm truncate">{activeWorkspace ? activeWorkspace.name : "Personal"}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                </button>

                <AnimatePresence>
                  {showWorkspaceSwitcher && (
                    <>
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowWorkspaceSwitcher(false)} className="fixed inset-0 z-40" />
                      <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className={`absolute left-0 top-full mt-2 w-full ${cardBg} border ${borderColor} rounded-xl z-50 overflow-hidden shadow-2xl`}>
                        <button onClick={() => switchWorkspace(null)} className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-white/5 transition-colors ${!activeWorkspaceId ? "text-purple-400" : "text-gray-300"}`}>
                          <FileIcon className="w-3.5 h-3.5 shrink-0" /><span className="flex-1 text-left">Personal</span>{!activeWorkspaceId && <Check className="w-3.5 h-3.5" />}
                        </button>
                        {workspaces.map((w) => (
                          <button key={w.id} onClick={() => switchWorkspace(w.id)} className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-white/5 transition-colors ${activeWorkspaceId === w.id ? "text-purple-400" : "text-gray-300"}`}>
                            <Users className="w-3.5 h-3.5 shrink-0" /><span className="flex-1 text-left truncate">{w.name}</span>
                            <span className="text-[10px] text-gray-500 uppercase">{w.role}</span>
                            {activeWorkspaceId === w.id && <Check className="w-3.5 h-3.5" />}
                          </button>
                        ))}
                        <div className={`border-t ${borderColor} p-2 space-y-1`}>
                          {activeWorkspace && (
                            <button onClick={openWorkspacePanel} className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
                              <UserPlus className="w-3.5 h-3.5" />Manage members
                            </button>
                          )}
                          <div className="flex items-center gap-1.5 px-1">
                            <input
                              type="text"
                              value={newWorkspaceName}
                              onChange={(e) => setNewWorkspaceName(e.target.value)}
                              onKeyDown={(e) => e.key === "Enter" && createWorkspace()}
                              placeholder="New workspace name"
                              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
                            />
                            <button onClick={createWorkspace} disabled={!newWorkspaceName.trim() || workspaceBusy} className="p-1.5 bg-purple-600 hover:bg-purple-700 rounded-lg disabled:opacity-50">
                              {workspaceBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {canManageFiles ? (
                <label className="block w-full cursor-pointer">
                  <input type="file" onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} className="hidden" accept=".pdf,.docx,.txt,.csv,.xlsx,.md" disabled={uploading} />
                  <motion.div whileHover={{ scale: uploading ? 1 : 1.02 }} whileTap={{ scale: uploading ? 1 : 0.98 }} className={`w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-purple-700 rounded-lg flex items-center justify-center gap-2 mb-2 ${uploading ? 'opacity-50' : ''}`}>
                    {uploading ? <><Loader2 className="w-4 h-4 animate-spin" /><span className="font-medium">Uploading... {uploadProgress}%</span></> : <><Upload className="w-4 h-4" /><span className="font-medium">Upload Files</span></>}
                  </motion.div>
                </label>
              ) : (
                <div className="w-full py-3 px-4 bg-white/5 rounded-lg flex items-center justify-center gap-2 mb-2 text-gray-500">
                  <Eye className="w-4 h-4" /><span className="text-sm">View-only access</span>
                </div>
              )}
              <p className="text-xs text-gray-500 text-center mb-6">PDF, DOCX, TXT, CSV, XLSX, MD</p>

              <div className="relative mb-6">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input type="text" placeholder="Search files" className={`w-full ${inputBg} ${borderColor} border rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50`} />
              </div>

              <div className="mb-4">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Your Files</h3>
                <p className="text-xs text-gray-500">{files.length} files available to AI</p>
              </div>

              <div className="space-y-1">
                {(showAllFiles ? files : files.slice(0, 8)).map((file) => {
                  const { Icon, color } = getSourceIcon(file.source_type || file.source);
                  const isIndexing = file.processing_status === "pending" || file.processing_status === "processing";
                  return (
                    <motion.div key={file.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="group flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer">
                      <FileTypeIcon type={file.file_type} className="w-5 h-5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{file.filename}</p>
                        {isIndexing ? (
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <Loader2 className="w-3 h-3 text-purple-400 animate-spin shrink-0" />
                            <span className="text-xs text-purple-400">
                              {file.processing_status === "pending" || !file.processing_total ? "Queued..." : `Indexing ${file.processing_progress}/${file.processing_total}`}
                            </span>
                          </div>
                        ) : file.processing_status === "error" ? (
                          <p className="text-xs text-red-400 truncate" title={file.processing_error || undefined}>Indexing failed</p>
                        ) : (
                          <p className="text-xs text-gray-500">{formatFileSize(file.file_size)} • {formatDate(file.uploaded_at)}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1"><Icon className={`w-3 h-3 ${color}`} /><button className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/10 rounded"><MoreHorizontal className="w-4 h-4 text-gray-400" /></button></div>
                    </motion.div>
                  );
                })}
              </div>

              {files.length > 8 && (<button onClick={() => setShowAllFiles(!showAllFiles)} className="flex items-center gap-1 text-sm text-gray-400 hover:text-white mt-4">{showAllFiles ? <><ChevronUp className="w-4 h-4" /> Show less</> : <><ChevronRight className="w-4 h-4" /> View all files</>}</button>)}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className={`h-14 ${borderColor} border-b flex items-center justify-between px-4 ${cardBg}/80 backdrop-blur-md`}>
          <div className="flex items-center gap-1">
            <motion.button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-white/10 rounded-lg transition-colors" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Menu className="w-5 h-5" />
            </motion.button>
            <AnimatePresence>
              {messages.length > 0 && (
                <motion.button
                  onClick={startNewChat}
                  initial={{ opacity: 0, width: 0, marginLeft: 0 }}
                  animate={{ opacity: 1, width: "auto", marginLeft: 4 }}
                  exit={{ opacity: 0, width: 0, marginLeft: 0 }}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors overflow-hidden whitespace-nowrap"
                  title="Start a new chat"
                >
                  <SquarePen className="w-4 h-4 shrink-0" />
                  <span>New chat</span>
                </motion.button>
              )}
            </AnimatePresence>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <motion.button onClick={openHistory} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} title="Chat history"><History className="w-5 h-5" /></motion.button>
            <Link href="/cost"><motion.button className="flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} title="Cost Monitoring"><DollarSign className="w-4 h-4" /><span className="hidden sm:inline">Costs</span></motion.button></Link>
            <motion.button onClick={openSettings} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} title="Settings"><Settings className="w-5 h-5" /></motion.button>
            <SignOutButton><button className="flex items-center gap-2 px-3 py-2 hover:bg-white/10 rounded-lg transition-colors">{user?.imageUrl ? <img src={user.imageUrl} alt="User" className="w-8 h-8 rounded-full" /> : <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-sm font-medium">{user?.firstName?.[0] || user?.emailAddresses?.[0]?.emailAddress?.[0] || "U"}</div>}</button></SignOutButton>
          </div>
        </header>

        <main className="flex-1 flex flex-col overflow-hidden relative">
          {/* Ambient depth glow behind the chat surface */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden -z-0">
            <motion.div
              className="absolute top-[-10%] left-1/3 w-[420px] h-[420px] rounded-full opacity-[0.08]"
              style={{ background: "radial-gradient(circle, #8b5cf6 0%, transparent 70%)", filter: "blur(90px)" }}
              animate={{ x: [0, 40, 0], y: [0, 20, 0] }}
              transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className="absolute bottom-[-10%] right-1/4 w-[380px] h-[380px] rounded-full opacity-[0.08]"
              style={{ background: "radial-gradient(circle, #06b6d4 0%, transparent 70%)", filter: "blur(90px)" }}
              animate={{ x: [0, -30, 0], y: [0, -20, 0] }}
              transition={{ duration: 16, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            />
          </div>

          {messages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center px-4 relative z-10">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-2xl">
                <motion.div
                  initial={{ scale: 0.6, opacity: 0, rotate: -8 }}
                  animate={{ scale: 1, opacity: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 200, damping: 14 }}
                  className="flex items-center justify-center gap-3 mb-6"
                >
                  <motion.div
                    animate={{ boxShadow: ["0 0 20px rgba(249,115,22,0.15)", "0 0 40px rgba(249,115,22,0.35)", "0 0 20px rgba(249,115,22,0.15)"] }}
                    transition={{ duration: 2.5, repeat: Infinity }}
                    className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center"
                  >
                    <Brain className="w-7 h-7 text-white" />
                  </motion.div>
                  <h1 className="text-4xl font-light">
                    Welcome to <GradientText>MindVault</GradientText>
                  </h1>
                </motion.div>
                <p className="text-xl text-gray-400 mb-8">How can I help you today?</p>
                <div className="grid grid-cols-2 gap-3 max-w-lg mx-auto">
                  {files.length > 0 ? ([
                    { label: "Summarize my documents", icon: FileText },
                    { label: "What are the key points?", icon: Sparkles },
                    { label: "Find information about...", icon: Search },
                    { label: "Compare these documents", icon: Table },
                  ].map((prompt, i) => (
                    <motion.button
                      key={prompt.label}
                      onClick={() => setInputMessage(prompt.label)}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15 + i * 0.06, duration: 0.35 }}
                      whileHover={{ y: -3, borderColor: "rgba(168,85,247,0.5)" }}
                      whileTap={{ scale: 0.98 }}
                      className="group p-4 text-left bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors"
                    >
                      <prompt.icon className="w-4 h-4 text-purple-400 mb-2 group-hover:scale-110 transition-transform" />
                      <p className="text-sm text-gray-300">{prompt.label}</p>
                    </motion.button>
                  ))) : (<div className="col-span-2 p-4 text-center text-gray-500">Upload files to start chatting with your documents</div>)}
                </div>
              </motion.div>
            </div>
          ) : (
            <div ref={messagesContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-4 py-6 relative z-10">
              {messages.map((message) => (
                <div key={message.id} className="mb-6 group/msg">
                  {message.role === "user" ? (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
                      className="flex justify-end mb-2"
                    >
                      <div className="max-w-[85%] md:max-w-[70%]">
                        <div className={`${userMsgBg} rounded-2xl rounded-tr-sm px-5 py-3 text-[15px] whitespace-pre-wrap shadow-lg shadow-black/10`}>{message.content}</div>
                        <div className="flex items-center justify-end gap-1.5 mt-1.5"><span className="text-xs text-gray-500">{message.timestamp}</span><Check className="w-3.5 h-3.5 text-gray-500" /></div>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="flex gap-3 max-w-[90%]">
                      <motion.div
                        animate={message.streaming ? { scale: [1, 1.12, 1] } : { scale: 1 }}
                        transition={{ duration: 1.1, repeat: message.streaming ? Infinity : 0 }}
                        className="shrink-0 w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/20"
                      >
                        <Sparkles className="w-4 h-4 text-white" />
                      </motion.div>
                      <div className="flex-1 min-w-0">
                        <div className={`${cardBg} rounded-2xl rounded-tl-sm px-5 py-4 ${borderColor} border`}>
                          <div className="text-[15px] leading-relaxed text-gray-200">
                            {message.streaming ? (
                              <p className="whitespace-pre-wrap mb-0">{message.content}<span className="stream-cursor text-purple-400" /></p>
                            ) : (
                              <ReactMarkdown components={{ p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>, h1: ({ children }) => <h1 className="text-lg font-semibold mt-3 mb-2 first:mt-0">{children}</h1>, h2: ({ children }) => <h2 className="text-base font-semibold mt-3 mb-2 first:mt-0">{children}</h2>, h3: ({ children }) => <h3 className="text-sm font-semibold mt-2 mb-1 first:mt-0">{children}</h3>, strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>, ul: ({ children }) => <ul className="list-disc pl-5 mb-3 space-y-1.5">{children}</ul>, ol: ({ children }) => <ol className="list-disc pl-5 mb-3 space-y-1.5">{children}</ol>, li: ({ children }) => <li className="text-gray-300">{children}</li>, code: ({ children }) => <code className="bg-white/10 px-1.5 py-0.5 rounded text-sm font-mono text-gray-300">{children}</code>, pre: ({ children }) => <pre className="bg-white/5 border border-white/10 rounded-lg p-3 overflow-x-auto mb-3 text-sm">{children}</pre>, a: ({ children, href }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">{children}</a> }}>{message.content}</ReactMarkdown>
                            )}
                          </div>
                        </div>
                        <div className="mt-1.5 flex items-center gap-3">
                          <span className="text-xs text-gray-500">{message.timestamp}</span>
                          {message.fromCache && (<span className="text-[10px] text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded flex items-center gap-1"><Zap className="w-3 h-3" />Cached{message.cacheHits && message.cacheHits > 1 && <span className="text-green-500">({message.cacheHits} hits)</span>}</span>)}
                          {!message.streaming && message.content && (
                            <button
                              onClick={() => copyMessage(message.id, message.content)}
                              className="opacity-0 group-hover/msg:opacity-100 flex items-center gap-1 text-xs text-gray-500 hover:text-white transition-all"
                              title="Copy response"
                            >
                              {copiedId === message.id ? <><CopyCheck className="w-3.5 h-3.5 text-green-400" /><span className="text-green-400">Copied</span></> : <><Copy className="w-3.5 h-3.5" />Copy</>}
                            </button>
                          )}
                        </div>
                        {message.sources && message.sources.length > 0 && !message.streaming && (
                          <div className="mt-4">
                            <p className="text-sm text-gray-400 mb-2 flex items-center gap-1.5"><Quote className="w-3.5 h-3.5" />Sources</p>
                            <div className="flex flex-wrap gap-2">
                              {message.sources.map((source, i) => {
                                const { Icon, color } = getSourceIcon(source.source_type || source.source);
                                return (
                                  <motion.button key={i} onClick={() => openSourceViewer(source)} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08, duration: 0.3 }} whileHover={{ y: -2 }} title={source.content} className={`flex items-center gap-2 px-3 py-2 ${cardBg} ${borderColor} border rounded-lg hover:border-purple-500/40 cursor-pointer transition-colors`}>
                                    <FileText className="w-4 h-4 text-gray-500 shrink-0" />
                                    <span className="text-sm text-gray-300 max-w-[160px] truncate">{source.file_name || source.filename}</span>
                                    <Icon className={`w-3 h-3 shrink-0 ${color}`} />
                                  </motion.button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </div>
              ))}
              <AnimatePresence>{isLoading && (<motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }} className="flex gap-3 mb-6"><div className="shrink-0 w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center"><Sparkles className="w-4 h-4 text-white" /></div><div className={`${cardBg} rounded-2xl rounded-tl-sm px-5 py-4 ${borderColor} border min-w-[200px]`}><div className="flex items-center gap-1.5"><motion.div className="w-2 h-2 bg-purple-500 rounded-full" animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.4, repeat: Infinity, delay: 0 }} /><motion.div className="w-2 h-2 bg-purple-500 rounded-full" animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.4, repeat: Infinity, delay: 0.2 }} /><motion.div className="w-2 h-2 bg-purple-500 rounded-full" animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.4, repeat: Infinity, delay: 0.4 }} /></div></div></motion.div>)}</AnimatePresence>
              <div ref={messagesEndRef} />
            </div>
          )}

          <AnimatePresence>
            {showScrollButton && messages.length > 0 && (
              <motion.button
                initial={{ opacity: 0, y: 10, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.9 }}
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => scrollToBottom()}
                className={`absolute bottom-4 left-1/2 -translate-x-1/2 z-20 w-9 h-9 rounded-full ${cardBg} ${borderColor} border shadow-lg flex items-center justify-center text-gray-300 hover:text-white`}
                title="Scroll to latest"
              >
                <ArrowDown className="w-4 h-4" />
              </motion.button>
            )}
          </AnimatePresence>

          <div className="p-4 relative z-10">
            <div className="max-w-3xl mx-auto">
              <div className="relative rounded-2xl">
                <AnimatePresence>
                  {inputMessage.trim().length > 0 && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 0.6 }}
                      exit={{ opacity: 0 }}
                      className="absolute -inset-[1.5px] rounded-2xl input-glow-border pointer-events-none"
                    />
                  )}
                </AnimatePresence>
                <div className={`relative ${inputBg} ${borderColor} border rounded-2xl transition-colors`}>
                <div className="flex items-end gap-2 p-2">
                  <div className="relative">
                    <motion.button onClick={openIntegrations} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="w-8 h-8 flex items-center justify-center border border-white/20 rounded-xl hover:bg-white/10 text-gray-400 shrink-0 mb-1" title="Integrations"><Plus className="w-4 h-4" /></motion.button>
                    <AnimatePresence>{showIntegrations && (<><motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowIntegrations(false)} className="fixed inset-0 bg-black/50 z-50" /><motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} className="absolute left-0 bottom-full mb-2 w-[420px] max-h-[500px] bg-[#1a1a1a] border border-white/10 rounded-2xl z-50 overflow-hidden shadow-2xl"><div className="p-4 border-b border-white/10 flex items-center justify-between"><h3 className="font-semibold">Integrations</h3><button onClick={() => setShowIntegrations(false)}><X className="w-4 h-4 text-gray-400" /></button></div><div className="p-4 max-h-[420px] overflow-y-auto space-y-4">{integrations.map((integration) => {
                      const IntIcon = INTEGRATION_ICONS[integration.id] || Cloud;
                      const intColor = INTEGRATION_COLORS[integration.id] || "text-blue-400";
                      return (
                      <div key={integration.id} className="border border-white/10 rounded-xl p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center">
                              <IntIcon className={`w-4 h-4 ${intColor}`} />
                            </div>
                            <div>
                              <p className="font-medium text-sm">{integration.name}</p>
                              <p className="text-xs text-gray-500">{integration.description}</p>
                            </div>
                          </div>
                          {integration.connected ? (
                            <span className="text-xs text-green-400 flex items-center gap-1 shrink-0">
                              <Check className="w-3 h-3" />Connected
                            </span>
                          ) : (
                            <motion.button
                              onClick={() => connectIntegration(integration.id)}
                              disabled={connectingDrive}
                              whileHover={{ scale: 1.02 }}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-purple-600 hover:bg-purple-700 rounded-lg disabled:opacity-50 shrink-0"
                            >
                              {connectingDrive ? <Loader2 className="w-3 h-3 animate-spin" /> : <Link2 className="w-3 h-3" />}
                              Connect
                            </motion.button>
                          )}
                        </div>
                        {integration.connected && integration.id === "google_drive" && (
                          <div className="mt-3 space-y-1">
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-xs text-gray-500">Files in your Drive</p>
                              <button onClick={fetchDriveFiles} className="text-gray-500 hover:text-white">
                                <RefreshCw className={`w-3 h-3 ${driveFilesLoading ? "animate-spin" : ""}`} />
                              </button>
                            </div>
                            {driveFilesLoading ? (
                              <div className="flex justify-center py-3">
                                <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
                              </div>
                            ) : driveFiles.length === 0 ? (
                              <p className="text-xs text-gray-500 py-2">No files found</p>
                            ) : (
                              driveFiles.map((file) => (
                                <div key={file.id} className="flex items-center gap-2 p-2 bg-white/5 rounded-lg">
                                  <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                                  <span className="flex-1 text-sm truncate">{file.name}</span>
                                  <button
                                    onClick={() => syncDriveFile(file.id)}
                                    disabled={syncingFileId === file.id}
                                    className="text-xs px-2 py-1 bg-white/10 hover:bg-white/20 rounded disabled:opacity-50"
                                  >
                                    {syncingFileId === file.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Import"}
                                  </button>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}</div></motion.div></>)}</AnimatePresence>
                  </div>
                  <textarea
                    ref={textareaRef}
                    rows={1}
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder={files.length > 0 ? "Ask about your documents... (Enter to send, Shift+Enter for a new line)" : "Upload files to start chatting"}
                    disabled={files.length === 0}
                    className="flex-1 bg-transparent px-3 py-3 text-white placeholder-gray-500 focus:outline-none disabled:opacity-50 resize-none max-h-[200px] hide-scrollbar leading-relaxed"
                  />
                  <div className="flex items-center gap-2 mb-1 shrink-0">
                    {modelsLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
                    ) : providers.length > 0 ? (
                      <motion.button onClick={() => setShowModelSelector(true)} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-white border border-white/10 rounded-xl">
                        <span className="hidden sm:inline">{selectedProvider?.name || "Select Model"}</span><ChevronDown className="w-3 h-3" />
                      </motion.button>
                    ) : (
                      <div className="flex items-center gap-1 text-xs text-orange-400"><AlertCircle className="w-4 h-4" />No models</div>
                    )}
                    <motion.button
                      onClick={handleSendMessage}
                      disabled={!inputMessage.trim() || isLoading || files.length === 0}
                      whileHover={inputMessage.trim() ? { scale: 1.06 } : {}}
                      whileTap={inputMessage.trim() ? { scale: 0.94 } : {}}
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${inputMessage.trim() && !isLoading ? "bg-gradient-to-br from-purple-500 to-purple-700 text-white shadow-lg shadow-purple-500/30" : "bg-white/5 text-gray-600 cursor-not-allowed"}`}
                      title="Send message"
                    >
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <SendHorizontal className="w-4 h-4" />}
                    </motion.button>
                  </div>
                </div>
                </div>
              </div>
              <p className="text-[11px] text-gray-600 text-center mt-2">MindVault can make mistakes. Verify important answers against your source documents.</p>
            </div>
          </div>
        </main>
      </div>

      <AnimatePresence>{showModelSelector && providers.length > 0 && (<><motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowModelSelector(false)} className="fixed inset-0 bg-black/50 z-50" /><motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} className="fixed right-4 bottom-24 w-[400px] bg-[#1a1a1a] border border-white/10 rounded-2xl z-50 overflow-hidden shadow-2xl"><div className="p-4 border-b border-white/10 flex items-center justify-between"><h3 className="font-semibold">Choose a model</h3><button onClick={() => setShowModelSelector(false)}><X className="w-4 h-4 text-gray-400" /></button></div><div className="p-4 max-h-[400px] overflow-y-auto">{providers.filter(p => p.type === "cloud").length > 0 && (<><p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Cloud models</p><div className="space-y-1 mb-6">{providers.filter(p => p.type === "cloud").map((provider) => (<button key={provider.id} onClick={() => { setLLMProvider(provider.id); setShowModelSelector(false); }} className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors ${selectedProvider?.id === provider.id ? "bg-white/10" : "hover:bg-white/5"}`}><div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center"><Cpu className="w-4 h-4" /></div><div className="flex-1 text-left"><span className="font-medium">{provider.name}</span><p className="text-xs text-gray-500">{provider.model}</p></div>{selectedProvider?.id === provider.id && <Check className="w-4 h-4 text-purple-400" />}</button>))}</div></>)}{providers.filter(p => p.type === "local").length > 0 && (<><p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Local models</p><div className="space-y-1">{providers.filter(p => p.type === "local").map((provider) => (<button key={provider.id} onClick={() => { setLLMProvider(provider.id); setShowModelSelector(false); }} className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors ${selectedProvider?.id === provider.id ? "bg-white/10" : "hover:bg-white/5"}`}><div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center"><HardDrive className="w-4 h-4" /></div><div className="flex-1 text-left"><span className="font-medium">{provider.name}</span><p className="text-xs text-gray-500">{provider.model}</p></div><span className="text-xs text-gray-500 bg-white/10 px-2 py-1 rounded">Local</span>{selectedProvider?.id === provider.id && <Check className="w-4 h-4 text-purple-400" />}</button>))}</div></>)}</div></motion.div></>)}</AnimatePresence>

      <AnimatePresence>{showSettings && (<><motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowSettings(false)} className="fixed inset-0 bg-black/50 z-50" /><motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="fixed inset-0 m-auto w-[440px] h-fit bg-[#1a1a1a] border border-white/10 rounded-2xl z-50 overflow-hidden shadow-2xl"><div className="p-4 border-b border-white/10 flex items-center justify-between"><h3 className="font-semibold">Model API Keys</h3><button onClick={() => setShowSettings(false)}><X className="w-4 h-4 text-gray-400" /></button></div><div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto"><p className="text-xs text-gray-500">Add your own API key to unlock a model in the selector below. Local Ollama models need no key.</p>{apiKeys.map((key) => (<div key={key.provider} className="border border-white/10 rounded-xl p-3"><div className="flex items-center justify-between mb-2"><div className="flex items-center gap-2"><Key className="w-4 h-4 text-gray-400" /><span className="text-sm font-medium">{PROVIDER_LABELS[key.provider] || key.provider}</span></div>{key.configured && <span className="text-xs text-green-400">{key.source === "user" ? "Your key saved" : "Set by server"}</span>}</div><div className="flex items-center gap-2"><input type="password" placeholder={key.configured ? "Replace key..." : "Enter API key..."} value={apiKeyInputs[key.provider] || ""} onChange={(e) => setApiKeyInputs((prev) => ({ ...prev, [key.provider]: e.target.value }))} className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50" /><button onClick={() => saveApiKey(key.provider)} disabled={savingProvider === key.provider || !apiKeyInputs[key.provider]?.trim()} className="px-3 py-2 text-xs bg-purple-600 hover:bg-purple-700 rounded-lg disabled:opacity-50">{savingProvider === key.provider ? <Loader2 className="w-3 h-3 animate-spin" /> : "Save"}</button>{key.source === "user" && <button onClick={() => removeApiKey(key.provider)} disabled={savingProvider === key.provider} className="p-2 text-gray-400 hover:text-red-400 hover:bg-white/10 rounded-lg disabled:opacity-50" title="Remove key"><Trash2 className="w-3.5 h-3.5" /></button>}</div></div>))}

              <div className="border-t border-white/10 pt-4">
                <p className="text-sm font-medium mb-1">Embedding model</p>
                <p className="text-xs text-gray-500 mb-2">Used to index your documents and match them to your questions. Fetched live from whichever provider you have a key for.</p>
                {embeddingModelsLoading ? (
                  <div className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="w-4 h-4 animate-spin" />Loading models...</div>
                ) : embeddingModels.length === 0 ? (
                  <p className="text-xs text-orange-400">No embedding models available yet - add an API key above (Mistral, Gemini) or run Ollama locally.</p>
                ) : (
                  <div className="relative">
                    <select
                      value={currentEmbeddingProvider || ""}
                      onChange={(e) => setEmbeddingProvider(e.target.value)}
                      disabled={savingEmbeddingProvider}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500/50 disabled:opacity-50"
                    >
                      {embeddingModels.map((m) => (
                        <option key={m.id} value={m.id}>{PROVIDER_LABELS[base_provider_client(m.id)] || base_provider_client(m.id)} - {m.model}</option>
                      ))}
                    </select>
                    <p className="text-[11px] text-gray-600 mt-1.5">Changing this only affects new uploads and new questions - files already indexed keep their existing vectors.</p>
                  </div>
                )}
              </div>
              </div></motion.div></>)}</AnimatePresence>

      <AnimatePresence>
        {showHistory && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowHistory(false)} className="fixed inset-0 bg-black/50 z-50" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="fixed inset-0 m-auto w-[480px] h-[600px] bg-[#1a1a1a] border border-white/10 rounded-2xl z-50 overflow-hidden shadow-2xl flex flex-col">
              <div className="p-4 border-b border-white/10 flex items-center justify-between shrink-0">
                <h3 className="font-semibold">Chat history</h3>
                <button onClick={() => setShowHistory(false)}><X className="w-4 h-4 text-gray-400" /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-3">
                {historyLoading ? (
                  <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-gray-500" /></div>
                ) : chatHistory.length === 0 ? (
                  <p className="text-center text-gray-500 py-10 text-sm">No past conversations yet</p>
                ) : (
                  <div className="space-y-1">
                    {chatHistory.map((item) => (
                      <motion.button
                        key={item.id}
                        onClick={() => loadHistoryItem(item)}
                        whileHover={{ x: 2 }}
                        className="w-full text-left p-3 rounded-xl hover:bg-white/5 transition-colors"
                      >
                        <p className="text-sm text-gray-200 truncate">{item.question}</p>
                        <p className="text-xs text-gray-500 mt-0.5 truncate">{item.answer}</p>
                        <p className="text-[11px] text-gray-600 mt-1">{formatDateTime(item.created_at)}</p>
                      </motion.button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showWorkspacePanel && activeWorkspace && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowWorkspacePanel(false)} className="fixed inset-0 bg-black/50 z-50" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="fixed inset-0 m-auto w-[460px] h-fit max-h-[70vh] bg-[#1a1a1a] border border-white/10 rounded-2xl z-50 overflow-hidden shadow-2xl flex flex-col">
              <div className="p-4 border-b border-white/10 flex items-center justify-between shrink-0">
                <div>
                  <h3 className="font-semibold">{activeWorkspace.name}</h3>
                  <p className="text-xs text-gray-500">{workspaceMembers.length} member{workspaceMembers.length === 1 ? "" : "s"}</p>
                </div>
                <button onClick={() => setShowWorkspacePanel(false)}><X className="w-4 h-4 text-gray-400" /></button>
              </div>

              {activeWorkspace.role === "owner" && (
                <div className="p-4 border-b border-white/10 shrink-0">
                  <label className="block text-xs text-gray-500 mb-2">Invite a teammate</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && inviteToWorkspace()}
                      placeholder="teammate@company.com"
                      className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
                    />
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as "editor" | "viewer")}
                      className="bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-sm text-white focus:outline-none"
                    >
                      <option value="viewer">Viewer</option>
                      <option value="editor">Editor</option>
                    </select>
                    <button onClick={inviteToWorkspace} disabled={!inviteEmail.trim() || workspaceBusy} className="px-3 py-2 text-sm bg-purple-600 hover:bg-purple-700 rounded-lg disabled:opacity-50">
                      {workspaceBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-600 mt-1.5">Editors can upload and delete files. Viewers can only ask questions.</p>
                </div>
              )}

              <div className="flex-1 overflow-y-auto p-3">
                {workspaceMembers.map((member) => (
                  <div key={member.id} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/5">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-xs font-medium shrink-0">
                      {member.email[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{member.email}</p>
                      {member.status === "invited" && <p className="text-[11px] text-orange-400">Invited - waiting for sign up</p>}
                    </div>
                    <span className="flex items-center gap-1 text-xs text-gray-500 shrink-0">
                      {member.role === "owner" ? <Crown className="w-3.5 h-3.5 text-amber-400" /> : member.role === "editor" ? <Pencil className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      {member.role}
                    </span>
                    {activeWorkspace.role === "owner" && member.role !== "owner" && (
                      <button onClick={() => removeWorkspaceMember(member.id)} className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-white/10 rounded-lg shrink-0" title="Remove member">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {viewerFile && (
        <DocumentViewer
          fileName={viewerFile.fileName}
          content={viewerFile.content}
          loading={viewerFile.loading}
          highlight={viewerFile.highlight}
          onClose={() => setViewerFile(null)}
        />
      )}
    </div>
  );
}