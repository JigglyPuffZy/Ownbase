import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ownbase — Your backend, your workspace",
  description: "Build your next idea with a personal data and storage workspace.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
