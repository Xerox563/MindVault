interface UploadProgressProps {
  filename: string
  progress: number
}

export default function UploadProgress({ filename, progress }: UploadProgressProps) {
  return (
    <div className="bg-gray-800 p-3 rounded mb-2">
      <p className="text-white mb-2">{filename}</p>
      <div className="w-full bg-gray-700 rounded h-2">
        <div className="bg-blue-600 h-2 rounded transition-all" style={{ width: `${progress}%` }} />
      </div>
      <p className="text-gray-400 text-sm mt-1">{progress}% uploading...</p>
    </div>
  )
}
