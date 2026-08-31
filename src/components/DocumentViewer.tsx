"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, FileText } from "lucide-react";

interface DocumentViewerProps {
  fileName: string;
  content: string;
  loading?: boolean;
  highlight?: string;
  onClose: () => void;
}

export default function DocumentViewer({ fileName, content, loading, highlight, onClose }: DocumentViewerProps) {
  const highlightRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    highlightRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [content, highlight]);

  // split the text around the cited snippet so we can highlight just that part
  const renderContent = () => {
    if (!highlight || !content) return <span>{content}</span>;
    const index = content.indexOf(highlight);
    if (index === -1) return <span>{content}</span>;
    const before = content.slice(0, index);
    const match = content.slice(index, index + highlight.length);
    const after = content.slice(index + highlight.length);
    return (
      <>
        <span>{before}</span>
        <span ref={highlightRef} className="bg-purple-500/30 ring-1 ring-purple-400/50 rounded px-0.5">{match}</span>
        <span>{after}</span>
      </>
    );
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-[#1a1a1a] border border-white/10 w-full max-w-3xl h-[80vh] rounded-2xl flex flex-col shadow-2xl overflow-hidden"
        >
          <div className="flex justify-between items-center p-4 border-b border-white/10 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="w-4 h-4 text-gray-400 shrink-0" />
              <h3 className="text-white font-medium truncate">{fileName}</h3>
            </div>
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-6 overflow-auto flex-1">
            {loading ? (
              <div className="h-full flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
              </div>
            ) : content ? (
              <pre className="text-gray-300 whitespace-pre-wrap text-sm leading-relaxed font-sans">{renderContent()}</pre>
            ) : (
              <p className="text-gray-500 text-center mt-10">No preview available for this file</p>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
