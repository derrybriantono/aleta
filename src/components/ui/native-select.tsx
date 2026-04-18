import * as React from "react";

import { cn } from "@/lib/utils";

const NativeSelect = React.forwardRef<HTMLSelectElement, React.ComponentProps<"select">>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "flex h-11 w-full rounded-xl border border-input/95 bg-background/90 px-3 py-2 text-sm shadow-[0_10px_24px_rgba(15,23,42,0.06)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 dark:shadow-[0_12px_28px_rgba(2,6,23,0.3)]",
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
);
NativeSelect.displayName = "NativeSelect";

export { NativeSelect };
