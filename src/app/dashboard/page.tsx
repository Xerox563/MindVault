"use client";

import { useAuth, useUser, SignOutButton } from "@clerk/nextjs";
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";
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
  MessageCircle,
  Plus,
  Settings,
  MoreHorizontal,
  Download,
  ExternalLink,
  Zap,
  Shield,
  Cpu,
  LayoutGrid,
  FolderOpen,
  Clock,
  TrendingUp
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

// Custom hook for mouse position
function useMousePosition() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  
  useEffect(() => {
    const updateMousePosition = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", updateMousePosition);
    return () => window.removeEventListener("mousemove", updateMousePosition);
  }, []);
  
  return mousePosition;
}

// Glowing Button Component
const GlowingButton = ({ children, onClick, className = "", disabled = false }: any) => (
  <motion.button
    onClick={onClick}
    disabled={disabled}
    className={`relative group ${className}`}
    whileHover={{ scale: disabled ? 1 : 1.02 }}
    whileTap={{ scale: disabled ? 1 : 0.98 }}
  >
    <div className="absolute -inset-1 bg-gradient-to-r from-violet-500 to-cyan-500 rounded-xl blur opacity-20 group-hover:opacity-40 transition duration-500" />
    <div className="relative">
      {children}
    </div>
  </motion.button>
);

// Glass Card Component
const GlassCard = ({ children, className = "" }: any) => (
  <motion.div
    className={`relative overflow-hidden ${className}`}
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5 }}
  >
    <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-white/5 rounded-2xl backdrop-blur-xl border border-white/20" />
    <div className="relative z-10">
      {children}
    </div>
  </motion.div>
);

// Animated Background Orb
const FloatingOrb = ({ delay = 0, size = 300, color = "violet" }: any) => (
  <motion.div
    className="absolute rounded-full pointer-events-none"
    style={{
      width: size,
      height: size,
      background: `radial-gradient(circle, ${color === 'violet' ? 'rgba(139, 92, 246, 0.3)' : color === 'cyan' ? 'rgba(6, 182, 212, 0.3)' : 'rgba(245, 158, 11, 0.2)'} 0%, transparent 70%)`,
      filter: "blur(60px)",
    }}
    animate={{
      x: [0, 30, 0],
      y: [0, -30, 0],
      scale: [1, 1.1, 1],
    }}
    transition={{
      duration: 8,
      repeat: Infinity,
      ease: "easeInOut",
      delay,
    }}
  />
);

