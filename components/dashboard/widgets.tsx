import { cn } from "@/lib/utils"

export function PageHeader({
  eyebrow,
  title,
  description,
  dummy = true,
}: {
  eyebrow: string
  title: string
  description: string
  /** false = sembunyikan badge "Data dummy" (halaman yang sudah memakai data nyata) */
  dummy?: boolean
}) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="max-w-2xl">
        <p className="text-xs font-semibold tracking-wider text-primary uppercase">{eyebrow}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-balance md:text-3xl">{title}</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground text-pretty">{description}</p>
      </div>
      {dummy && (
        <span className="hidden w-fit items-center gap-1.5 rounded-full border border-warning/40 bg-warning/10 px-3 py-1 text-xs font-semibold text-[oklch(0.5_0.13_55)] lg:inline-flex">
          <span className="size-1.5 rounded-full bg-warning" aria-hidden />
          Data dummy
        </span>
      )}
    </div>
  )
}

export function Panel({
  title,
  subtitle,
  action,
  footnote,
  className,
  children,
}: {
  title: string
  subtitle?: string
  action?: React.ReactNode
  footnote?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <section className={cn("flex flex-col rounded-xl border bg-card p-5 shadow-xs", className)}>
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-card-foreground">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
      </header>
      <div className="flex-1">{children}</div>
      {footnote && <p className="mt-3 border-t pt-3 text-[11px] text-muted-foreground italic">{footnote}</p>}
    </section>
  )
}

type Tone = "default" | "warning" | "danger" | "success"

const toneText: Record<Tone, string> = {
  default: "text-foreground",
  warning: "text-[oklch(0.6_0.16_55)]",
  danger: "text-destructive",
  success: "text-success",
}

const toneBar: Record<Tone, string> = {
  default: "bg-primary",
  warning: "bg-warning",
  danger: "bg-destructive",
  success: "bg-success",
}

export function KpiCard({
  label,
  value,
  caption,
  tone = "default",
  icon,
  valueClassName,
}: {
  label: string
  value: React.ReactNode
  caption: string
  tone?: Tone
  icon?: React.ReactNode
  valueClassName?: string
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border bg-card p-5 shadow-xs">
      <span className={cn("absolute inset-y-0 left-0 w-1", toneBar[tone])} aria-hidden />
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {icon && <span className="text-muted-foreground">{icon}</span>}
      </div>
      <p className={cn("mt-2 text-3xl font-bold tracking-tight tabular-nums", toneText[tone], valueClassName)}>
        {value}
      </p>
      <p className="mt-1.5 text-xs text-muted-foreground text-pretty">{caption}</p>
    </div>
  )
}

export function LegendDot({ color, label, shape = "dot" }: { color: string; label: string; shape?: "dot" | "line" | "square" }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span
        className={cn(
          shape === "dot" && "size-2.5 rounded-full",
          shape === "square" && "size-2.5 rounded-[3px]",
          shape === "line" && "h-0.5 w-4 rounded-full",
        )}
        style={{ backgroundColor: color }}
        aria-hidden
      />
      {label}
    </span>
  )
}
