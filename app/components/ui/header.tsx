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
import { useEffect, useState } from "react";

const Header = () => {
  const path = usePathname();
  const [hidden, setHidden] = useState<boolean>(false);
  const [lastScrollY, setLastScrollY] = useState<number>(0);
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

  useEffect(() => {
    const handleScrollY = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY && currentScrollY > 90) {
        // Scrolling down
        setHidden(true);
      } else {
        // Scrolling up
        setHidden(false);
      }
      setLastScrollY(currentScrollY);
    };

    window.addEventListener("scroll", handleScrollY);
    return () => window.removeEventListener("scroll", handleScrollY);
  }, [lastScrollY]);
  
  return (
    <header
      className={clsx(
        "sticky top-0 z-20 border-b border-colorBorder transition-transform duration-300 ease-in-out backdrop-blur-sm backdrop-saturate-120 bg-colorBg/90",
        hidden ? "-translate-y-full" : "translate-y-0"
      )}
    >
      <nav className="max-w-[1440px] mx-auto flex items-center justify-between px-4 lg:px-8 py-2">
        {/* Logo */}
        <Link
          href="/"
          aria-label="Home"
          title="Go to home page"
          className="-mb-1 shrink-0"
        >
          <Logo width="w-30" height="h-auto" />
        </Link>

        {/* Clock */}
        <div className="shrink-0 md:ml-6">
          <Clock />
        </div>

        {/* Nav links */}
        <nav className="hidden md:flex items-center gap-6 ml-auto mr-6 shrink-0">
          {navItems.map(({ href, label, icon, title }, idx) => (
            <Link
              key={idx}
              href={href}
              aria-label={label}
              title={title}
              className={clsx(
                "inline-flex items-center gap-1 transition-colors duration-75 ease-in-out",
                path === href
                  ? "text-textGreen"
                  : "text-textPrimary hover:text-black dark:hover:text-white active:text-textGreen dark:active:text-primary"
              )}
            >
              {/* Icon: hidden on md; show on lg */}
              <span className="hidden lg:flex -mt-1"> {icon} </span>
              <span>{label}</span>
            </Link>
          ))}
        </nav>

        {/* Nav actions */}
        <div className="hidden md:flex items-center gap-4 shrink-0">
          <AuthActions />
          <ThemeToggle />
        </div>
      </nav>

      {/* Mobile */}
      <nav className="md:hidden flex justify-between items-center px-4 py-2 border-t border-colorBorder">
        {/* Left */}
        <nav className="flex items-center gap-[10px] shrink-0">
          {navItems.map(({ href, label, icon, title }, idx) => (
            <Link
              key={idx}
              href={href}
              aria-label={label}
              title={title}
              className={clsx(
                "inline-block p-[10px] rounded-full transition-colors duration-75 ease-in-out",
                path === href
                  ? "bg-primary text-white"
                  : "bg-secondary hover:bg-secondaryHover active:bg-secondaryActive text-white"
              )}
            >
              <span> {icon} </span>
            </Link>
          ))}
        </nav>

        {/* Right */}
        <div className="flex items-center gap-4 shrink-0">
          <AuthActions />
          <ThemeToggle />
        </div>
      </nav>
    </header>
  );
};

export default Header;