export default function Dashboard() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const mousePosition = useMousePosition();
  const containerRef = useRef<HTMLDivElement>(null);
  
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
  const [activeTab, setActiveTab] = useState("chat");
  const [isHoveringUpload, setIsHoveringUpload] = useState(false);

  const { scrollYProgress } = useScroll({ container: containerRef });
  const headerOpacity = useTransform(scrollYProgress, [0, 0.1], [0, 1]);

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
        const data = await res.json();
        if (data.detail?.includes("not connected")) {
          window.open(`${API_URL}/api/auth/google/connect`, "_blank", "width=500,height=600");
        }
      }
    } catch (error) {
      console.error("Failed to fetch drive files:", error);
    }
  };

  const handleUpload = async (file: File) => {
    const token = await getAuthToken();
    if (!token) return;
    
    setUploading(file.name);
    setUploadProgress(0);
    const formData = new FormData();
    formData.append("uploaded_file", file);  // Changed from "file" to "uploaded_file" to match backend
    
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
      
      console.log("Upload response status:", res.status);
      
      if (res.ok) {
        setUploadProgress(100);
        fetchFiles();
      } else {
        const errorData = await res.json();
        console.error("Upload failed:", errorData);
        alert(`Upload failed: ${errorData.detail || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Upload failed:", error);
      alert("Upload failed. Check console for details.");
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
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      // Validate file type
      const validTypes = ['.pdf', '.docx', '.xlsx', '.txt'];
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      if (validTypes.includes(ext)) {
        handleUpload(file);
      } else {
        alert(`Invalid file type. Allowed: ${validTypes.join(', ')}`);
      }
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
        <div className="relative">
          <motion.div
            className="w-16 h-16 rounded-full border-4 border-violet-500/20 border-t-violet-500"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          />
          <motion.div
            className="absolute inset-0 rounded-full bg-violet-500/20 blur-xl"
            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </div>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <Brain className="w-20 h-20 text-violet-500 mx-auto mb-6" />
          <p className="text-white text-xl mb-4">Please sign in to access the dashboard</p>
          <Link href="/login">
            <GlowingButton className="px-8 py-4 bg-gradient-to-r from-violet-500 to-cyan-500 rounded-xl text-white font-semibold">
              Sign In
            </GlowingButton>
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white overflow-hidden relative" ref={containerRef}>
      {/* Animated Background */}
      <div className="fixed inset-0 pointer-events-none">
        <AnimatedBackground />
        <FloatingOrb delay={0} size={400} color="violet" className="top-20 left-10" />
        <FloatingOrb delay={2} size={300} color="cyan" className="bottom-20 right-10" />
        <FloatingOrb delay={4} size={350} color="amber" className="top-1/2 left-1/3" />
      </div>
      
      {/* Spotlight Effect */}
      <div 
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          background: `radial-gradient(600px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(139, 92, 246, 0.1), transparent 40%)`,
        }}
      />

      {/* Header */}
      <motion.header 
        className="fixed top-0 left-0 right-0 z-50 px-6 py-4"
        style={{ opacity: headerOpacity }}
      >
        <div className="max-w-7xl mx-auto">
          <GlassCard className="px-6 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <motion.button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="p-2 rounded-xl hover:bg-white/10 transition-colors"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Menu className="w-5 h-5" />
                </motion.button>
                <Link href="/" className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center">
                      <Brain className="w-6 h-6 text-white" />
                    </div>
                    <motion.div
                      className="absolute -inset-1 bg-gradient-to-r from-violet-500 to-cyan-500 rounded-xl blur opacity-50"
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                  </div>
                  <span className="font-bold text-xl">
                    <GradientText>MindVault</GradientText>
                  </span>
                </Link>
              </div>
              
              <div className="flex items-center gap-4">
                <GlowingButton 
                  onClick={() => setActiveTab("chat")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl ${activeTab === "chat" ? "bg-white/20" : ""}`}
                >
                  <MessageCircle className="w-4 h-4" />
                  <span className="text-sm">Chat</span>
                </GlowingButton>
                
                <GlowingButton 
                  onClick={() => setActiveTab("files")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl ${activeTab === "files" ? "bg-white/20" : ""}`}
                >
                  <FolderOpen className="w-4 h-4" />
                  <span className="text-sm">Files</span>
                </GlowingButton>
                
                <div className="flex items-center gap-3 pl-4 border-l border-white/10">
                  {user?.imageUrl ? (
                    <motion.img
                      src={user.imageUrl}
                      alt={user.firstName || "User"}
                      className="w-10 h-10 rounded-full border-2 border-violet-500/50"
                      whileHover={{ scale: 1.1 }}
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center">
                      <User className="w-5 h-5" />
                    </div>
                  )}
                  <SignOutButton>
                    <motion.button
                      className="p-2 rounded-xl hover:bg-red-500/20 text-red-400 transition-colors"
                      whileHover={{ scale: 1.05 }}
                    >
                      <LogOut className="w-5 h-5" />
                    </motion.button>
                  </SignOutButton>
                </div>
              </div>
            </div>
          </GlassCard>
        </div>
      </motion.header>

      <div className="flex pt-24 h-screen">
        {/* Sidebar */}
        <AnimatePresence mode="wait">
          {sidebarOpen && (
            <motion.aside
              initial={{ x: -320, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -320, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="w-80 flex flex-col gap-6 p-6 overflow-y-auto"
            >
              {/* Upload Zone */}
              <motion.div
                className="relative"
                onMouseEnter={() => setIsHoveringUpload(true)}
                onMouseLeave={() => setIsHoveringUpload(false)}
              >
                <motion.div
                  className={`absolute -inset-1 rounded-2xl bg-gradient-to-r from-violet-500 to-cyan-500 opacity-20 blur transition-opacity ${isHoveringUpload ? "opacity-40" : ""}`}
                />
                <div 
                  className={`relative p-8 rounded-2xl border-2 border-dashed transition-all duration-300 ${
                    dragActive 
                      ? "border-violet-500 bg-violet-500/10 scale-[1.02]" 
                      : "border-white/20 hover:border-violet-500/50 bg-white/5"
                  }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  <input
                    type="file"
                    onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    accept=".pdf,.docx,.xlsx,.txt"
                  />
                  <div className="text-center">
                    <motion.div
                      className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/20 to-cyan-500/20 flex items-center justify-center mx-auto mb-4"
                      animate={{ y: isHoveringUpload ? -5 : 0 }}
                      transition={{ type: "spring" }}
                    >
                      <Plus className="w-8 h-8 text-violet-400" />
                    </motion.div>
                    <p className="text-sm text-gray-400">
                      Drop files or click to upload
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      PDF, DOCX, XLSX, TXT
                    </p>
                  </div>
                </div>
              </motion.div>

              {/* Upload Progress */}
              <AnimatePresence>
                {uploading && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <GlassCard className="p-4">
                      <div className="flex items-center justify-between text-xs mb-2">
                        <span className="text-gray-400 truncate">{uploading}</span>
                        <span className="text-violet-400 font-mono">{uploadProgress}%</span>
                      </div>
                      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-gradient-to-r from-violet-500 to-cyan-500 rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${uploadProgress}%` }}
                          transition={{ duration: 0.3 }}
                        />
                      </div>
                    </GlassCard>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Files List */}
              <div className="flex-1">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-400 flex items-center gap-2">
                    <FolderOpen className="w-4 h-4" />
                    Your Files
                  </h3>
                  <motion.span 
                    className="text-xs bg-violet-500/20 text-violet-300 px-2 py-1 rounded-full"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    key={files.length}
                  >
                    {files.length}
                  </motion.span>
                </div>
                
                <div className="space-y-3">
                  {files.length === 0 ? (
                    <motion.div 
                      className="text-center py-8 text-gray-600"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      <FileText className="w-10 h-8 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">No files yet</p>
                      <p className="text-xs mt-1">Upload your first document</p>
                    </motion.div>
                  ) : (
                    files.map((file, index) => (
                      <motion.div
                        key={file.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="group relative p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-violet-500/30 transition-all cursor-pointer"
                        whileHover={{ x: 5 }}
                      >
                        <div className="flex items-center gap-3">
                          <motion.div 
                            className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                              file.file_type.includes('pdf') ? 'bg-red-500/20 text-red-400' :
                              file.file_type.includes('word') || file.file_type.includes('doc') ? 'bg-blue-500/20 text-blue-400' :
                              file.file_type.includes('excel') || file.file_type.includes('sheet') ? 'bg-green-500/20 text-green-400' :
                              'bg-gray-500/20 text-gray-400'
                            }`}
                            whileHover={{ rotate: 5, scale: 1.1 }}
                          >
                            <FileText className="w-5 h-5" />
                          </motion.div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate group-hover:text-violet-300 transition-colors">{file.filename}</p>
                            <p className="text-xs text-gray-500">{formatFileSize(file.file_size)}</p>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <motion.button
                              onClick={(e) => { e.stopPropagation(); handleView(file.id); }}
                              className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white"
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                            >
                              <Search className="w-4 h-4" />
                            </motion.button>
                            <motion.button
                              onClick={(e) => { e.stopPropagation(); handleDelete(file.id); }}
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

              {/* Google Drive Button */}
              <GlowingButton 
                onClick={fetchDriveFiles}
                className="w-full py-4 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border border-blue-500/30 rounded-xl flex items-center justify-center gap-2 text-blue-300"
              >
                <Cloud className="w-5 h-5" />
                <span className="font-medium">Google Drive</span>
              </GlowingButton>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Main Content */}
        <main className="flex-1 flex flex-col min-w-0 p-6">
          {activeTab === "chat" ? (
            <div className="flex-1 flex flex-col">
              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto space-y-6 mb-6">
                {messages.length === 0 ? (
                  <motion.div 
                    className="h-full flex flex-col items-center justify-center text-center"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                  >
                    <div className="relative mb-8">
                      <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-violet-500/20 to-cyan-500/20 flex items-center justify-center">
                        <Sparkles className="w-12 h-12 text-violet-400" />
                      </div>
                      <motion.div
                        className="absolute -inset-2 rounded-2xl bg-gradient-to-r from-violet-500/20 to-cyan-500/20 blur-xl"
                        animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
                        transition={{ duration: 3, repeat: Infinity }}
                      />
                    </div>
                    <h3 className="text-3xl font-bold mb-4 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                      Welcome to MindVault
                    </h3>
                    <p className="text-gray-400 max-w-md mb-8 text-lg">
                      Upload documents and ask questions about them. Our AI will search through your files and provide accurate answers with sources.
                    </p>
                    <div className="flex flex-wrap justify-center gap-3">
                      {["What are my documents about?", "Summarize key points", "Find specific information"].map((suggestion, i) => (
                        <motion.button
                          key={suggestion}
                          onClick={() => setInputMessage(suggestion)}
                          className="px-6 py-3 rounded-full bg-white/5 border border-white/10 text-gray-300 hover:text-white hover:bg-white/10 hover:border-violet-500/50 transition-all"
                          whileHover={{ scale: 1.05, y: -2 }}
                          whileTap={{ scale: 0.95 }}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.1 }}
                        >
                          {suggestion}
                        </motion.button>
                      ))}
                    </div>
                  </motion.div>
                ) : (
                  messages.map((message, index) => (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                      className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div className={`max-w-[80%] ${message.role === "user" ? "items-end" : "items-start"}`}>
                        <motion.div 
                          className={`p-5 rounded-2xl relative ${
                            message.role === "user" 
                              ? "bg-gradient-to-r from-violet-500 to-cyan-500 text-white" 
                              : "bg-white/10 border border-white/20"
                          }`}
                          whileHover={{ scale: 1.01 }}
                        >
                          <p className="leading-relaxed">{message.content}</p>
                        </motion.div>
                        {message.sources && message.sources.length > 0 && (
                          <motion.div 
                            className="mt-3 flex flex-wrap gap-2"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.2 }}
                          >
                            {message.sources.map((source, i) => (
                              <span 
                                key={i} 
                                className="text-xs px-3 py-1.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30"
                              >
                                <Zap className="w-3 h-3 inline mr-1" />
                                {source}
                              </span>
                            ))}
                          </motion.div>
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
                    <div className="bg-white/10 border border-white/20 p-5 rounded-2xl flex items-center gap-4">
                      {[0, 1, 2].map((i) => (
                        <motion.div
                          key={i}
                          className="w-3 h-3 rounded-full bg-gradient-to-r from-violet-400 to-cyan-400"
                          animate={{ 
                            scale: [1, 1.5, 1],
                            opacity: [0.5, 1, 0.5]
                          }}
                          transition={{ 
                            duration: 0.6, 
                            repeat: Infinity, 
                            delay: i * 0.15 
                          }}
                        />
                      ))}
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Chat Input */}
              <GlassCard className="p-2">
                <div className="relative">
                  <input
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                    placeholder="Ask about your documents..."
                    className="w-full bg-transparent pl-6 pr-16 py-5 text-white placeholder-gray-500 focus:outline-none text-lg"
                  />
                  <motion.button
                    onClick={handleSendMessage}
                    disabled={!inputMessage.trim() || isChatLoading}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-12 h-12 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 flex items-center justify-center disabled:opacity-50"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <ChevronRight className="w-6 h-6" />
                  </motion.button>
                </div>
              </GlassCard>
            </div>
          ) : (
            <div className="flex-1">
              <h2 className="text-2xl font-bold mb-6">Files</h2>
              {/* Files grid view would go here */}
            </div>
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
              className="w-full max-w-4xl max-h-[90vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <GlassCard className="h-full">
                <div className="p-4 border-b border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-violet-400" />
                    <span className="font-medium">{viewing.filename}</span>
                  </div>
                  <motion.button
                    onClick={() => setViewing(null)}
                    className="p-2 rounded-lg hover:bg-white/10"
                    whileHover={{ scale: 1.1, rotate: 90 }}
                  >
                    <X className="w-5 h-5" />
                  </motion.button>
                </div>
                <div className="p-6 overflow-auto max-h-[70vh]">
                  <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono leading-relaxed">
                    {viewing.content}
                  </pre>
                </div>
              </GlassCard>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
