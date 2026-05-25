import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/client/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase",
  {
    variants: {
      variant: {
        default: "border-primary/30 bg-primary/14 text-primary",
        secondary: "border-accent/20 bg-accent/14 text-accent-foreground",
        outline: "border-border/80 bg-transparent text-muted-foreground",
        destructive: "border-destructive/30 bg-destructive/14 text-destructive",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({ className, variant, ...props }: React.ComponentProps<"div"> & VariantProps<typeof badgeVariants>) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
