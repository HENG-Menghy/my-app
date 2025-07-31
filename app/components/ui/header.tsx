// @/components/ui/header.tsx

"use client";

import Link from "next/link";
import Clock from "../clock";
import ThemeToggle from "../buttons/themeToggle";
import Logo from "../logo";
import {
  HomeIcon,
  CalendarDaysIcon,
  BuildingOffice2Icon,
} from "@heroicons/react/24/outline";
import clsx from "clsx";
import { usePathname } from "next/navigation";
import AuthActions from "./authActions";

const Header = () => {
  const path = usePathname();
  const navItems = [
    {
      href: "/home",
      label: "Home",
      icon: <HomeIcon className="size-5" />,
      title: "Go to home page",
    },
    {
      href: "/meeting",
      label: "Meeting List",
      icon: <CalendarDaysIcon className="size-5" />,
      title: "Go to meeting list page",
    },
    {
      href: "/room",
      label: "Room",
      icon: <BuildingOffice2Icon className="size-5" />,
      title: "Go to room page",
    },
  ];

  return (
    <header className="sticky top-0 z-20 border-b border-colorBorder">
      <nav className="max-w-[1440px] mx-auto flex items-center justify-between px-4 py-[6px] backdrop-blur-md">
        {/* Logo */}
        <Link
          href="/"
          aria-label="Home"
          title="Go to home page"
          className="flex items-center -mb-1 shrink-0"
        >
          <Logo width="w-30" height="h-auto" />
        </Link>

        {/* Nav links */}
        <nav className="hidden md:flex items-center gap-6 ml-10 mr-auto shrink-0">
          {navItems.map(({ href, label, icon, title }, idx) => (
            <Link
              key={idx}
              href={href}
              aria-label={label}
              title={title}
              className={clsx(
                "inline-flex items-center gap-2",
                path === href
                  ? "text-primary"
                  : "text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white active:text-primary dark:active:text-primary"
              )}
            >
              {/* Icon: hidden on md; show on lg */}
              <span className="hidden lg:flex"> {icon} </span>
              <span className="-mb-[6px]">{label}</span>
            </Link>
          ))}
        </nav>

        {/* Clock */}
        <div className="flex items-center md:hidden shrink-0">
          <Clock />
        </div>

        {/* Nav actions */}
        <div className="hidden md:flex items-center gap-2 shrink-0">
          <Clock />
          <ThemeToggle />
          <AuthActions />
        </div>
      </nav>

      {/* Mobile action */}
      <nav className="md:hidden flex justify-between items-center px-4 py-[6px] border-t border-colorBorder backdrop-blur-md">
        {/* Left */}
        <nav className="flex items-center gap-2 shrink-0">
          {navItems.map(({ href, label, icon, title }, idx) => (
            <Link
              key={idx}
              href={href}
              aria-label={label}
              title={title}
              className={clsx(
                "inline-block p-[10px] rounded-full border",
                path === href
                  ? "border-primary bg-primary text-white"
                  : "border-colorBorder hover:border-transparent active:border-transparent hover:text-white active:text-white hover:bg-gray-400 active:bg-primary dark:hover:bg-gray-600  dark:active:bg-primary"
              )}
            >
              <span> {icon} </span>
            </Link>
          ))}
        </nav>

        {/* Right */}
        <div className="flex items-center gap-2 shrink-0">
          <ThemeToggle />
          <AuthActions />
        </div>
      </nav>
    </header>
  );
};

export default Header;
