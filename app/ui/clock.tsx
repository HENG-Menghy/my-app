import { useEffect, useState } from 'react'

export default function Clock() {
  const [date, setDate] = useState<Date | null>(null)

  useEffect(() => {
    setDate(new Date())
    const timer = setInterval(() => {
      setDate(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  if (!date) return null // Avoid hydration mismatch

  const timeString = date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZone: 'Asia/Phnom_Penh',
  })

  const dateString = date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: '2-digit',
    timeZone: 'Asia/Phnom_Penh',
  })

  return (
    <div className="flex flex-col items-center justify-center text-white font-semibold">
      <h1 className="tracking-wider text-lg md:text-2xl font-bold text-[var(--primary-color)] drop-shadow-sm">
        {timeString}
      </h1>
      <h1 className="tracking-wide text-gray-300 text-sm md:text-lg italic">
        {dateString}
      </h1>
    </div>
  )
  
}
