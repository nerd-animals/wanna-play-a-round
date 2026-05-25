import { cn } from "@/client/utils";

type StatCardProps = {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  className?: string;
};

export function StatCard({ label, value, hint, className }: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border/80 bg-background/35 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-sm sm:p-5",
        className,
      )}
    >
      <p className="text-[11px] font-semibold uppercase text-muted-foreground">{label}</p>
      <div className="mt-3 text-lg font-semibold text-foreground sm:text-xl">{value}</div>
      {hint ? <p className="mt-2 text-sm leading-6 text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
