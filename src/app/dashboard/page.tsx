"use client";

import { useAuth, useUser, SignOutButton } from "@clerk/nextjs";
import ReactMarkdown from "react-markdown";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import Link from "next/link";
import { 
  Upload, FileText, X, Cloud, Brain, Menu, ChevronRight, Search, User, Plus,
  MoreHorizontal, Mic, ChevronDown, Check, Cpu, HardDrive, FileSpreadsheet,
  FileIcon, ScrollText, ChevronUp, Loader2, AlertCircle, Zap, Settings, Key,
  Trash2, RefreshCw, Link2, Sparkles, DollarSign, Sun, Moon, Table, Hash, FileJson
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useTheme } from "@/components/ThemeProvider";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface FileItem { id: number; filename: string; file_type: string; file_size: number; uploaded_at?: string; source_type?: string; source?: string; }
interface Message { id: string; role: "user" | "assistant"; content: string; sources?: Source[]; timestamp?: string; fromCache?: boolean; cacheHits?: number; }
interface Source { filename?: string; file_name?: string; page?: string; file_id?: number; chunk_id?: number; content?: string; source_type?: string; source?: string; }
interface LLMProvider { id: string; name: string; type: "cloud" | "local"; model: string; available: boolean; }
interface Integration { id: string; name: string; description: string; icon: string; connected: boolean; }
interface ApiKeyStatus { provider: string; configured: boolean; source: "user" | "server" | "none"; }
interface DriveFile { id: string; name: string; mimeType: string; synced?: boolean; }

