import type { Metadata } from "next";

import "./globals.css";
import { AppNav } from "@/components/AppNav";
import { TourAutoStart, TourProvider } from "@/components/tour/TourProvider";

export const metadata: Metadata = {
  title: "LOOPER",
  description: "LOOPER — intake → rank → receipt. Every number shows its work.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <TourProvider>
          <TourAutoStart />
          <AppNav />
          <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
        </TourProvider>
      </body>
    </html>
  );
}