// forbidden/page.tsx

import Link from "next/link";
import { NoSymbolIcon } from "@heroicons/react/24/outline";
import Logo from "@/components/logo";
import Button from "@/components/buttons/button";

export default function ForbiddenPage() {
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
        <NoSymbolIcon className="mx-auto size-16 text-warning animate-pulse-scale" />

        {/* Texts */}
        <h1 className="text-3xl font-bold text-black dark:text-white">
          Access Denied
        </h1>
        <p className="text-muted">
          You don’t have permission to access this page. Please contact support
          or return home.
        </p>

        {/* Button */}
        <Button
          name="Return Home"
          level="primary"
          padding="px-6 py-2"
          borderRadius="rounded-lg"
          href="/"
          ariaLabel="Home"
          title="Go to home page"
        />
      </div>
    </main>
  );
}
