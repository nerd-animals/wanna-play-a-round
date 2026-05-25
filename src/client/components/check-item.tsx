import { Check, CircleDashed } from "lucide-react";
import { cn } from "@/client/utils";

type CheckItemProps = {
  title: string;
  description?: string;
  done?: boolean;
  className?: string;
};

export function CheckItem({ title, description, done = false, className }: CheckItemProps) {
  return (
    <div
      className={cn(
        "flex items-start gap-4 rounded-lg border p-4 backdrop-blur-sm transition-colors",
        done ? "border-primary/30 bg-primary/10" : "border-border/80 bg-background/30",
        className,
      )}
    >
      <div
        className={cn(
          "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full border",
          done
            ? "border-primary/40 bg-primary/15 text-primary"
            : "border-border/80 bg-muted/30 text-muted-foreground",
        )}
      >
        {done ? <Check className="size-4" /> : <CircleDashed className="size-4" />}
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {description ? <p className="text-sm leading-6 text-muted-foreground">{description}</p> : null}
      </div>
    </div>
  );
}
