import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/client/utils";

const alertVariants = cva(
  "relative w-full rounded-lg border px-5 py-4 text-sm leading-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]",
  {
    variants: {
      variant: {
        default: "border-border/80 bg-secondary/20 text-foreground",
        success: "border-primary/25 bg-primary/12 text-foreground",
        destructive: "border-destructive/30 bg-destructive/12 text-destructive-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return <div role="alert" className={cn(alertVariants({ variant }), className)} {...props} />;
}

function AlertTitle({ className, ...props }: React.ComponentProps<"h5">) {
  return <h5 className={cn("mb-1 font-semibold", className)} {...props} />;
}

function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("text-sm text-muted-foreground [&_a]:text-foreground [&_a]:underline", className)} {...props} />;
}

export { Alert, AlertDescription, AlertTitle };
