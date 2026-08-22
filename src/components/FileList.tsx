interface FileItem {
  id: number
  filename: string
  file_type: string
  file_size: number
  uploaded_at: string
}

interface FileListProps {
  files: FileItem[]
  onDelete: (id: number) => void
}

export default function FileList({ files, onDelete }: FileListProps) {
  return (
    <div className="mt-6">
      <h3 className="text-lg font-semibold mb-3 text-white">Uploaded Files ({files.length})</h3>
      <div className="space-y-2">
        {files.map((file) => (
          <div key={file.id} className="flex justify-between items-center bg-gray-800 p-3 rounded">
            <div>
              <p className="text-white">{file.filename}</p>
              <p className="text-gray-500 text-sm">{(file.file_size / 1024).toFixed(2)} KB</p>
            </div>
            <button onClick={() => onDelete(file.id)} className="text-red-500 hover:text-red-400">
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
