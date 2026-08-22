"use client"

import { useState } from "react"

interface ChatInputProps {
  onSend: (message: string) => void
  disabled?: boolean
}

export default function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [input, setInput] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (input.trim()) {
      onSend(input.trim())
      setInput("")
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Ask about your documents..."
        className="flex-1 bg-gray-700 text-white p-3 rounded-lg"
        disabled={disabled}
      />
      <button type="submit" className="bg-blue-600 px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50" disabled={disabled || !input.trim()}>
        Send
      </button>
    </form>
  )
}
