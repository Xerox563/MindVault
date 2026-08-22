"use client"

import { useEffect, useState } from "react"
import UploadZone from "@/components/UploadZone"
import UploadProgress from "@/components/UploadProgress"
import ChatPanel from "@/components/ChatPanel"
import DocumentViewer from "@/components/DocumentViewer"
import DriveConnect from "@/components/DriveConnect"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

interface FileItem {
  id: number
  filename: string
  file_type: string
  file_size: number
  source?: string
}

interface DriveFile {
  id: string
  name: string
  mimeType: string
}

interface ContentView {
  content: string
  file_type: string
  filename: string
}

export default function Dashboard() {
  const [files, setFiles] = useState<FileItem[]>([])
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([])
  const [uploading, setUploading] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [viewing, setViewing] = useState<ContentView | null>(null)
  const [token, setToken] = useState("")
  const [showDrive, setShowDrive] = useState(false)

  useEffect(() => {
    const t = localStorage.getItem("token")
    if (!t) window.location.href = "/login"
    else {
      setToken(t)
      fetchFiles(t)
    }
  }, [])

  const fetchFiles = async (t?: string) => {
    const tok = t || token
    const res = await fetch(`${API_URL}/api/files`, {
      headers: { Authorization: `Bearer ${tok}` },
    })
    if (res.ok) setFiles(await res.json())
  }

  const fetchDriveFiles = async () => {
    const res = await fetch(`${API_URL}/api/drive/files`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) {
      setDriveFiles(await res.json())
      setShowDrive(true)
    }
  }

  const handleUpload = async (file: File) => {
    setUploading(file.name)
    setProgress(0)
    const formData = new FormData()
    formData.append("file", file)
    try {
      const res = await fetch(`${API_URL}/api/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      if (res.ok) {
        setProgress(100)
        fetchFiles()
      }
    } finally {
      setTimeout(() => setUploading(null), 1000)
    }
  }

  const handleDelete = async (id: number) => {
    await fetch(`${API_URL}/api/files/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    })
    fetchFiles()
  }

  const handleView = async (id: number) => {
    const res = await fetch(`${API_URL}/api/files/${id}/content`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) setViewing(await res.json())
  }

  const handleSyncDriveFile = async (fileId: string) => {
    await fetch(`${API_URL}/api/sync/drive/${fileId}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    })
    fetchFiles()
    setShowDrive(false)
  }

  const handleLogout = () => {
    localStorage.removeItem("token")
    window.location.href = "/login"
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      <nav className="bg-gray-800 p-4 flex justify-between items-center">
        <h1 className="text-xl font-bold">MindVault</h1>
        <div className="flex gap-2">
          <DriveConnect token={token} />
          <button onClick={fetchDriveFiles} className="bg-gray-700 px-4 py-2 rounded hover:bg-gray-600">
            Browse Drive
          </button>
          <button onClick={handleLogout} className="bg-red-600 px-4 py-2 rounded hover:bg-red-700">
            Logout
          </button>
        </div>
      </nav>
      <div className="flex flex-1 overflow-hidden">
        <aside className="w-80 bg-gray-850 border-r border-gray-700 p-4 overflow-auto">
          <h2 className="text-lg font-semibold mb-4">Upload Documents</h2>
          <UploadZone onUpload={handleUpload} />
          {uploading && <UploadProgress filename={uploading} progress={progress} />}
          <div className="mt-6">
            <h3 className="text-sm font-semibold mb-2 text-gray-400">Files ({files.length})</h3>
            {files.map((f) => (
              <div key={f.id} className="bg-gray-800 p-2 rounded mb-2 flex justify-between items-center">
                <button onClick={() => handleView(f.id)} className="text-left flex-1 hover:text-blue-400">
                  <p className="text-sm truncate">{f.filename}</p>
                </button>
                <span className="text-xs text-gray-500 mr-2">{f.source === "drive" ? "📁" : "💻"}</span>
                <button onClick={() => handleDelete(f.id)} className="text-red-500 text-sm hover:text-red-400">
                  ✕
                </button>
              </div>
            ))}
          </div>
        </aside>
        <main className="flex-1 overflow-hidden">
          {showDrive ? (
            <div className="p-4">
              <div className="flex justify-between mb-4">
                <h2 className="text-lg font-semibold">Google Drive Files</h2>
                <button onClick={() => setShowDrive(false)} className="text-gray-400 hover:text-white">✕</button>
              </div>
              <div className="grid gap-2">
                {driveFiles.map((f) => (
                  <div key={f.id} className="bg-gray-800 p-3 rounded flex justify-between items-center">
                    <p className="text-sm">{f.name}</p>
                    <button onClick={() => handleSyncDriveFile(f.id)} className="bg-blue-600 text-sm px-3 py-1 rounded hover:bg-blue-700">
                      Sync
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <ChatPanel token={token} />
          )}
        </main>
      </div>
      {viewing && (
        <DocumentViewer content={viewing.content} fileType={viewing.file_type} onClose={() => setViewing(null)} />
      )}
    </div>
  )
}
