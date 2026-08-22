"use client"

import { useEffect, useState } from "react"

interface ToastProps {
  message: string
  type: "success" | "error" | "info"
  onClose: () => void
}

export function Toast({ message, type, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000)
    return () => clearTimeout(timer)
  }, [onClose])

  const bgColor = type === "error" ? "bg-red-600" : type === "success" ? "bg-green-600" : "bg-blue-600"

  return (
    <div className={`fixed bottom-4 right-4 ${bgColor} text-white px-4 py-3 rounded-lg shadow-lg z-50`}>
      <p>{message}</p>
    </div>
  )
}

export function useToast() {
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null)

  const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
    setToast({ message, type })
  }

  return { toast, showToast, hideToast: () => setToast(null) }
}
