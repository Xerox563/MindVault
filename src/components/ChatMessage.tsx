interface Source {
  chunk_id: number
  file_name: string
  content: string
}

interface ChatMessageProps {
  question: string
  answer: string
  sources: Source[]
}

export default function ChatMessage({ question, answer, sources }: ChatMessageProps) {
  return (
    <div className="mb-4">
      <div className="bg-gray-800 p-4 rounded-lg mb-2">
        <p className="text-blue-400 font-semibold mb-1">You:</p>
        <p className="text-white">{question}</p>
      </div>
      <div className="bg-gray-700 p-4 rounded-lg">
        <p className="text-green-400 font-semibold mb-1">Assistant:</p>
        <p className="text-white mb-3">{answer}</p>
        {sources.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-600">
            <p className="text-gray-400 text-sm mb-2">Sources:</p>
            {sources.map((s, i) => (
              <div key={i} className="text-sm text-gray-300 bg-gray-800 p-2 rounded mb-1">
                <span className="font-semibold">{s.file_name}</span>: {s.content.slice(0, 100)}...
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
