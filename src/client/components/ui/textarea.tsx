import * as React from "react";
import { cn } from "@/client/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-32 w-full rounded-lg border border-input/90 bg-background/50 px-4 py-3 text-sm leading-6 text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] outline-none backdrop-blur-sm transition-[border-color,box-shadow,background-color] placeholder:text-muted-foreground/80 focus-visible:border-primary/70 focus-visible:ring-4 focus-visible:ring-ring/20",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
