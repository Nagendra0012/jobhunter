"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/jobs", label: "Jobs" },
  { href: "/tracker", label: "Tracker" },
  { href: "/people", label: "People" },
  { href: "/resume", label: "Resume", also: ["/match"] },
  { href: "/builder", label: "Builder" },
  { href: "/portfolio", label: "Portfolio" },
];

// The links render at once; the "current page" highlight streams in with the URL.
export function Nav() {
  return (
    <Suspense fallback={<Links path={null} />}>
      <ActiveLinks />
    </Suspense>
  );
}

function ActiveLinks() {
  return <Links path={usePathname()} />;
}

function Links({ path }: { path: string | null }) {
  const isActive = (n: (typeof NAV)[number]) =>
    path != null &&
    (n.href === "/" ? path === "/" : [n.href, ...(n.also ?? [])].some((h) => path === h || path.startsWith(`${h}/`)));

  return (
    <div className="-mx-1 flex gap-1 overflow-x-auto px-1 text-sm">
      {NAV.map((n) => {
        const active = isActive(n);
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap rounded-md px-2.5 py-1.5 ${active ? "bg-surface-2 text-foreground" : "text-muted hover:text-foreground"}`}
          >
            {n.label}
          </Link>
        );
      })}
    </div>
  );
}
