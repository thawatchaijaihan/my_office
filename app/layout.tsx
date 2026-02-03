import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Jaihan Assistant",
  description: "LINE Bot AI powered by Gemini",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body className="antialiased min-h-screen bg-slate-50 text-slate-900">
        {children}
      </body>
    </html>
  );
}
