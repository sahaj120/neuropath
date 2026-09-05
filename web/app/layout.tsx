import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "NeuroPath - Gentle Recovery, Day by Day",
  description:
    "A calm daily check-in and soothing therapy lounge for concussion recovery.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} bg-[#0A0A0A] font-sans text-neutral-100 antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
