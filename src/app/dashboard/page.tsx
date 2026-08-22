"use client";

import { useAuth, useUser, SignOutButton } from "@clerk/nextjs";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { 
  Upload, 
  FileText, 
  Trash2, 
  LogOut,
  X,
  Cloud,
  Brain,
  Sparkles,
  Menu,
  ChevronRight,
  Search,
  User,
  Plus,
  Settings,
  MoreHorizontal,
  MessageCircle,
  Mic,
  ChevronDown,
  ExternalLink,
  Database,
  Check,
  Cpu,
  HardDrive,
  Zap,
  Globe,
  FolderOpen,
  FileSpreadsheet,
  FileIcon,
  ScrollText,
  Trash,
  ChevronLeft,
  ChevronUp,
  ChevronLeft as ChevronLeftIcon
} from "lucide-react";
import { AnimatedBackground, GradientText } from "@/components/animations";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface FileItem {
  id: number;
  filename: string;
  file_type: string;
  file_size: number;
  source?: string;
  uploaded_at?: string;
}

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
}

interface Source {
  filename: string;
  page?: string;
  file_id?: number;
}

interface Model {
  id: string;
  name: string;
  provider: string;
  type: "cloud" | "local";
  recommended?: boolean;
  icon: string;
}

const MODELS: Model[] = [
  { id: "claude-3-5-sonnet", name: "Claude 3.5 Sonnet", provider: "Anthropic", type: "cloud", recommended: true, icon: "claude" },
  { id: "claude-3-opus", name: "Claude 3 Opus", provider: "Anthropic", type: "cloud", icon: "claude" },
  { id: "gpt-4o", name: "GPT-4o", provider: "OpenAI", type: "cloud", icon: "openai" },
  { id: "gpt-4-turbo", name: "GPT-4 Turbo", provider: "OpenAI", type: "cloud", icon: "openai" },
  { id: "mistral-large", name: "Mistral Large 2", provider: "Mistral AI", type: "cloud", icon: "mistral" },
  { id: "gemini-1-5", name: "Gemini 1.5 Pro", provider: "Google", type: "cloud", icon: "gemini" },
  { id: "ollama-llama3", name: "Llama 3.2", provider: "Ollama", type: "local", icon: "ollama" },
  { id: "ollama-llama3-70b", name: "Llama 3.1 70B", provider: "Ollama", type: "local", icon: "ollama" },
];

const INTEGRATIONS = [
  { id: "drive", name: "Google Drive", description: "Search and access your Drive files.", icon: "drive" },
  { id: "dropbox", name: "Dropbox", description: "Search and access your Dropbox files.", icon: "dropbox" },
  { id: "notion", name: "Notion", description: "Search pages and databases.", icon: "notion" },
  { id: "onedrive", name: "Microsoft OneDrive", description: "Search and access your OneDrive files.", icon: "onedrive" },
  { id: "confluence", name: "Confluence", description: "Search Confluence pages and spaces.", icon: "confluence" },
  { id: "web", name: "Web (URL)", description: "Add URLs to use as context.", icon: "web" },
];

// File type icons
const FileTypeIcon = ({ type, className = "" }: { type: string; className?: string }) => {
  const colorClass = type.includes('pdf') ? 'text-red-400' :
    type.includes('word') || type.includes('doc') ? 'text-blue-400' :
    type.includes('excel') || type.includes('xlsx') || type.includes('csv') ? 'text-green-400' :
    type.includes('md') ? 'text-gray-400' :
    'text-gray-400';
  
  if (type.includes('pdf')) return <FileText className={`${className} ${colorClass}`} />;
  if (type.includes('xlsx') || type.includes('csv')) return <FileSpreadsheet className={`${className} ${colorClass}`} />;
  if (type.includes('doc') || type.includes('docx')) return <ScrollText className={`${className} ${colorClass}`} />;
  return <FileIcon className={`${className} ${colorClass}`} />;
};

// Format file size
const formatFileSize = (bytes: number) => {
  if (bytes === 0) return "0 KB";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
};

