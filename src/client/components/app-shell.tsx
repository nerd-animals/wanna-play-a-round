import { cn } from "@/client/utils";

type AppShellProps = {
  children: React.ReactNode;
  className?: string;
};

export function AppShell({ children, className }: AppShellProps) {
  return (
    <main className={cn("relative isolate flex-1 overflow-hidden", className)}>
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-56 bg-[linear-gradient(180deg,rgba(99,245,210,0.10),transparent)]" />
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
        {children}
      </div>
    </main>
  );
}
