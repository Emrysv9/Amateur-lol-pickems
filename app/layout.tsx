import type { Metadata } from "next";
import { Geist, Rajdhani } from "next/font/google";
import { Header } from "@/components/header";
import { getCurrentProfile, isAdmin } from "@/lib/auth";
import { getActiveLeague } from "@/lib/data";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const rajdhani = Rajdhani({
  variable: "--font-rajdhani",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "LoL Amateur Pick'Ems",
  description: "Amateur LoL playoff Pick'Ems — pick the bracket, chase the ember.",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [profile, league] = await Promise.all([
    getCurrentProfile(),
    getActiveLeague(),
  ]);
  const admin = isAdmin(profile);

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${rajdhani.variable} antialiased min-h-screen text-foreground`}
        suppressHydrationWarning
      >
        <Header profile={profile} isAdmin={admin} leagueName={league?.name} />
        <main className="w-full px-4 pb-16 pt-6 pr-6 sm:px-6 sm:pr-8 lg:px-10 lg:pr-14 xl:px-12 xl:pr-16">
          {children}
        </main>
      </body>
    </html>
  );
}
