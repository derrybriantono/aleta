import { cva, type VariantProps } from "class-variance-authority";

import { formatAnakLencana } from "@/lib/format-lencana";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "border-primary/25 bg-primary/15 text-primary dark:border-primary/30 dark:bg-primary/20",
        outline: "border-border/90 bg-card/75 text-foreground dark:border-border/70 dark:bg-muted/50",
        success: "border-emerald-300/70 bg-emerald-100 text-emerald-800 dark:border-emerald-700/50 dark:bg-emerald-950/70 dark:text-emerald-300",
        warning: "border-amber-300/70 bg-amber-100 text-amber-800 dark:border-amber-700/50 dark:bg-amber-950/70 dark:text-amber-300",
        danger: "border-rose-300/70 bg-rose-100 text-rose-700 dark:border-rose-700/50 dark:bg-rose-950/70 dark:text-rose-300",
        muted: "border-border/75 bg-muted/80 text-muted-foreground dark:border-border/55 dark:bg-muted/60 dark:text-muted-foreground",
        // Dua warna tambahan supaya status putusan tidak lagi berbagi kuning
        // bertiga - lihat warnaStatusPutusan. Ungu dan biru dipilih sebab
        // keduanya belum dipakai penanda lain di layar jadwal sidang.
        info: "border-sky-300/70 bg-sky-100 text-sky-800 dark:border-sky-700/50 dark:bg-sky-950/70 dark:text-sky-300",
        netral:
          "border-violet-300/70 bg-violet-100 text-violet-800 dark:border-violet-700/50 dark:bg-violet-950/70 dark:text-violet-300",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {
  /**
   * Tulisan apa adanya - tanpa huruf awal kapital otomatis (14 Okt 2026). Untuk
   * lencana yang memuat nilai mentah (nama pengguna, kode) yang tidak boleh diubah.
   */
  teksAsli?: boolean;
}

/**
 * Lencana. Sejak 14 Okt 2026 tulisannya berhuruf awal kapital lewat satu aturan
 * (@/lib/format-lencana): "potensi verstek" -> "Potensi verstek"; singkatan,
 * "e-Court", angka, dan kode dibiarkan.
 */
function Badge({ className, variant, teksAsli, children, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props}>
      {teksAsli ? children : formatAnakLencana(children)}
    </div>
  );
}

export { Badge, badgeVariants };
