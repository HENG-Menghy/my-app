"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log("Email:", email);
    console.log("Password:", password);
  };

  return (
    <div className="h-screen flex justify-center items-center">
      <form
        onSubmit={handleSubmit}
        className="bg-gradient-to-tr from-neutral-500 to-amber-50 p-6 rounded-lg shadow-lg w-100 flex flex-col items-center gap-5"
      >
        <Link href="/" className="cursor-pointer">
          <div className="py-2 px-4 mb-3 bg-amber-100"> 
            <Image 
             src="/next.svg"
             alt="Next.js svg"
             width={130}
             height={130}
            />
          </div>
        </Link>
        <h1 className="text-2xl font-extrabold text-center text-amber-100 tracking-widest">Login</h1>

        {/* Email Input */}
        <input
          type="email"
          placeholder="Email"
          className="w-full px-3 py-2 border rounded mb-3 placeholder:text-amber-100 border-amber-100"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        {/* Password Input */}
        <input
          type="password"
          placeholder="Password"
          className="w-full px-3 py-2 border rounded mb-3 placeholder:text-amber-100 border-amber-100"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {/* Submit Button */}
        <button
          type="submit"
          className="w-full bg-blue-700 text-white py-2 rounded hover:bg-blue-800 cursor-pointer tracking-widest"
        >
          Login
        </button>
      </form>
    </div>
  );
}
