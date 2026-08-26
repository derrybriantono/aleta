import { cva, type VariantProps } from "class-variance-authority";

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
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
