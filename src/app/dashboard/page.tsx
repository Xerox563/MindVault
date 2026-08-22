"use client";

import { useAuth, useUser, SignOutButton } from "@clerk/nextjs";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import Link from "next/link";
import { 
  Upload, 
  FileText, 
  X,
  Cloud,
  Brain,
  Menu,
  ChevronRight,
  Search,
  User,
  Plus,
  MoreHorizontal,
  Mic,
  ChevronDown,
  Check,
  Cpu,
  HardDrive,
  Globe,
  FileSpreadsheet,
  FileIcon,
  ScrollText,
  ChevronUp,
  Loader2,
  AlertCircle
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface FileItem {
  id: number;
  filename: string;
  file_type: string;
  file_size: number;
  uploaded_at?: string;
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

interface LLMModel {
  id: string;
  name: string;
  provider: string;
  type: "cloud" | "local";
  available: boolean;
}

interface LLMStatus {
  provider: string;
  model: string;
  available_models?: string[];
  ollama_connected?: boolean;
}

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: string;
  connected: boolean;
}

// File type icons
const FileTypeIcon = ({ type, className = "" }: { type: string; className?: string }) => {
  if (type.includes('pdf')) return <FileText className={`${className} text-red-400`} />;
  if (type.includes('xlsx') || type.includes('csv')) return <FileSpreadsheet className={`${className} text-green-400`} />;
  if (type.includes('doc') || type.includes('docx')) return <ScrollText className={`${className} text-blue-400`} />;
  return <FileIcon className={`${className} text-gray-400`} />;
};

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return "0 KB";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
};

