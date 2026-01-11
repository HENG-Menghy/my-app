// @/components/buttons/themeToggle.tsx

import { useEffect, useState } from "react";
import { SunIcon, MoonIcon } from "@heroicons/react/24/outline";
import { useTheme } from "next-themes";

const ThemeToggle = () => {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };
  const theme = resolvedTheme === "dark" ? "dark" : "light";

  if (!mounted) return null;

  return (
    <>
      {mounted && (
        <button
          type="button"
          onClick={toggleTheme}
          className="inline-block cursor-pointer text-textSecondary hover:text-black dark:hover:text-white"
        >
          {theme === "dark" ? (
            <MoonIcon className="size-5 transition-transform duration-75 ease-in-out" />
          ) : (
            <SunIcon className="size-5 transition-transform duration-75 ease-in-out" />
          )}
        </button>
      )}
    </>
  );
};

export default ThemeToggle;
