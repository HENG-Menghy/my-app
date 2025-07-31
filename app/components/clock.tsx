// @/components/clock.tsx

import { useEffect, useState } from "react";

const Clock = () => {
  const [date, setDate] = useState<Date | null>(null);

  useEffect(() => {
    setDate(new Date());
    const timer = setInterval(() => {
      setDate(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  if (!date) return null; // Avoid hydration mismatch

  const timeString = date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZone: "Asia/Phnom_Penh",
  });

  const dateString = date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "2-digit",
    timeZone: "Asia/Phnom_Penh",
  });

  return (
    <div className="flex flex-col items-center justify-center px-2 py-[2px] rounded-md border border-colorBorder bg-transparent select-none">
      <span className="tracking-wide font-semibold text-primary">{timeString}</span>
      <span className="italic text-black dark:text-white">{dateString}</span>
    </div>
  );
};

export default Clock;
