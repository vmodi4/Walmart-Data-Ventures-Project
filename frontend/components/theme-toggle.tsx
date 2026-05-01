"use client"

import { useTheme } from "next-themes"
import { Sun, Moon } from "lucide-react"
import { useEffect, useState } from "react"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Avoid hydration mismatch
  useEffect(() => setMounted(true), [])
  if (!mounted) return <div className="h-9 w-9" />

  const isDark = theme === "dark"

  return (
    <button
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-midnight transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-indigo/40"
    >
      {isDark ? (
        <Sun className="h-4 w-4 text-amber" />
      ) : (
        <Moon className="h-4 w-4 text-slate" />
      )}
    </button>
  )
}
