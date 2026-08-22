"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import UploadZone from "@/components/UploadZone"
import FileList from "@/components/FileList"
import UploadProgress from "@/components/UploadProgress"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

interface FileItem {
  id: number
  filename: string
  file_type: string
  file_size: number
  uploaded_at: string
}

export default function Dashboard() {
  const router = useRouter()
  const [files, setFiles] = useState<FileItem[]>([])
  const [uploading, setUploading] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) router.push("/login")
    else fetchFiles()
  }, [router])

  const fetchFiles = async () => {
    const token = localStorage.getItem("token")
    const res = await fetch(`${API_URL}/api/files`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) setFiles(await res.json())
  }

  const handleUpload = async (file: File) => {
    const token = localStorage.getItem("token")
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
    const token = localStorage.getItem("token")
    await fetch(`${API_URL}/api/files/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    })
    fetchFiles()
  }

  const handleLogout = () => {
    localStorage.removeItem("token")
    router.push("/login")
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <nav className="bg-gray-800 p-4 flex justify-between items-center">
        <h1 className="text-xl font-bold">MindVault</h1>
        <button onClick={handleLogout} className="bg-red-600 px-4 py-2 rounded hover:bg-red-700">
          Logout
        </button>
      </nav>
      <main className="p-8 max-w-4xl mx-auto">
        <h2 className="text-2xl mb-6">Dashboard</h2>
        <UploadZone onUpload={handleUpload} />
        {uploading && <UploadProgress filename={uploading} progress={progress} />}
        <FileList files={files} onDelete={handleDelete} />
      </main>
    </div>
  )
}