// Format date
const formatDate = (dateStr?: string) => {
  if (!dateStr) return "Aug 22";
  const date = new Date(dateStr);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[date.getMonth()]} ${date.getDate()}`;
};

export default function Dashboard() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [uploading, setUploading] = useState<string | null>(null);
  const [viewing, setViewing] = useState<{ content: string; fileType: string; filename: string } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedModel, setSelectedModel] = useState<Model>(MODELS[0]);
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [showIntegrations, setShowIntegrations] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [storageUsed, setStorageUsed] = useState(2.4);
  const [storageTotal] = useState(10);
  const [showAllFiles, setShowAllFiles] = useState(false);
  const [connectedSources, setConnectedSources] = useState<string[]>(["files"]);

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      fetchFiles();
    }
  }, [isLoaded, isSignedIn]);

  const getAuthToken = async () => {
    const token = await getToken();
    return token;
  };

  const fetchFiles = async () => {
    const token = await getAuthToken();
    if (!token) return;
    
    try {
      const res = await fetch(`${API_URL}/api/files`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setFiles(data);
        // Calculate storage used
        const totalBytes = data.reduce((sum: number, f: FileItem) => sum + (f.file_size || 0), 0);
        setStorageUsed(totalBytes / (1024 * 1024 * 1024)); // Convert to GB
      }
    } catch (error) {
      console.error("Failed to fetch files:", error);
    }
  };

  const handleUpload = async (file: File) => {
    const token = await getAuthToken();
    if (!token) return;
    
    setUploading(file.name);
    const formData = new FormData();
    formData.append("uploaded_file", file);
    
    try {
      const res = await fetch(`${API_URL}/api/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (res.ok) {
        fetchFiles();
      }
    } catch (error) {
      console.error("Upload failed:", error);
    } finally {
      setUploading(null);
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;
    
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: inputMessage,
    };
    
    setMessages((prev) => [...prev, userMessage]);
    setInputMessage("");
    setIsLoading(true);

    try {
      const token = await getAuthToken();
      const res = await fetch(`${API_URL}/api/ask`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ question: inputMessage }),
      });

      if (res.ok) {
        const data = await res.json();
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: data.answer,
          sources: data.sources,
        };
        setMessages((prev) => [...prev, assistantMessage]);
      }
    } catch (error) {
      console.error("Chat failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const SUGGESTED_PROMPTS = [
    "Summarize my documents",
    "What are the key points?",
    "Find information about...",
    "Compare these documents",
  ];

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-[#0d0d0d] flex flex-col items-center justify-center">
        <p className="text-white mb-4">Please sign in to access the dashboard</p>
        <Link href="/login">
          <button className="px-6 py-3 bg-purple-600 rounded-lg text-white font-medium hover:bg-purple-700">
            Sign In
          </button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-white flex">
      {/* Left Sidebar - Files Only */}
      <AnimatePresence mode="wait">
        {sidebarOpen && (
          <motion.aside
            initial={{ x: -280, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -280, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="w-[280px] border-r border-white/10 flex flex-col h-screen bg-[#0d0d0d]"
          >
            {/* Logo */}
            <div className="p-4 border-b border-white/10">
              <Link href="/" className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
                  <Brain className="w-5 h-5 text-white" />
                </div>
                <span className="font-semibold text-lg">MindVault</span>
              </Link>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {/* Upload Button */}
              <label className="block w-full">
                <input
                  type="file"
                  onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
                  className="hidden"
                  accept=".pdf,.docx,.txt,.csv,.xlsx,.md"
                />
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-purple-700 rounded-lg flex items-center justify-center gap-2 cursor-pointer mb-2"
                >
                  <Upload className="w-4 h-4" />
                  <span className="font-medium">Upload Files</span>
                </motion.div>
              </label>

              {/* Supported Types */}
              <p className="text-xs text-gray-500 text-center mb-6">
                PDF, DOCX, TXT, CSV up to 50MB
              </p>

              {/* Search */}
              <div className="relative mb-6">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search files"
                  className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
                />
              </div>

              {/* Your Files Header */}
              <div className="mb-4">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Your Files</h3>
                <p className="text-xs text-gray-500">{files.length} files available to AI</p>
              </div>

              {/* Files List */}
              <div className="space-y-1 mb-4">
                {(showAllFiles ? files : files.slice(0, 8)).map((file) => (
                  <motion.div
                    key={file.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="group flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer"
                  >
                    <FileTypeIcon type={file.file_type} className="w-5 h-5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{file.filename}</p>
                      <p className="text-xs text-gray-500">
                        {formatFileSize(file.file_size)} • {formatDate(file.uploaded_at)}
                      </p>
                    </div>
                    <button className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/10 rounded">
                      <MoreHorizontal className="w-4 h-4 text-gray-400" />
                    </button>
                  </motion.div>
                ))}
              </div>

              {/* View All Files */}
              {files.length > 8 && (
                <button
                  onClick={() => setShowAllFiles(!showAllFiles)}
                  className="flex items-center gap-1 text-sm text-gray-400 hover:text-white mb-6"
                >
                  {showAllFiles ? (
                    <>
                      <ChevronUp className="w-4 h-4" />
                      Show less
                    </>
                  ) : (
                    <>
                      <ChevronRight className="w-4 h-4" />
                      View all files
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Storage Indicator */}
            <div className="p-4 border-t border-white/10">
              <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
                <span>Storage used</span>
                <span>{storageUsed.toFixed(1)} GB of {storageTotal} GB</span>
              </div>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-purple-500 to-purple-400 rounded-full"
                  style={{ width: `${(storageUsed / storageTotal) * 100}%` }}
                />
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <header className="h-14 border-b border-white/10 flex items-center justify-between px-4 bg-[#0d0d0d]/80 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <motion.button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Menu className="w-5 h-5" />
            </motion.button>
          </div>
          
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400">Free plan</span>
            <button className="px-3 py-1.5 text-sm border border-orange-500/50 text-orange-400 rounded-lg hover:bg-orange-500/10">
              Upgrade
            </button>
            <button className="p-2 hover:bg-white/10 rounded-lg">
              <span className="sr-only">Notifications</span>
              <div className="w-5 h-5 bg-white/10 rounded-full" />
            </button>
            <SignOutButton>
              <button className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-sm font-medium">
                A
              </button>
            </SignOutButton>
          </div>
        </header>

        {/* Chat Area */}
        <main className="flex-1 flex flex-col overflow-hidden relative">
          {messages.length === 0 ? (
            /* Welcome Screen */
            <div className="flex-1 flex flex-col items-center justify-center px-4">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center max-w-2xl"
              >
                <div className="flex items-center justify-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
                    <Brain className="w-7 h-7 text-white" />
                  </div>
                  <h1 className="text-4xl font-light text-white">
                    It&apos;s a late-night jam session.
                  </h1>
                </div>
                <p className="text-xl text-gray-400 mb-8">
                  How can I help you today?
                </p>

                {/* Suggested Prompts */}
                <div className="grid grid-cols-2 gap-3 mb-12 max-w-lg mx-auto">
                  {SUGGESTED_PROMPTS.map((prompt) => (
                    <motion.button
                      key={prompt}
                      onClick={() => setInputMessage(prompt)}
                      className="p-4 text-left bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 hover:border-purple-500/30 transition-all group"
                      whileHover={{ y: -2 }}
                    >
                      <p className="text-sm text-gray-300 group-hover:text-white">{prompt}</p>
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            </div>
          ) : (
            /* Chat Messages */
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div className={`max-w-3xl ${message.role === "user" ? "items-end" : "items-start"}`}>
                    <div className={`p-4 rounded-2xl ${
                      message.role === "user" 
                        ? "bg-white/10 border border-white/10" 
                        : "bg-transparent"
                    }`}>
                      <p className="text-white leading-relaxed">{message.content}</p>
                    </div>
                    {message.sources && message.sources.length > 0 && (
                      <div className="mt-3 space-y-2">
                        <p className="text-xs text-gray-500 mb-2">Sources</p>
                        {message.sources.map((source, i) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.1 }}
                            className="flex items-center gap-2 p-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 cursor-pointer"
                          >
                            <FileText className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-gray-300">{source.filename}</span>
                            {source.page && (
                              <span className="text-xs text-gray-500 ml-auto">{source.page}</span>
                            )}
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
              {isLoading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex justify-start"
                >
                  <div className="flex items-center gap-2 p-4">
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-100" />
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-200" />
                  </div>
                </motion.div>
              )}
            </div>
          )}

          {/* Prompt Bar */}
          <div className="p-4">
            <div className="max-w-3xl mx-auto">
              <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-2">
                <div className="flex items-center gap-2">
                  {/* + Button for Integrations */}
                  <motion.button
                    onClick={() => setShowIntegrations(true)}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="w-8 h-8 flex items-center justify-center border border-white/20 rounded-xl hover:bg-white/10 text-gray-400"
                  >
                    <Plus className="w-4 h-4" />
                  </motion.button>

                  {/* Input */}
                  <input
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                    placeholder="How can I help you today?"
                    className="flex-1 bg-transparent px-3 py-3 text-white placeholder-gray-500 focus:outline-none"
                  />

                  {/* Mic Button */}
                  <button className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-white">
                    <Mic className="w-4 h-4" />
                  </button>

                  {/* Model Selector */}
                  <motion.button
                    onClick={() => setShowModelSelector(true)}
                    whileHover={{ scale: 1.02 }}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-white border border-white/10 rounded-xl"
                  >
                    {selectedModel.name}
                    <ChevronDown className="w-3 h-3" />
                  </motion.button>
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-1 px-2 pb-2">
                  <button className="px-3 py-1.5 text-sm bg-white/10 text-white rounded-lg">
                    Chat
                  </button>
                  <button className="px-3 py-1.5 text-sm text-gray-500 hover:text-white rounded-lg">
                    Research
                    <span className="ml-1 text-xs text-orange-400">BETA</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Model Selector Dialog */}
      <AnimatePresence>
        {showModelSelector && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowModelSelector(false)}
              className="fixed inset-0 bg-black/50 z-50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="fixed right-4 bottom-24 w-[400px] bg-[#1a1a1a] border border-white/10 rounded-2xl z-50 overflow-hidden shadow-2xl"
            >
              <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <h3 className="font-semibold">Choose a model</h3>
                <button onClick={() => setShowModelSelector(false)}>
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>
              
              <div className="p-4 max-h-[500px] overflow-y-auto">
                {/* Cloud Models */}
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Cloud models</p>
                <div className="space-y-1 mb-6">
                  {MODELS.filter(m => m.type === "cloud").map((model) => (
                    <button
                      key={model.id}
                      onClick={() => { setSelectedModel(model); setShowModelSelector(false); }}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors ${
                        selectedModel.id === model.id ? "bg-white/10" : "hover:bg-white/5"
                      }`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                        <Cpu className="w-4 h-4" />
                      </div>
                      <div className="flex-1 text-left">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{model.name}</span>
                          {model.recommended && (
                            <span className="text-xs text-orange-400 border border-orange-400/50 px-1.5 py-0.5 rounded">
                              Recommended
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">{model.provider}</p>
                      </div>
                      {selectedModel.id === model.id && (
                        <Check className="w-4 h-4 text-purple-400" />
                      )}
                    </button>
                  ))}
                </div>

                {/* Local Models */}
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Local models</p>
                <div className="space-y-1">
                  {MODELS.filter(m => m.type === "local").map((model) => (
                    <button
                      key={model.id}
                      onClick={() => { setSelectedModel(model); setShowModelSelector(false); }}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors ${
                        selectedModel.id === model.id ? "bg-white/10" : "hover:bg-white/5"
                      }`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                        <HardDrive className="w-4 h-4" />
                      </div>
                      <div className="flex-1 text-left">
                        <span className="font-medium">{model.name}</span>
                        <p className="text-xs text-gray-500">{model.provider}</p>
                      </div>
                      <span className="text-xs text-gray-500 bg-white/10 px-2 py-1 rounded">Local</span>
                      {selectedModel.id === model.id && (
                        <Check className="w-4 h-4 text-purple-400" />
                      )}
                    </button>
                  ))}
                </div>

                {/* View all models */}
                <button className="w-full flex items-center justify-between p-3 text-sm text-gray-400 hover:text-white mt-4">
                  View all models
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Integrations Dialog */}
      <AnimatePresence>
        {showIntegrations && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowIntegrations(false)}
              className="fixed inset-0 bg-black/50 z-50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] bg-[#1a1a1a] border border-white/10 rounded-2xl z-50 overflow-hidden shadow-2xl"
            >
              <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">Add integration</h3>
                  <p className="text-sm text-gray-500">Connect your tools and bring your data into MindVault.</p>
                </div>
                <button onClick={() => setShowIntegrations(false)}>
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>
              
              <div className="p-4 max-h-[400px] overflow-y-auto">
                <div className="space-y-2">
                  {INTEGRATIONS.map((integration) => (
                    <div
                      key={integration.id}
                      className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 group"
                    >
                      <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
                        {integration.icon === "drive" && <Cloud className="w-5 h-5 text-blue-400" />}
                        {integration.icon === "dropbox" && <Cloud className="w-5 h-5 text-blue-400" />}
                        {integration.icon === "notion" && <FileText className="w-5 h-5 text-gray-400" />}
                        {integration.icon === "onedrive" && <Cloud className="w-5 h-5 text-blue-400" />}
                        {integration.icon === "confluence" && <Globe className="w-5 h-5 text-blue-400" />}
                        {integration.icon === "web" && <Globe className="w-5 h-5 text-gray-400" />}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{integration.name}</p>
                        <p className="text-sm text-gray-500">{integration.description}</p>
                      </div>
                      <button className="px-4 py-1.5 text-sm bg-white/10 hover:bg-white/20 rounded-lg transition-colors">
                        Connect
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Document Viewer Modal */}
      <AnimatePresence>
        {viewing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
            onClick={() => setViewing(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-4xl max-h-[90vh] bg-[#1a1a1a] border border-white/10 rounded-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-purple-400" />
                  <span className="font-medium">{viewing.filename}</span>
                </div>
                <button onClick={() => setViewing(null)}>
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 overflow-auto max-h-[70vh]">
                <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono">
                  {viewing.content}
                </pre>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
