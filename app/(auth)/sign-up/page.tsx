'use client'

import { useState } from 'react'

export default function SignUpPage() {
  const [form, setForm] = useState({
    fullName: '',
    phoneNumber: '',
    gender: 'male',
    email: '',
    password: '',
  })
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState<'request' | 'verify'>('request')

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    const res = await fetch('/api/auth/sign-up', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: form.email }),
    })
    const data = await res.json()
    alert(data.message || data.error)
    if (!data.error) setStep('verify')
  }

  const handleOtpVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    const res = await fetch('/api/auth/otp-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: form.email, otpCode: otp }),
    })
    const data = await res.json()
    alert(data.message || data.error)
    if (!data.error) {
      alert('OTP verified! Now complete your registration if needed.')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f0f0f] text-white px-4">
      <div className="w-full max-w-md space-y-6 p-8 rounded-2xl shadow-lg bg-[#1a1a1a]">
        <h1 className="text-2xl font-semibold text-center">
          {step === 'request' ? 'Sign Up' : 'Verify OTP'}
        </h1>

        {step === 'request' ? (
          <form onSubmit={handleSignUp} className="space-y-4">
            <input
              type="text"
              placeholder="Full Name"
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              required
              className="w-full p-3 rounded-md bg-[#2a2a2a] text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="tel"
              placeholder="Phone Number"
              value={form.phoneNumber}
              onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
              required
              className="w-full p-3 rounded-md bg-[#2a2a2a] text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <select
              name="gender"
              title='gender'
              value={form.gender}
              onChange={(e) => setForm({ ...form, gender: e.target.value })}
              className="w-full p-3 rounded-md bg-[#2a2a2a] text-white border border-gray-600"
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
            <input
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              className="w-full p-3 rounded-md bg-[#2a2a2a] text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="password"
              placeholder="Password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              className="w-full p-3 rounded-md bg-[#2a2a2a] text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition"
            >
              Request OTP
            </button>
          </form>
        ) : (
          <form onSubmit={handleOtpVerify} className="space-y-4">
            <input
              type="text"
              placeholder="Enter OTP"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              required
              className="w-full p-3 rounded-md bg-[#2a2a2a] text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <button
              type="submit"
              className="w-full py-2 px-4 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition"
            >
              Verify OTP
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
