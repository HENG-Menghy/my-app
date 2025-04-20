"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Home() {
  const pathname = usePathname();
  return (
    <>
     <nav className="w-full p-5 md:py-7 md:px-10 bg-gradient-to-r from-sky-100 to-amber-50 flex justify-between items-center fixed top-0">
        <div className="cursor-pointer">
          <Image 
            src="/next.svg"
            alt="Next.js svg"
            width={180}
            height={180}
            className="hidden md:block"
          />
          <Image 
            src="/next.svg"
            alt="Next.js svg"
            width={130}
            height={130}
            className="block md:hidden"
          />
        </div>
        <div className="flex gap-3 md:gap-8">
          <Link
            href="/login"
            className={`
              p-2 underline-offset-4 hover:text-amber-100 hover:underline
              ${
                pathname === "/login"
                  ? "underline text-amber-100"
                  : "text-gray-900 "
              }
            `}
          >
            Login
          </Link>
          <Link
            href="/register"
            className={`
              p-2 underline-offset-4 hover:text-amber-100 hover:underline hover:border hover:rounded-md
              ${
                pathname === "/signup"
                  ? "underline text-amber-100 border rounded-md"
                  : "text-gray-900 "
              }
            `}
          >
            Create account
          </Link>
        </div>
      </nav>
    </>
  );
}
