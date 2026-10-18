import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { ToastProvider } from "@/components/ui";

export const metadata: Metadata = {
  title: "MondayBrief AI — From messy data to meaningful decisions",
  description: "Clean, analyze and visualize business data in one transparent AI workspace. Review every fix before it applies. Try the free 100-row demo.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body><ToastProvider>{children}</ToastProvider></body>
    </html>
  );
}
