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
    // suppressHydrationWarning on <body>: some browser extensions (password
    // managers, form fillers) inject attributes onto <body> before React
    // hydrates, which otherwise triggers a spurious hydration mismatch warning.
    // This suppresses only that body-attribute diff, not children mismatches.
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
