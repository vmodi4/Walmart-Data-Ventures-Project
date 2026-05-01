"use client"

import { useState } from "react"
import { Search, User } from "lucide-react"

const ALL_PRODUCTS = [
  "Oreo Double Stuf 20oz",
  "Chips Ahoy! Chunky 13oz",
  "Gatorade Thirst Quencher 32oz",
  "Lay's Classic Party Size",
  "Pepperidge Farm Milano",
  "Yoplait Original Strawberry",
  "Fritos Corn Chips 9.25oz",
  "Dasani Water 24pk",
]

export function DashboardToolbar() {
  const [query, setQuery] = useState("")
  const [focused, setFocused] = useState(false)

  const suggestions = query.trim().length > 0
    ? ALL_PRODUCTS.filter((p) =>
        p.toLowerCase().includes(query.toLowerCase())
      )
    : []

  const showDropdown = focused && suggestions.length > 0

  return (
    <div className="border-b border-border/60 bg-card">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-8 py-3">

        {/* Search bar */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            placeholder="Search products…"
            className="w-full rounded-lg border border-border bg-muted/40 py-2 pl-9 pr-4 text-sm text-midnight placeholder:text-slate focus:outline-none focus:ring-2 focus:ring-indigo/30 focus:border-indigo transition-colors"
          />
          {showDropdown && (
            <ul className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-card shadow-lg overflow-hidden">
              {suggestions.map((item) => {
                const idx = item.toLowerCase().indexOf(query.toLowerCase())
                return (
                  <li
                    key={item}
                    onMouseDown={() => setQuery(item)}
                    className="flex items-center px-4 py-2.5 text-sm text-midnight hover:bg-muted/60 cursor-pointer transition-colors"
                  >
                    <Search className="mr-2.5 h-3.5 w-3.5 flex-shrink-0 text-slate" />
                    <span>
                      {item.slice(0, idx)}
                      <span className="font-semibold text-indigo">{item.slice(idx, idx + query.length)}</span>
                      {item.slice(idx + query.length)}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Profile icon */}
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end">
            <span className="text-sm font-medium text-midnight leading-none">Sarah Chen</span>
            <span className="mt-0.5 text-xs text-slate leading-none">Supplier Manager</span>
          </div>
          <button
            aria-label="Open profile"
            className="flex h-9 w-9 items-center justify-center rounded-full text-white transition-colors focus:outline-none focus:ring-2 focus:ring-[#6366F1]/40"
            style={{ backgroundColor: "#6366F1" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#5254cc")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#6366F1")}
          >
            <User className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