const PROVIDER_LABELS: Record<string, string> = { mistral: "Mistral AI", ollama: "Ollama" };
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
  const [apiKeyInputs, setApiKeyInputs] = useState<Record<string, string>>({});
  const [savingProvider, setSavingProvider] = useState<string | null>(null);

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      fetchFiles();
      fetchLLMStatus();
      fetchIntegrations();
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
      if (res.ok) setFiles(await res.json());
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

  const connectGoogleDrive = async () => {
    const token = await getAuthToken();
    if (!token) return;
    setConnectingDrive(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/google/connect`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        if (data.auth_url) window.open(data.auth_url, "google-drive-connect", "width=500,height=700");
      }
    } catch (error) { console.error("Failed to start Google Drive connection:", error); }
    finally { setConnectingDrive(false); }
  };

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
      if (res.ok) { await fetchApiKeys(); await fetchLLMStatus(); }
    } catch (error) { console.error("Failed to remove API key:", error); }
    finally { setSavingProvider(null); }
  };

  const openSettings = () => { setShowSettings(true); fetchApiKeys(); };
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
        setUploadProgress(100);
        setTimeout(() => { setUploading(false); setUploadProgress(0); fetchFiles(); }, 500);
      } else { const error = await res.json(); alert(error.detail || "Upload failed"); setUploading(false); }
    } catch (error) { console.error("Upload failed:", error); alert("Upload failed. Please try again."); setUploading(false); }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;
    const userMessage: Message = { id: Date.now().toString(), role: "user", content: inputMessage, timestamp: getCurrentTime() };
    setMessages((prev) => [...prev, userMessage]);
    setInputMessage("");
    setIsLoading(true);

    try {
      const token = await getAuthToken();
      const res = await fetch(`${API_URL}/api/ask`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ question: userMessage.content }),
      });
      if (res.ok) {
        const data = await res.json();
        const assistantMessage: Message = { id: (Date.now() + 1).toString(), role: "assistant", content: data.answer, sources: data.sources, timestamp: getCurrentTime(), fromCache: data.from_cache, cacheHits: data.cache_hits };
        setMessages((prev) => [...prev, assistantMessage]);
      } else { const error = await res.json(); setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: "assistant", content: `Error: ${error.detail || "Failed to get response"}`, timestamp: getCurrentTime() }]); }
    } catch (error) { console.error("Chat failed:", error); setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: "assistant", content: "Sorry, I couldn't process your request. Please try again.", timestamp: getCurrentTime() }]); }
    finally { setIsLoading(false); }
  };

  const getSourceIcon = (sourceType?: string) => {
    const s = sourceType || "local";
    const Icon = SOURCE_ICONS[s] || FileIcon;
    return { Icon, color: SOURCE_COLORS[s] || "text-gray-400" };
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
              <Link href="/" className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
                  <Brain className="w-5 h-5 text-white" />
                </div>
                <span className="font-semibold text-lg">MindVault</span>
              </Link>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <label className="block w-full cursor-pointer">
                <input type="file" onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} className="hidden" accept=".pdf,.docx,.txt,.csv,.xlsx,.md" disabled={uploading} />
                <motion.div whileHover={{ scale: uploading ? 1 : 1.02 }} whileTap={{ scale: uploading ? 1 : 0.98 }} className={`w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-purple-700 rounded-lg flex items-center justify-center gap-2 mb-2 ${uploading ? 'opacity-50' : ''}`}>
                  {uploading ? <><Loader2 className="w-4 h-4 animate-spin" /><span className="font-medium">Uploading... {uploadProgress}%</span></> : <><Upload className="w-4 h-4" /><span className="font-medium">Upload Files</span></>}
                </motion.div>
              </label>
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
                  return (
                    <motion.div key={file.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="group flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer">
                      <FileTypeIcon type={file.file_type} className="w-5 h-5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{file.filename}</p>
                        <p className="text-xs text-gray-500">{formatFileSize(file.file_size)} • {formatDate(file.uploaded_at)}</p>
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
          <motion.button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-white/10 rounded-lg transition-colors" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Menu className="w-5 h-5" />
          </motion.button>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/cost"><motion.button className="flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} title="Cost Monitoring"><DollarSign className="w-4 h-4" /><span className="hidden sm:inline">Costs</span></motion.button></Link>
            <motion.button onClick={openSettings} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} title="Settings"><Settings className="w-5 h-5" /></motion.button>
            <SignOutButton><button className="flex items-center gap-2 px-3 py-2 hover:bg-white/10 rounded-lg transition-colors">{user?.imageUrl ? <img src={user.imageUrl} alt="User" className="w-8 h-8 rounded-full" /> : <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-sm font-medium">{user?.firstName?.[0] || user?.emailAddresses?.[0]?.emailAddress?.[0] || "U"}</div>}</button></SignOutButton>
          </div>
        </header>

        <main className="flex-1 flex flex-col overflow-hidden relative">
          {messages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center px-4">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-2xl">
                <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 2, repeat: Infinity }} className="flex items-center justify-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shadow-lg shadow-orange-500/20"><Brain className="w-7 h-7 text-white" /></div>
                  <h1 className="text-4xl font-light text-white">Welcome to MindVault</h1>
                </motion.div>
                <p className="text-xl text-gray-400 mb-8">How can I help you today?</p>
                <div className="grid grid-cols-2 gap-3 max-w-lg mx-auto">
                  {files.length > 0 ? (["Summarize my documents", "What are the key points?", "Find information about...", "Compare these documents"].map((prompt) => (
                    <motion.button key={prompt} onClick={() => setInputMessage(prompt)} className="p-4 text-left bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 hover:border-purple-500/30 transition-all" whileHover={{ y: -2 }}><p className="text-sm text-gray-300">{prompt}</p></motion.button>
                  ))) : (<div className="col-span-2 p-4 text-center text-gray-500">Upload files to start chatting with your documents</div>)}
                </div>
              </motion.div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto px-4 py-6">
              {messages.map((message) => (
                <div key={message.id} className="mb-6">
                  {message.role === "user" ? (
                    <div className="flex justify-end mb-2">
                      <div className="max-w-[85%] md:max-w-[70%]">
                        <div className={`${userMsgBg} rounded-2xl rounded-tr-sm px-5 py-3 text-[15px]`}>{message.content}</div>
                        <div className="flex items-center justify-end gap-1.5 mt-1.5"><span className="text-xs text-gray-500">{message.timestamp}</span><Check className="w-3.5 h-3.5 text-gray-500" /></div>
                      </div>
                    </div>
                  ) : (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="flex gap-3 max-w-[90%]">
                      <div className="shrink-0 w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/20"><Sparkles className="w-4 h-4 text-white" /></div>
                      <div className="flex-1">
                        <div className={`${cardBg} rounded-2xl rounded-tl-sm px-5 py-4 ${borderColor}`}>
                          <div className="text-[15px] leading-relaxed text-gray-200">
                            <ReactMarkdown components={{ p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>, h1: ({ children }) => <h1 className="text-lg font-semibold mt-3 mb-2 first:mt-0">{children}</h1>, h2: ({ children }) => <h2 className="text-base font-semibold mt-3 mb-2 first:mt-0">{children}</h2>, h3: ({ children }) => <h3 className="text-sm font-semibold mt-2 mb-1 first:mt-0">{children}</h3>, strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>, ul: ({ children }) => <ul className="list-disc pl-5 mb-3 space-y-1.5">{children}</ul>, ol: ({ children }) => <ol className="list-disc pl-5 mb-3 space-y-1.5">{children}</ol>, li: ({ children }) => <li className="text-gray-300">{children}</li>, code: ({ children }) => <code className="bg-white/10 px-1.5 py-0.5 rounded text-sm font-mono text-gray-300">{children}</code>, pre: ({ children }) => <pre className="bg-white/5 border border-white/10 rounded-lg p-3 overflow-x-auto mb-3 text-sm">{children}</pre>, a: ({ children, href }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">{children}</a> }}>{message.content}</ReactMarkdown>
                          </div>
                        </div>
                        <div className="mt-1.5 flex items-center gap-2"><span className="text-xs text-gray-500">{message.timestamp}</span>{message.fromCache && (<span className="text-[10px] text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded flex items-center gap-1"><Zap className="w-3 h-3" />Cached{message.cacheHits && message.cacheHits > 1 && <span className="text-green-500">({message.cacheHits} hits)</span>}</span>)}</div>
                        {message.sources && message.sources.length > 0 && (
                          <div className="mt-4">
                            <p className="text-sm text-gray-400 mb-2">Sources</p>
                            <div className="flex flex-wrap gap-2">
                              {message.sources.map((source, i) => {
                                const { Icon, color } = getSourceIcon(source.source_type || source.source);
                                return (
                                  <motion.div key={i} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1, duration: 0.3 }} className={`flex items-center gap-2 px-3 py-2 ${cardBg} ${borderColor} rounded-lg hover:bg-white/5 cursor-pointer transition-colors`}>
                                    <FileText className="w-4 h-4 text-gray-500" />
                                    <span className="text-sm text-gray-300">{source.file_name || source.filename}</span>
                                    <Icon className={`w-3 h-3 ${color}`} />
                                  </motion.div>
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
              <AnimatePresence>{isLoading && (<motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }} className="flex gap-3 mb-6"><div className="shrink-0 w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center"><Sparkles className="w-4 h-4 text-white" /></div><div className={`${cardBg} rounded-2xl rounded-tl-sm px-5 py-4 ${borderColor} min-w-[200px]`}><div className="flex items-center gap-1.5"><motion.div className="w-2 h-2 bg-purple-500 rounded-full" animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.4, repeat: Infinity, delay: 0 }} /><motion.div className="w-2 h-2 bg-purple-500 rounded-full" animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.4, repeat: Infinity, delay: 0.2 }} /><motion.div className="w-2 h-2 bg-purple-500 rounded-full" animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.4, repeat: Infinity, delay: 0.4 }} /></div></div></motion.div>)}</AnimatePresence>
            </div>
          )}

          <div className="p-4">
            <div className="max-w-3xl mx-auto">
              <div className={`${inputBg} ${borderColor} border rounded-2xl`}>
                <div className="flex items-center gap-2 p-2">
                  <div className="relative">
                    <motion.button onClick={openIntegrations} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="w-8 h-8 flex items-center justify-center border border-white/20 rounded-xl hover:bg-white/10 text-gray-400" title="Integrations"><Plus className="w-4 h-4" /></motion.button>
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
                              onClick={() => {
                                if (integration.id === "google_drive") connectGoogleDrive();
                              }}
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
                  <input type="text" value={inputMessage} onChange={(e) => setInputMessage(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSendMessage()} placeholder={files.length > 0 ? "Ask about your documents..." : "Upload files to start chatting"} disabled={files.length === 0} className="flex-1 bg-transparent px-3 py-3 text-white placeholder-gray-500 focus:outline-none disabled:opacity-50" />
                  <button className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-white"><Mic className="w-4 h-4" /></button>
                  {modelsLoading ? <Loader2 className="w-5 h-5 animate-spin text-gray-500" /> : providers.length > 0 ? (<motion.button onClick={() => setShowModelSelector(true)} whileHover={{ scale: 1.02 }} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-white border border-white/10 rounded-xl">{selectedProvider?.name || "Select Model"}<ChevronDown className="w-3 h-3" /></motion.button>) : (<div className="flex items-center gap-1 text-xs text-orange-400"><AlertCircle className="w-4 h-4" />No models</div>)}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      <AnimatePresence>{showModelSelector && providers.length > 0 && (<><motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowModelSelector(false)} className="fixed inset-0 bg-black/50 z-50" /><motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} className="fixed right-4 bottom-24 w-[400px] bg-[#1a1a1a] border border-white/10 rounded-2xl z-50 overflow-hidden shadow-2xl"><div className="p-4 border-b border-white/10 flex items-center justify-between"><h3 className="font-semibold">Choose a model</h3><button onClick={() => setShowModelSelector(false)}><X className="w-4 h-4 text-gray-400" /></button></div><div className="p-4 max-h-[400px] overflow-y-auto">{providers.filter(p => p.type === "cloud").length > 0 && (<><p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Cloud models</p><div className="space-y-1 mb-6">{providers.filter(p => p.type === "cloud").map((provider) => (<button key={provider.id} onClick={() => { setLLMProvider(provider.id); setShowModelSelector(false); }} className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors ${selectedProvider?.id === provider.id ? "bg-white/10" : "hover:bg-white/5"}`}><div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center"><Cpu className="w-4 h-4" /></div><div className="flex-1 text-left"><span className="font-medium">{provider.name}</span><p className="text-xs text-gray-500">{provider.model}</p></div>{selectedProvider?.id === provider.id && <Check className="w-4 h-4 text-purple-400" />}</button>))}</div></>)}{providers.filter(p => p.type === "local").length > 0 && (<><p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Local models</p><div className="space-y-1">{providers.filter(p => p.type === "local").map((provider) => (<button key={provider.id} onClick={() => { setLLMProvider(provider.id); setShowModelSelector(false); }} className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors ${selectedProvider?.id === provider.id ? "bg-white/10" : "hover:bg-white/5"}`}><div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center"><HardDrive className="w-4 h-4" /></div><div className="flex-1 text-left"><span className="font-medium">{provider.name}</span><p className="text-xs text-gray-500">{provider.model}</p></div><span className="text-xs text-gray-500 bg-white/10 px-2 py-1 rounded">Local</span>{selectedProvider?.id === provider.id && <Check className="w-4 h-4 text-purple-400" />}</button>))}</div></>)}</div></motion.div></>)}</AnimatePresence>

      <AnimatePresence>{showSettings && (<><motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowSettings(false)} className="fixed inset-0 bg-black/50 z-50" /><motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="fixed inset-0 m-auto w-[440px] h-fit bg-[#1a1a1a] border border-white/10 rounded-2xl z-50 overflow-hidden shadow-2xl"><div className="p-4 border-b border-white/10 flex items-center justify-between"><h3 className="font-semibold">Model API Keys</h3><button onClick={() => setShowSettings(false)}><X className="w-4 h-4 text-gray-400" /></button></div><div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto"><p className="text-xs text-gray-500">Add your own API key to unlock a model in the selector below. Local Ollama models need no key.</p>{apiKeys.map((key) => (<div key={key.provider} className="border border-white/10 rounded-xl p-3"><div className="flex items-center justify-between mb-2"><div className="flex items-center gap-2"><Key className="w-4 h-4 text-gray-400" /><span className="text-sm font-medium">{PROVIDER_LABELS[key.provider] || key.provider}</span></div>{key.configured && <span className="text-xs text-green-400">{key.source === "user" ? "Your key saved" : "Set by server"}</span>}</div><div className="flex items-center gap-2"><input type="password" placeholder={key.configured ? "Replace key..." : "Enter API key..."} value={apiKeyInputs[key.provider] || ""} onChange={(e) => setApiKeyInputs((prev) => ({ ...prev, [key.provider]: e.target.value }))} className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50" /><button onClick={() => saveApiKey(key.provider)} disabled={savingProvider === key.provider || !apiKeyInputs[key.provider]?.trim()} className="px-3 py-2 text-xs bg-purple-600 hover:bg-purple-700 rounded-lg disabled:opacity-50">{savingProvider === key.provider ? <Loader2 className="w-3 h-3 animate-spin" /> : "Save"}</button>{key.source === "user" && <button onClick={() => removeApiKey(key.provider)} disabled={savingProvider === key.provider} className="p-2 text-gray-400 hover:text-red-400 hover:bg-white/10 rounded-lg disabled:opacity-50" title="Remove key"><Trash2 className="w-3.5 h-3.5" /></button>}</div></div>))}</div></motion.div></>)}</AnimatePresence>
    </div>
  );
}