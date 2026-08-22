"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import UploadZone from "@/components/UploadZone"
import FileList from "@/components/FileList"
import UploadProgress from "@/components/UploadProgress"
import ChatPanel from "@/components/ChatPanel"
import DocumentViewer from "@/components/DocumentViewer"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

interface FileItem {
  id: number
  filename: string
  file_type: string
  file_size: number
  uploaded_at: string
}

interface ContentView {
  content: string
  file_type: string
  filename: string
}

export default function Dashboard() {
  const router = useRouter()
  const [files, setFiles] = useState<FileItem[]>([])
  const [uploading, setUploading] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [viewing, setViewing] = useState<ContentView | null>(null)
  const [token, setToken] = useState("")

  useEffect(() => {
    const t = localStorage.getItem("token")
    if (!t) router.push("/login")
    else {
      setToken(t)
      fetchFiles(t)
    }
  }, [router])

  const fetchFiles = async (t?: string) => {
    const tok = t || token
    const res = await fetch(`${API_URL}/api/files`, {
      headers: { Authorization: `Bearer ${tok}` },
    })
    if (res.ok) setFiles(await res.json())
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

  const handleLogout = () => {
    localStorage.removeItem("token")
    router.push("/login")
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      <nav className="bg-gray-800 p-4 flex justify-between items-center">
        <h1 className="text-xl font-bold">MindVault</h1>
        <button onClick={handleLogout} className="bg-red-600 px-4 py-2 rounded hover:bg-red-700">
          Logout
        </button>
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
                <button onClick={() => handleDelete(f.id)} className="text-red-500 text-sm hover:text-red-400">
                  ✕
                </button>
              </div>
            ))}
          </div>
        </aside>
        <main className="flex-1 overflow-hidden">
          <ChatPanel token={token} />
        </main>
      </div>
      {viewing && (
        <DocumentViewer content={viewing.content} fileType={viewing.file_type} onClose={() => setViewing(null)} />
      )}
    </div>
  )
}
