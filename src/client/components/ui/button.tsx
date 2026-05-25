import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/client/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-all outline-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[0_0_0_1px_rgba(99,245,210,0.18),0_12px_30px_rgba(99,245,210,0.18)] hover:-translate-y-0.5 hover:shadow-[0_0_0_1px_rgba(99,245,210,0.25),0_16px_34px_rgba(99,245,210,0.24)]",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 shadow-[inset_0_0_0_1px_rgba(127,140,255,0.12)]",
        outline:
          "border border-border/90 bg-background/30 text-foreground backdrop-blur-sm hover:bg-muted/60",
        ghost: "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
      },
      size: {
        default: "h-11 px-5 py-2.5",
        sm: "h-9 px-4 text-xs",
        lg: "h-12 px-6 text-sm",
        icon: "size-11 rounded-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };
