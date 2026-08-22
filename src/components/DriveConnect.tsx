"use client"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

export default function DriveConnect({ token }: { token: string }) {
  const handleConnect = async () => {
    const res = await fetch(`${API_URL}/api/auth/google/connect`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json()
    if (data.auth_url) {
      window.location.href = data.auth_url
    }
  }

  return (
    <button onClick={handleConnect} className="bg-gray-700 text-white px-4 py-2 rounded hover:bg-gray-600 flex items-center gap-2">
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12.01 1.485c-2.082 0-3.754.02-3.743.047.01.02 1.708 3.001 3.774 6.62l3.76 6.574h3.76c2.081 0 3.753-.02 3.742-.047-.005-.02-1.708-3.001-3.775-6.62l-3.76-6.574h-3.758zm-5.735 1.04l-6.267 10.967 1.884 3.296 1.885 3.297h3.77l-1.893-3.313-1.894-3.313 4.427-7.744c2.435-4.259 4.427-7.757 4.427-7.774 0-.022-.838-.033-1.863-.033h-1.863l-2.613 4.617zm8.16 10.935l-1.884 3.296-1.885 3.297h6.518l1.884 3.313 1.885 3.313 1.863-.022 1.863-.033-3.76-6.62-3.76-6.575h-2.724z"/>
      </svg>
      Connect Drive
    </button>
  )
}