const formatDate = (dateStr?: string) => {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[date.getMonth()]} ${date.getDate()}`;
};

export default function Dashboard() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  
  // State
  const [files, setFiles] = useState<FileItem[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showAllFiles, setShowAllFiles] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // LLM State
  const [llmStatus, setLlmStatus] = useState<LLMStatus | null>(null);
  const [availableModels, setAvailableModels] = useState<LLMModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<LLMModel | null>(null);
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [modelsLoading, setModelsLoading] = useState(true);
  
  // Integrations State
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [showIntegrations, setShowIntegrations] = useState(false);
  const [integrationsLoading, setIntegrationsLoading] = useState(true);

  // Fetch data on mount
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      fetchFiles();
      fetchLLMStatus();
      fetchIntegrations();
    }
  }, [isLoaded, isSignedIn]);

  const getAuthToken = async () => {
    return await getToken();
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
      }
    } catch (error) {
      console.error("Failed to fetch files:", error);
    }
  };

  const fetchLLMStatus = async () => {
    const token = await getAuthToken();
    if (!token) return;
    
    setModelsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/llm/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (res.ok) {
        const status: LLMStatus = await res.json();
        setLlmStatus(status);
        
        // Build available models list
        const models: LLMModel[] = [];
        
        // Add current configured model
        models.push({
          id: status.provider + "-" + status.model,
          name: status.provider === "mistral" ? "Mistral AI" : status.model,
          provider: status.provider,
          type: status.provider === "ollama" ? "local" : "cloud",
          available: true
        });
        
        // Add Ollama models if available
        if (status.ollama_connected && status.available_models) {
          status.available_models.forEach((modelName: string) => {
            if (!models.find(m => m.name === modelName)) {
              models.push({
                id: "ollama-" + modelName,
                name: modelName,
                provider: "Ollama",
                type: "local",
                available: true
              });
            }
          });
        }
        
        setAvailableModels(models);
        setSelectedModel(models[0] || null);
      }
    } catch (error) {
      console.error("Failed to fetch LLM status:", error);
    } finally {
      setModelsLoading(false);
    }
  };

  const fetchIntegrations = async () => {
    const token = await getAuthToken();
    if (!token) return;
    
    setIntegrationsLoading(true);
    try {
      // Check which integrations are configured
      const res = await fetch(`${API_URL}/api/drive/files`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      // Build integrations list based on what's actually configured
      const configuredIntegrations: Integration[] = [];
      
      // Check if Google Drive is configured
      try {
        const driveRes = await fetch(`${API_URL}/api/auth/google/connect`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (driveRes.ok || driveRes.status !== 404) {
          configuredIntegrations.push({
            id: "drive",
            name: "Google Drive",
            description: "Search and access your Drive files",
            icon: "drive",
            connected: false // Will be updated after OAuth
          });
        }
      } catch {
        // Drive not configured
      }
      
      setIntegrations(configuredIntegrations);
    } catch (error) {
      console.error("Failed to fetch integrations:", error);
      setIntegrations([]);
    } finally {
      setIntegrationsLoading(false);
    }
  };

  const handleUpload = async (file: File) => {
    const token = await getAuthToken();
    if (!token) {
      alert("Please sign in first");
      return;
    }
    
    // Validate file type
    const validTypes = ['.pdf', '.docx', '.txt', '.csv', '.xlsx', '.md'];
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!validTypes.includes(ext)) {
      alert(`Invalid file type. Allowed: ${validTypes.join(', ')}`);
      return;
    }
    
    setUploading(true);
    setUploadProgress(0);
    
    const formData = new FormData();
    formData.append("uploaded_file", file);
    
    try {
      const res = await fetch(`${API_URL}/api/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      
      if (res.ok) {
        setUploadProgress(100);
        setTimeout(() => {
          setUploading(false);
          setUploadProgress(0);
          fetchFiles();
        }, 500);
      } else {
        const error = await res.json();
        alert(error.detail || "Upload failed");
        setUploading(false);
      }
    } catch (error) {
      console.error("Upload failed:", error);
      alert("Upload failed. Please try again.");
      setUploading(false);
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
        body: JSON.stringify({ question: userMessage.content }),
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
      } else {
        const error = await res.json();
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: `Error: ${error.detail || "Failed to get response"}`,
        };
        setMessages((prev) => [...prev, errorMessage]);
      }
    } catch (error) {
      console.error("Chat failed:", error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Sorry, I couldn't process your request. Please try again.",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const connectIntegration = async (integrationId: string) => {
    if (integrationId === "drive") {
      // Open Google OAuth
      window.open(`${API_URL}/api/auth/google/connect`, "_blank", "width=500,height=600");
    }
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
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
              <label className="block w-full cursor-pointer">
                <input
                  type="file"
                  onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
                  className="hidden"
                  accept=".pdf,.docx,.txt,.csv,.xlsx,.md"
                  disabled={uploading}
                />
                <motion.div
                  whileHover={{ scale: uploading ? 1 : 1.02 }}
                  whileTap={{ scale: uploading ? 1 : 0.98 }}
                  className={`w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-purple-700 rounded-lg flex items-center justify-center gap-2 mb-2 ${uploading ? 'opacity-50' : ''}`}
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="font-medium">Uploading... {uploadProgress}%</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      <span className="font-medium">Upload Files</span>
                    </>
                  )}
                </motion.div>
              </label>

              {/* Supported Types */}
              <p className="text-xs text-gray-500 text-center mb-6">
                PDF, DOCX, TXT, CSV, XLSX, MD
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

              {/* Your Files */}
              <div className="mb-4">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Your Files</h3>
                <p className="text-xs text-gray-500">{files.length} files available to AI</p>
              </div>

              {/* Files List */}
              <div className="space-y-1">
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

              {/* View All */}
              {files.length > 8 && (
                <button
                  onClick={() => setShowAllFiles(!showAllFiles)}
                  className="flex items-center gap-1 text-sm text-gray-400 hover:text-white mt-4"
                >
                  {showAllFiles ? (
                    <><ChevronUp className="w-4 h-4" /> Show less</>
                  ) : (
                    <><ChevronRight className="w-4 h-4" /> View all files</>
                  )}
                </button>
              )}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header - Simplified */}
        <header className="h-14 border-b border-white/10 flex items-center justify-between px-4 bg-[#0d0d0d]/80 backdrop-blur-md">
          <motion.button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Menu className="w-5 h-5" />
          </motion.button>
          
          <SignOutButton>
            <button className="flex items-center gap-2 px-3 py-2 hover:bg-white/10 rounded-lg transition-colors">
              {user?.imageUrl ? (
                <img src={user.imageUrl} alt="User" className="w-8 h-8 rounded-full" />
              ) : (
                <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-sm font-medium">
                  {user?.firstName?.[0] || user?.emailAddresses?.[0]?.emailAddress?.[0] || "U"}
                </div>
              )}
            </button>
          </SignOutButton>
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
                    Welcome to MindVault
                  </h1>
                </div>
                <p className="text-xl text-gray-400 mb-8">
                  How can I help you today?
                </p>

                {/* Dynamic Suggested Prompts based on files */}
                <div className="grid grid-cols-2 gap-3 max-w-lg mx-auto">
                  {files.length > 0 ? (
                    [
                      "Summarize my documents",
                      "What are the key points?",
                      "Find information about...",
                      "Compare these documents",
                    ].map((prompt) => (
                      <motion.button
                        key={prompt}
                        onClick={() => setInputMessage(prompt)}
                        className="p-4 text-left bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 hover:border-purple-500/30 transition-all"
                        whileHover={{ y: -2 }}
                      >
                        <p className="text-sm text-gray-300">{prompt}</p>
                      </motion.button>
                    ))
                  ) : (
                    <div className="col-span-2 p-4 text-center text-gray-500">
                      Upload files to start chatting with your documents
                    </div>
                  )}
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
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 p-4">
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-100" />
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-200" />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Prompt Bar */}
          <div className="p-4">
            <div className="max-w-3xl mx-auto">
              <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl">
                <div className="flex items-center gap-2 p-2">
                  {/* + Button - Only show if integrations are configured */}
                  {integrations.length > 0 && (
                    <motion.button
                      onClick={() => setShowIntegrations(true)}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="w-8 h-8 flex items-center justify-center border border-white/20 rounded-xl hover:bg-white/10 text-gray-400"
                    >
                      <Plus className="w-4 h-4" />
                    </motion.button>
                  )}

                  {/* Input */}
                  <input
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                    placeholder={files.length > 0 ? "Ask about your documents..." : "Upload files to start chatting"}
                    disabled={files.length === 0}
                    className="flex-1 bg-transparent px-3 py-3 text-white placeholder-gray-500 focus:outline-none disabled:opacity-50"
                  />

                  {/* Mic Button */}
                  <button className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-white">
                    <Mic className="w-4 h-4" />
                  </button>

                  {/* Model Selector - Dynamic */}
                  {modelsLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
                  ) : availableModels.length > 0 ? (
                    <motion.button
                      onClick={() => setShowModelSelector(true)}
                      whileHover={{ scale: 1.02 }}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-white border border-white/10 rounded-xl"
                    >
                      {selectedModel?.name || "Select Model"}
                      <ChevronDown className="w-3 h-3" />
                    </motion.button>
                  ) : (
                    <div className="flex items-center gap-1 text-xs text-orange-400">
                      <AlertCircle className="w-4 h-4" />
                      No models
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Model Selector Dialog */}
      <AnimatePresence>
        {showModelSelector && availableModels.length > 0 && (
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
              
              <div className="p-4 max-h-[400px] overflow-y-auto">
                {/* Cloud Models */}
                {availableModels.filter(m => m.type === "cloud").length > 0 && (
                  <>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Cloud models</p>
                    <div className="space-y-1 mb-6">
                      {availableModels.filter(m => m.type === "cloud").map((model) => (
                        <button
                          key={model.id}
                          onClick={() => { setSelectedModel(model); setShowModelSelector(false); }}
                          className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors ${
                            selectedModel?.id === model.id ? "bg-white/10" : "hover:bg-white/5"
                          }`}
                        >
                          <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                            <Cpu className="w-4 h-4" />
                          </div>
                          <div className="flex-1 text-left">
                            <span className="font-medium">{model.name}</span>
                            <p className="text-xs text-gray-500">{model.provider}</p>
                          </div>
                          {selectedModel?.id === model.id && (
                            <Check className="w-4 h-4 text-purple-400" />
                          )}
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {/* Local Models */}
                {availableModels.filter(m => m.type === "local").length > 0 && (
                  <>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Local models</p>
                    <div className="space-y-1">
                      {availableModels.filter(m => m.type === "local").map((model) => (
                        <button
                          key={model.id}
                          onClick={() => { setSelectedModel(model); setShowModelSelector(false); }}
                          className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors ${
                            selectedModel?.id === model.id ? "bg-white/10" : "hover:bg-white/5"
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
                          {selectedModel?.id === model.id && (
                            <Check className="w-4 h-4 text-purple-400" />
                          )}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Integrations Dialog - Only show if configured */}
      <AnimatePresence>
        {showIntegrations && integrations.length > 0 && (
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
                {integrationsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
                  </div>
                ) : integrations.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No integrations configured
                  </div>
                ) : (
                  <div className="space-y-2">
                    {integrations.map((integration) => (
                      <div
                        key={integration.id}
                        className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5"
                      >
                        <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
                          {integration.icon === "drive" && <Cloud className="w-5 h-5 text-blue-400" />}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{integration.name}</p>
                          <p className="text-sm text-gray-500">{integration.description}</p>
                        </div>
                        <button 
                          onClick={() => connectIntegration(integration.id)}
                          className="px-4 py-1.5 text-sm bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                        >
                          Connect
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
