import type { Metadata } from "next";
import "./globals.css";
import { SideNav } from "@/components/ui/SideNav";

export const metadata: Metadata = {
  title: "OpsMind — Operational Intelligence",
  description:
    "Autonomous operational intelligence agent for business decision-making",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-surface text-text-primary antialiased">
        <div className="flex h-screen overflow-hidden">
          {/* Sidebar navigation */}
          <SideNav />

          {/* Main content area */}
          <main className="flex-1 overflow-y-auto">
            <div className="min-h-full">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
