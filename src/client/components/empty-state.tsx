import { cn } from "@/client/utils";

type EmptyStateProps = {
  title: string;
  description: string;
  className?: string;
};

export function EmptyState({ title, description, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-dashed border-border/80 bg-background/20 px-5 py-6 text-sm",
        className,
      )}
    >
      <p className="font-semibold text-foreground">{title}</p>
      <p className="mt-2 leading-6 text-muted-foreground">{description}</p>
    </div>
  );
}
