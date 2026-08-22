"use client";

import { useAuth, useUser, SignOutButton } from "@clerk/nextjs";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import Link from "next/link";
import { 
  Upload, 
  MessageSquare, 
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
  User
} from "lucide-react";
import { AnimatedBackground, GradientText } from "@/components/animations";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface FileItem {
  id: number;
  filename: string;
  file_type: string;
  file_size: number;
  source?: string;
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
  sources?: string[];
}

export default function Dashboard() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [viewing, setViewing] = useState<{ content: string; fileType: string; filename: string } | null>(null);
  const [showDrive, setShowDrive] = useState(false);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [dragActive, setDragActive] = useState(false);

  // Check auth and fetch files
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
      if (res.ok) setFiles(await res.json());
    } catch (error) {
      console.error("Failed to fetch files:", error);
    }
  };

  const fetchDriveFiles = async () => {
    const token = await getAuthToken();
    if (!token) return;
    
    try {
      const res = await fetch(`${API_URL}/api/drive/files`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setDriveFiles(await res.json());
        setShowDrive(true);
      } else if (res.status === 400) {
        // Google Drive not connected - show connect option
        const data = await res.json();
        if (data.detail?.includes("not connected")) {
          window.open(`${API_URL}/api/auth/google/connect`, "_blank", "width=500,height=600");
        }
      }
    } catch (error) {
      console.error("Failed to fetch drive files:", error);
    }
  };
  
  const connectGoogleDrive = async () => {
    const token = await getAuthToken();
    if (!token) {
      alert("Please sign in first");
      return;
    }
    
    // Open Google OAuth in a popup with token in URL
    const popup = window.open(
      `${API_URL}/api/auth/google/connect?token=${encodeURIComponent(token)}`,
      "Connect Google Drive",
      "width=500,height=600"
    );
    
    // Check if popup was blocked
    if (!popup || popup.closed || typeof popup.closed === 'undefined') {
      alert("Please allow popups to connect Google Drive");
      return;
    }
    
    // Listen for message from popup
    const messageHandler = (event: MessageEvent) => {
      if (event.data === 'google-drive-connected') {
        window.removeEventListener('message', messageHandler);
        // Refresh Drive files
        setTimeout(() => {
          fetchDriveFiles();
        }, 500);
      }
    };
    window.addEventListener('message', messageHandler);
    
    // Poll for popup close as fallback
    const timer = setInterval(() => {
      if (popup.closed) {
        clearInterval(timer);
        window.removeEventListener('message', messageHandler);
        // Refresh after connection attempt
        setTimeout(() => {
          fetchDriveFiles();
        }, 1000);
      }
    }, 1000);
  };

  const handleUpload = async (file: File) => {
    const token = await getAuthToken();
    if (!token) return;
    
    setUploading(file.name);
    setUploadProgress(0);
    const formData = new FormData();
    formData.append("file", file);
    
    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => Math.min(prev + 10, 90));
    }, 200);
    
    try {
      const res = await fetch(`${API_URL}/api/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      clearInterval(progressInterval);
      if (res.ok) {
        setUploadProgress(100);
        fetchFiles();
      }
    } catch (error) {
      console.error("Upload failed:", error);
    } finally {
      setTimeout(() => {
        setUploading(null);
        setUploadProgress(0);
      }, 1000);
    }
  };

  const handleDelete = async (id: number) => {
    const token = await getAuthToken();
    if (!token) return;
    
    try {
      await fetch(`${API_URL}/api/files/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchFiles();
    } catch (error) {
      console.error("Delete failed:", error);
    }
  };

  const handleView = async (id: number) => {
    const token = await getAuthToken();
    if (!token) return;
    
    try {
      const res = await fetch(`${API_URL}/api/files/${id}/content`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setViewing(await res.json());
    } catch (error) {
      console.error("Failed to view file:", error);
    }
  };

  const handleSyncDriveFile = async (fileId: string) => {
    const token = await getAuthToken();
    if (!token) return;
    
    try {
      await fetch(`${API_URL}/api/sync/drive/${fileId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchFiles();
      setShowDrive(false);
    } catch (error) {
      console.error("Sync failed:", error);
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;
    const token = await getAuthToken();
    if (!token) return;
    
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: inputMessage,
    };
    
    setMessages((prev) => [...prev, userMessage]);
    setInputMessage("");
    setIsChatLoading(true);

    try {
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
      setIsChatLoading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleUpload(e.dataTransfer.files[0]);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <motion.div
          className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        />
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center">
        <p className="text-white mb-4">Please sign in to access the dashboard</p>
        <Link href="/login">
          <motion.button
            className="px-6 py-3 rounded-full bg-gradient-to-r from-violet-500 to-cyan-500 text-white font-semibold"
            whileHover={{ scale: 1.05 }}
          >
            Sign In
          </motion.button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white overflow-hidden">
      <AnimatedBackground />
      
      {/* Header */}
      <motion.header 
        className="fixed top-0 left-0 right-0 z-50 glass border-b border-white/10 h-16"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="h-full px-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <motion.button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Menu className="w-5 h-5" />
            </motion.button>
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center">
                <Brain className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-lg hidden sm:block">
                <GradientText>MindVault</GradientText>
              </span>
            </Link>
          </div>
          
          <div className="flex items-center gap-3">
            <motion.button
              onClick={fetchDriveFiles}
              className="flex items-center gap-2 px-4 py-2 rounded-full glass text-sm font-medium hover:bg-white/10 transition-colors"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Cloud className="w-4 h-4" />
              <span className="hidden sm:inline">Google Drive</span>
            </motion.button>
            
            {/* User Menu */}
            <div className="flex items-center gap-2">
              {user?.imageUrl ? (
                <img
                  src={user.imageUrl}
                  alt={user.firstName || "User"}
                  className="w-8 h-8 rounded-full border border-white/20"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center">
                  <User className="w-4 h-4" />
                </div>
              )}
              <span className="text-sm text-gray-300 hidden md:block">
                {user?.firstName || user?.emailAddresses[0]?.emailAddress}
              </span>
              <SignOutButton>
                <motion.button
                  className="p-2 rounded-lg hover:bg-red-500/20 hover:text-red-400 transition-colors"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <LogOut className="w-5 h-5" />
                </motion.button>
              </SignOutButton>
            </div>
          </div>
        </div>
      </motion.header>

      <div className="flex pt-16 h-screen">
        {/* Sidebar - Same as before */}
        <AnimatePresence mode="wait">
          {sidebarOpen && (
            <motion.aside
              initial={{ x: -320, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -320, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="w-80 glass-strong border-r border-white/10 flex flex-col"
            >
              {/* Upload Area */}
              <div className="p-6 border-b border-white/10">
                <h2 className="text-sm font-semibold text-gray-400 mb-4 flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  Upload Documents
                </h2>
                
                <motion.div
                  className={`relative p-8 rounded-2xl border-2 border-dashed transition-all duration-300 ${
                    dragActive 
                      ? "border-violet-500 bg-violet-500/10" 
                      : "border-white/20 hover:border-white/40"
                  }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  whileHover={{ scale: 1.02 }}
                >
                  <input
                    type="file"
                    onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    accept=".pdf,.docx,.xlsx,.txt"
                  />
                  <div className="text-center">
                    <motion.div
                      className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500/20 to-cyan-500/20 flex items-center justify-center mx-auto mb-3"
                      animate={{ y: [0, -5, 0] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      <Upload className="w-6 h-6 text-violet-400" />
                    </motion.div>
                    <p className="text-sm text-gray-400">
                      Drop files here or click to upload
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      PDF, DOCX, XLSX, TXT (max 50MB)
                    </p>
                  </div>
                </motion.div>

                {/* Upload Progress */}
                <AnimatePresence>
                  {uploading && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-4"
                    >
                      <div className="flex items-center justify-between text-xs mb-2">
                        <span className="text-gray-400 truncate">{uploading}</span>
                        <span className="text-violet-400">{uploadProgress}%</span>
                      </div>
                      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-gradient-to-r from-violet-500 to-cyan-500 rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${uploadProgress}%` }}
                          transition={{ duration: 0.3 }}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Files List */}
              <div className="flex-1 overflow-hidden flex flex-col">
                <div className="p-4 border-b border-white/10 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-400 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Your Files
                  </h3>
                  <span className="text-xs bg-white/10 px-2 py-1 rounded-full">
                    {files.length}
                  </span>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                  {files.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No files yet</p>
                      <p className="text-xs mt-1">Upload your first document</p>
                    </div>
                  ) : (
                    files.map((file, index) => (
                      <motion.div
                        key={file.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="group relative p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            file.file_type.includes('pdf') ? 'bg-red-500/20 text-red-400' :
                            file.file_type.includes('word') || file.file_type.includes('doc') ? 'bg-blue-500/20 text-blue-400' :
                            file.file_type.includes('excel') || file.file_type.includes('sheet') ? 'bg-green-500/20 text-green-400' :
                            'bg-gray-500/20 text-gray-400'
                          }`}>
                            <FileText className="w-5 h-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{file.filename}</p>
                            <p className="text-xs text-gray-500">{formatFileSize(file.file_size)}</p>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <motion.button
                              onClick={() => handleView(file.id)}
                              className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white"
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                            >
                              <Search className="w-4 h-4" />
                            </motion.button>
                            <motion.button
                              onClick={() => handleDelete(file.id)}
                              className="p-1.5 rounded-lg hover:bg-red-500/20 text-gray-400 hover:text-red-400"
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </motion.button>
                          </div>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Main Content */}
        <main className="flex-1 flex flex-col min-w-0">
          {showDrive ? (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }}
              className="flex-1 p-6 overflow-auto"
            >
              <div className="max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold flex items-center gap-2">
                    <Cloud className="w-6 h-6 text-cyan-400" />
                    Google Drive
                  </h2>
                  <motion.button
                    onClick={() => setShowDrive(false)}
                    className="p-2 rounded-lg hover:bg-white/10"
                    whileHover={{ scale: 1.05, rotate: 90 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <X className="w-5 h-5" />
                  </motion.button>
                </div>
                
                <div className="grid gap-3">
                  {driveFiles.length === 0 ? (
                    <motion.div 
                      className="text-center py-12"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      <Cloud className="w-16 h-16 mx-auto mb-4 text-gray-600" />
                      <p className="text-gray-400 mb-4">No files found or Google Drive not connected</p>
                      <motion.button
                        onClick={connectGoogleDrive}
                        className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-medium flex items-center gap-2 mx-auto"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <Cloud className="w-5 h-5" />
                        Connect Google Drive
                      </motion.button>
                    </motion.div>
                  ) : (
                    driveFiles.map((file, index) => (
                    <motion.div
                      key={file.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="p-4 rounded-xl glass flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center">
                          <Cloud className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                          <p className="font-medium">{file.name}</p>
                          <p className="text-xs text-gray-500">{file.mimeType}</p>
                        </div>
                      </div>
                      <motion.button
                        onClick={() => handleSyncDriveFile(file.id)}
                        className="px-4 py-2 rounded-lg bg-gradient-to-r from-violet-500 to-cyan-500 text-sm font-medium flex items-center gap-2"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <Upload className="w-4 h-4" />
                        Sync
                      </motion.button>
                    </motion.div>
                  )))}
                </div>
              </div>
            </motion.div>
          ) : (
            <>
              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-4xl mx-auto space-y-6">
                  {messages.length === 0 ? (
                    <motion.div 
                      className="h-full flex flex-col items-center justify-center text-center py-20"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.5 }}
                    >
                      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500/20 to-cyan-500/20 flex items-center justify-center mb-6">
                        <Sparkles className="w-10 h-10 text-violet-400" />
                      </div>
                      <h3 className="text-2xl font-bold mb-3">Welcome to MindVault</h3>
                      <p className="text-gray-400 max-w-md mb-6">
                        Upload documents and ask questions about them. Our AI will 
                        search through your files and provide accurate answers with sources.
                      </p>
                      <div className="flex flex-wrap justify-center gap-2">
                        {["What are my documents about?", "Summarize the key points", "Find specific information"].map((suggestion) => (
                          <motion.button
                            key={suggestion}
                            onClick={() => setInputMessage(suggestion)}
                            className="px-4 py-2 rounded-full glass text-sm text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            {suggestion}
                          </motion.button>
                        ))}
                      </div>
                    </motion.div>
                  ) : (
                    messages.map((message) => (
                      <motion.div
                        key={message.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                        className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        <div className={`max-w-[80%] ${message.role === "user" ? "items-end" : "items-start"}`}>
                          <div className={`p-4 rounded-2xl ${
                            message.role === "user" 
                              ? "bg-gradient-to-r from-violet-500 to-cyan-500 text-white" 
                              : "glass"
                          }`}>
                            <p className="leading-relaxed">{message.content}</p>
                          </div>
                          {message.sources && message.sources.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {message.sources.map((source, i) => (
                                <span 
                                  key={i} 
                                  className="text-xs px-2 py-1 rounded-full bg-white/10 text-gray-400"
                                >
                                  Source: {source}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))
                  )}
                  {isChatLoading && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex justify-start"
                    >
                      <div className="glass p-4 rounded-2xl flex items-center gap-3">
                        <motion.div
                          className="w-2 h-2 bg-violet-400 rounded-full"
                          animate={{ scale: [1, 1.5, 1] }}
                          transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
                        />
                        <motion.div
                          className="w-2 h-2 bg-cyan-400 rounded-full"
                          animate={{ scale: [1, 1.5, 1] }}
                          transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }}
                        />
                        <motion.div
                          className="w-2 h-2 bg-amber-400 rounded-full"
                          animate={{ scale: [1, 1.5, 1] }}
                          transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }}
                        />
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>

              {/* Chat Input */}
              <div className="p-4 border-t border-white/10">
                <div className="max-w-4xl mx-auto">
                  <div className="relative">
                    <input
                      type="text"
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                      placeholder="Ask about your documents..."
                      className="w-full bg-white/5 border border-white/10 rounded-2xl pl-5 pr-14 py-4 text-white placeholder-gray-500 focus:outline-none focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20 transition-all"
                    />
                    <motion.button
                      onClick={handleSendMessage}
                      disabled={!inputMessage.trim() || isChatLoading}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <ChevronRight className="w-5 h-5" />
                    </motion.button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    MindVault uses AI to search your documents. Responses may not always be accurate.
                  </p>
                </div>
              </div>
            </>
          )}
        </main>
      </div>

      {/* Document Viewer Modal */}
      <AnimatePresence>
        {viewing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setViewing(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-4xl max-h-[90vh] glass-strong rounded-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-violet-400" />
                  <span className="font-medium">{viewing.filename}</span>
                </div>
                <motion.button
                  onClick={() => setViewing(null)}
                  className="p-2 rounded-lg hover:bg-white/10"
                  whileHover={{ scale: 1.05, rotate: 90 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <X className="w-5 h-5" />
                </motion.button>
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
