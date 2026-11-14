import Image from "next/image"
import Link from "next/link"
import { cn } from "@/lib/utils"

/**
 * Logo Gelar Rasa. Tinggi 36px (HP) / 44px (layar lebar), lebar otomatis.
 * Taruh file di public/: logo-gelar-rasa.png (latar terang) dan logo-gelar-rasa-light.png (latar gelap).
 */
export function BrandLogo({ variant = "dark", className }: { variant?: "dark" | "light"; className?: string }) {
  return (
    <Link
      href="/"
      aria-label="Gelar Rasa — beranda"
      className={cn("inline-block rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/50", className)}
    >
      <Image
        src={variant === "light" ? "/logo-gelar-rasa-light.png" : "/logo-gelar-rasa.png"}
        alt="Gelar Rasa"
        width={1000}
        height={385}
        priority
        className="h-9 w-auto md:h-11"
      />
    </Link>
  )
}
