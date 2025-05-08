'use client'

import { signIn } from "next-auth/react"
import { useState } from "react"

export default function SignInPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    const response = await signIn("credentials", {
      email,
      password,
      redirect: false,
    })
    if (response?.error) {
      alert(response.error)
    } else {
      alert("Signed in successfully")
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f0f0f] text-white px-4">
      <div className="w-full max-w-md space-y-6 p-8 rounded-2xl shadow-lg bg-[#1a1a1a]">
        <h1 className="text-2xl font-semibold text-center">Sign In</h1>

        <button
          onClick={() => signIn("google")}
          className="w-full py-2 px-4 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition"
        >
          Sign in with Google
        </button>

        <form onSubmit={handleSignIn} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full p-3 rounded-md bg-[#2a2a2a] text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full p-3 rounded-md bg-[#2a2a2a] text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition"
          >
            Sign In
          </button>
        </form>
      </div>
    </div>
  )
}
