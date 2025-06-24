"use client";

import Image from "next/image";
import Link from "next/link";
import Clock from "./clock";

const Header = () => {
  return (
    <nav className="w-full px-5 py-2 flex justify-between items-center border-b border-gray-800 bg-[var(--background)/60] backdrop-blur-md shadow-lg z-20">
      <Link href="/" className="cursor-pointer flex items-center">
        <Image
          src="/mrms.png"
          alt="System logo"
          width={90}
          height={90}
          className="block md:hidden"
        />
        <Image
          src="/mrms.png"
          alt="System logo"
          width={130}
          height={130}
          className="hidden md:block"
        />
      </Link>

      <div className="max-[425px]:hidden -mt-1">
        <Clock />
      </div>
      <div className="md:flex gap-3 hidden">
        <Link href="/login">
          <button className="px-4 py-2 text-xs md:text-base tracking-wide cursor-pointer rounded-md border-2 border-transparent hover:bg-[#d6fbee] hover:border-[#d6fbee] hover:underline hover:text-[var(--primary-color)] transition duration-200">
            Login
          </button>
        </Link>
        <Link href="/sign-up">
          <button className="px-4 py-2 text-xs md:text-base tracking-wide cursor-pointer rounded-md  border-2 text-[var(--primary-color)] border-[var(--primary-hover)] hover:text-white hover:bg-[var(--primary-color)] hover:underline transition duration-200">
            Sign up
          </button>
        </Link>
      </div>

      <div className="md:hidden flex ml-10 cursor-pointer">=</div>
    </nav>
  );
};

export default Header;
