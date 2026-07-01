import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Comma — Web Dashboard",
  description: "View your gig earnings, shifts, and expenses from any computer.",
  icons: { icon: "/favicon.png", apple: "/logo.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" data-theme="dark">
      <body className={dmSans.variable}>{children}</body>
    </html>
  );
}
