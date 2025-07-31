// unauthorized/page.tsx

import { LockClosedIcon } from "@heroicons/react/24/outline";
import Logo from "@/components/logo";
import Button from "@/components/buttons/button";
import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md border-2 border-colorBorder rounded-xl p-8 text-center space-y-6">
        {/* Logo */}
        <div className="flex justify-center">
          <Link href="/" aria-label="Home" title="Go to home page">
            <Logo width="w-52" height="h-auto" />
          </Link>
        </div>

        {/* Icon */}
        <LockClosedIcon className="mx-auto size-16 text-danger animate-pulse-color-danger" />

        {/* Texts */}
        <h1 className="text-3xl font-bold text-black dark:text-white">
          Unauthorized Access
        </h1>
        <p className="text-muted">
          You need to log in to access this page. Please sign in to continue.
        </p>

        {/* Buttons */}
        <div className="flex justify-center gap-4 flex-wrap">
          <Button
            name="Return Home"
            level="secondary"
            padding="px-6 py-2"
            borderRadius="rounded-lg"
            href="/"
            ariaLabel="Home"
            title="Go to home page"
          />
          <Button
            name="Go to login"
            level="primary"
            padding="px-6 py-2"
            borderRadius="rounded-lg"
            href="/login"
            ariaLabel="Login"
            title="Go to login page"
          />
        </div>
      </div>
    </main>
  );
}
