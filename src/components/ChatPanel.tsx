"use client"

import { useState } from "react"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

interface ChatPanelProps {
  token: string
}

export default function ChatPanel({ token }: ChatPanelProps) {
  const [messages, setMessages] = useState<Array<{question: string, answer: string, sources: any[]}>>([])
  const [loading, setLoading] = useState(false)

  const handleSend = async (question: string) => {
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/api/ask`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ question }),
      })
      const data = await res.json()
      setMessages([...messages, { question, answer: data.answer, sources: data.sources }])
    } catch (err) {
      setMessages([...messages, { question, answer: "Error getting response", sources: [] }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto p-4">
        {messages.length === 0 && (
          <p className="text-gray-500 text-center mt-10">Upload documents and ask questions</p>
        )}
        {messages.map((msg, i) => (
          <div key={i} className="mb-4">
            <div className="bg-gray-800 p-3 rounded-lg mb-2">
              <p className="text-blue-400 font-semibold">You:</p>
              <p className="text-white">{msg.question}</p>
            </div>
            <div className="bg-gray-700 p-3 rounded-lg">
              <p className="text-green-400 font-semibold">Assistant:</p>
              <p className="text-white">{msg.answer}</p>
              {msg.sources.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-600">
                  <p className="text-gray-400 text-sm">Sources:</p>
                  {msg.sources.map((s: any, j: number) => (
                    <div key={j} className="text-sm text-gray-300 bg-gray-800 p-2 rounded mt-1">
                      {s.file_name}: {s.content?.slice(0, 100)}...
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="p-4 border-t border-gray-700">
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            const form = e.target as HTMLFormElement
            const input = form.elements.namedItem("message") as HTMLInputElement
            if (input.value.trim()) {
              handleSend(input.value)
              input.value = ""
            }
          }}
          className="flex gap-2"
        >
          <input
            name="message"
            type="text"
            placeholder="Ask about your documents..."
            className="flex-1 bg-gray-700 text-white p-3 rounded-lg"
            disabled={loading}
          />
          <button
            type="submit"
            className="bg-blue-600 px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            disabled={loading}
          >
            Send
          </button>
        </form>
      </div>
    </div>
  )
}
