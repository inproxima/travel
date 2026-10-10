"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BedDouble, Compass, Plane, Settings, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/client";
import { cn } from "@/lib/utils";
import type { Features } from "@/lib/env";
import { ThemeToggle } from "./theme";

const NAV = [
  { href: "/flights", label: "Flights", icon: Plane },
  { href: "/hotels", label: "Hotels", icon: BedDouble },
  { href: "/ai", label: "AI Planner", icon: Sparkles },
  { href: "/settings", label: "Settings", icon: Settings },
];

type Account = { searchesLeft: number | null; searchesPerMonth: number | null };

function useStatus() {
  const [features, setFeatures] = React.useState<Features | null>(null);
  const [account, setAccount] = React.useState<Account | null>(null);
  const [accountError, setAccountError] = React.useState(false);

  React.useEffect(() => {
    api<Features>("/api/status").then(setFeatures).catch(() => setFeatures(null));
  }, []);

  React.useEffect(() => {
    if (!features?.serpapi) return;
    const load = () =>
      api<Account>("/api/account")
        .then((a) => {
          setAccount(a);
          setAccountError(false);
        })
        .catch(() => setAccountError(true));
    load();
    window.addEventListener("credits-changed", load);
    return () => window.removeEventListener("credits-changed", load);
  }, [features?.serpapi]);

  return { features, account, accountError };
}

export function Header() {
  const pathname = usePathname();
  const { features, account, accountError } = useStatus();

  return (
    <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Compass className="size-4" />
          </span>
          <span className="hidden sm:inline">Waypoint</span>
        </Link>

        <nav aria-label="Modes" className="flex items-center gap-1 overflow-x-auto">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                  active && "bg-accent text-foreground",
                )}
              >
                <Icon className="size-4" />
                <span className={cn(href === "/settings" && "sr-only md:not-sr-only")}>{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {features?.mock && <Badge variant="warning">Sample data</Badge>}
          {features && !features.serpapi && (
            <Link href="/settings">
              <Badge variant="destructive">Add SerpApi key</Badge>
            </Link>
          )}
          {account?.searchesLeft != null && (
            <Badge variant="secondary" title="SerpApi searches left this month" className="hidden sm:inline-flex tabular-nums">
              {account.searchesLeft.toLocaleString()} credits left
            </Badge>
          )}
          {accountError && (
            <Badge variant="outline" className="hidden sm:inline-flex" title="Couldn't read your SerpApi account">
              Credits unknown
            </Badge>
          )}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
