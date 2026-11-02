import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "JobHunter",
  description: "Resume ATS checks and job match scoring for security roles",
};

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/jobs", label: "Jobs" },
  { href: "/tracker", label: "Tracker" },
  { href: "/resume", label: "Resume" },
  { href: "/builder", label: "Resume builder" },
  { href: "/match", label: "Match a job" },
];

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col print:min-h-0 print:bg-white print:text-black">
        <header className="border-b border-border bg-surface/60 backdrop-blur print:hidden">
          <nav className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
            <Link href="/" className="font-mono text-sm font-semibold tracking-tight text-accent">
              &gt;_ jobhunter
            </Link>
            <div className="-mx-1 flex gap-4 overflow-x-auto px-1 text-sm">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className="whitespace-nowrap text-muted hover:text-foreground">
                  {n.label}
                </Link>
              ))}
            </div>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 print:max-w-none print:p-0">{children}</main>
      </body>
    </html>
  );
}
