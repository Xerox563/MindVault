import { useCallback } from "react"

interface UploadZoneProps {
  onUpload: (file: File) => void
}

export default function UploadZone({ onUpload }: UploadZoneProps) {
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) onUpload(file)
  }, [onUpload])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) onUpload(file)
  }

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center hover:border-blue-500 transition-colors"
    >
      <p className="text-gray-400 mb-4">Drag & drop files here</p>
      <p className="text-gray-500 mb-2">Supported: PDF, DOCX, XLSX, TXT (max 50MB)</p>
      <label className="bg-blue-600 px-4 py-2 rounded cursor-pointer hover:bg-blue-700 inline-block">
        Browse Files
        <input type="file" className="hidden" onChange={handleChange} accept=".pdf,.docx,.xlsx,.txt" />
      </label>
    </div>
  )
}
