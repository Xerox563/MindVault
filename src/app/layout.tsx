import type { Metadata } from "next";
import { Geist, Geist_Mono, Permanent_Marker, Space_Grotesk } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider } from "@/components/ThemeProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const marker = Permanent_Marker({
  variable: "--font-marker",
  subsets: ["latin"],
  weight: "400",
});

const grotesk = Space_Grotesk({
  variable: "--font-grotesk",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MindVault - AI-Powered Document Intelligence",
  description: "Upload any document and chat with it intelligently. MindVault uses advanced AI to understand your files and provide instant, accurate answers.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <ThemeProvider>
        <html
          lang="en"
          className={`${geistSans.variable} ${geistMono.variable} ${marker.variable} ${grotesk.variable} h-full antialiased`}
          suppressHydrationWarning
        >
          <body className="min-h-full flex flex-col">{children}</body>
        </html>
      </ThemeProvider>
    </ClerkProvider>
  );
}