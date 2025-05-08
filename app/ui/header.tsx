"use client";

import Image from "next/image";
import Link from "next/link";
import Clock from "./clock";

const Header = () => {
  return (
    <nav className="w-full px-5 md:px-10 py-1 flex justify-between items-center border-b-2 border-gray-800 bg-[var(--background)/60] backdrop-blur-md shadow-[0_2px_10px_rgba(0,0,0,0.5)] z-20">
      <Link href="/" className="cursor-pointer space-x-3 flex items-center">
        <Image 
          src="/mrms.png"
          alt="Next.js svg"
          width={90}
          height={90}
          className="block md:hidden"
        />

        <Image 
          src="/mrms.png"
          alt="Next.js svg"
          width={120}
          height={120}
          className="hidden md:block"
        />
      </Link>
      <div>
        <Clock />
      </div>
      <div className="flex gap-4">
        <>
          <Link href="/login">
            <button className="px-4 py-2 text-xs md:text-base tracking-wider cursor-pointer rounded-md border-2 border-transparent hover:bg-[#d6fbee] hover:border-[#d6fbee] hover:underline hover:text-[var(--primary-color)] transition-all duration-200"> Login </button>
          </Link>
          <Link href="/sign-up">
            <button className="px-4 py-2 text-xs md:text-base tracking-wider cursor-pointer rounded-md  border-2 text-[var(--primary-color)] border-[#39c083] hover:text-white hover:bg-[var(--primary-color)] hover:underline transition-all duration-200"> Sign up </button>
          </Link>
        </>
      </div>
    </nav>

  )
}

export default Header
