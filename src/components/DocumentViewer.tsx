"use client"

import { useState } from "react"

interface DocumentViewerProps {
  content: string
  fileType: string
  onClose: () => void
}

export default function DocumentViewer({ content, fileType, onClose }: DocumentViewerProps) {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-gray-800 w-full max-w-4xl h-5/6 rounded-lg flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-gray-700">
          <h3 className="text-white font-semibold">Document Preview</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>
        <div className="p-6 overflow-auto flex-1">
          <pre className="text-gray-300 whitespace-pre-wrap text-sm">{content}</pre>
        </div>
      </div>
    </div>
  )
}
