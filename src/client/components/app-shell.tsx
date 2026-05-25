import Link from "next/link";
import { cn } from "@/client/utils";

type AppShellProps = {
  children: React.ReactNode;
  className?: string;
};

export function AppShell({ children, className }: AppShellProps) {
  return (
    <main className={cn("relative isolate flex-1 overflow-hidden", className)}>
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-56 bg-[linear-gradient(180deg,rgba(116,242,178,0.10),transparent)]" />
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
        <header className="flex flex-col gap-3 border-b border-border/70 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/" className="text-sm font-semibold text-foreground uppercase">
            ScrimFinder
          </Link>
          <nav className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Link className="rounded-lg px-3 py-2 hover:bg-muted hover:text-foreground" href="/dashboard">
              운영 홈
            </Link>
            <Link className="rounded-lg px-3 py-2 hover:bg-muted hover:text-foreground" href="/matches">
              매칭 탐색
            </Link>
          </nav>
        </header>
        {children}
      </div>
    </main>
  );
}
