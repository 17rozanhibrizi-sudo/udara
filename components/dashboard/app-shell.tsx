"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Activity, BarChart3, HeartPulse, House, LayoutDashboard, ShieldCheck, Wind } from "lucide-react"
import { cn } from "@/lib/utils"

export const NAV_ITEMS = [
  { href: "/", label: "Homepage", icon: House },
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/pola-faktor", label: "Pola & Faktor", icon: BarChart3 },
  { href: "/dampak-kesehatan", label: "Dampak Kesehatan", icon: HeartPulse },
  { href: "/evaluasi", label: "Evaluasi & Rekomendasi", icon: ShieldCheck },
]

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label="Gelar Rasa - beranda">
      <span className="flex size-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
        <Wind className="size-5" aria-hidden />
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-sm font-bold tracking-tight text-sidebar-accent-foreground">Gelar Rasa</span>
        <span className="text-[11px] text-sidebar-foreground/70">Air Quality Intelligence</span>
      </span>
    </Link>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground lg:flex">
        <div className="px-5 pt-6 pb-8">
          <Logo />
        </div>
        <nav aria-label="Navigasi utama" className="flex flex-1 flex-col gap-1 px-3">
          <p className="px-3 pb-2 text-[11px] font-semibold tracking-wider text-sidebar-foreground/50 uppercase">Menu</p>
          {NAV_ITEMS.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                )}
              >
                <Icon
                  className={cn("size-4", active ? "text-sidebar-primary" : "text-sidebar-foreground/60")}
                  aria-hidden
                />
                {item.label}
                {active && <span className="ml-auto size-1.5 rounded-full bg-sidebar-primary" aria-hidden />}
              </Link>
            )
          })}
        </nav>
        <div className="m-3 rounded-xl border border-sidebar-border bg-sidebar-accent/40 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-sidebar-accent-foreground">
            <Activity className="size-3.5 text-sidebar-primary" aria-hidden />
            Status data
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-sidebar-foreground/70">
            Seluruh angka pada dasbor ini adalah <span className="font-semibold text-warning">data dummy</span> untuk
            keperluan prototipe.
          </p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 border-b border-sidebar-border bg-sidebar text-sidebar-foreground lg:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="[&_a]:gap-2">
              <Logo />
            </div>
            <span className="rounded-full bg-warning/20 px-2.5 py-1 text-[11px] font-semibold text-warning">
              Data dummy
            </span>
          </div>
          <nav aria-label="Navigasi utama" className="flex gap-1 overflow-x-auto px-3 pb-3">
            {NAV_ITEMS.map((item) => {
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "shrink-0 rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap",
                    active ? "bg-sidebar-primary text-sidebar-primary-foreground" : "text-sidebar-foreground/80",
                  )}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  )
}
