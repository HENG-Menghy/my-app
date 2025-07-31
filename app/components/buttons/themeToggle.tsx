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
  const title =
    theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode";
  if (!mounted) return null;

  return (
    <>
      {mounted && (
        <button
          type="button"
          onClick={toggleTheme}
          title={title}
          className="inline-block rounded-full p-[10px] cursor-pointer transition-colors duration-75 border border-colorBorder hover:bg-gray-400 dark:hover:bg-gray-500 hover:border-transparent hover:text-white text-black dark:text-white"
        >
          {theme === "dark" ? (
            <SunIcon className="size-5 transition-transform duration-75" />
          ) : (
            <MoonIcon className="size-[18px] transition-transform duration-75" />
          )}
        </button>
      )}
    </>
  );
}

export default ThemeToggle;
