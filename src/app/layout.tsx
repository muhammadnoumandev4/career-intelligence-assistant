import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Career Intelligence Assistant",
  description: "Resume-to-role analysis assistant for the Newpage AI-Native Builder assignment.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
