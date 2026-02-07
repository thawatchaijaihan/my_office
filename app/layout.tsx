import type { Metadata } from "next";
import "./globals.css";
import Script from "next/script";

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
    <html lang="th" className="light" style={{ colorScheme: "light" }}>
      <body
        className="antialiased min-h-screen bg-slate-50 text-slate-900"
        style={{ backgroundColor: "#f8fafc", color: "#0f172a" }}
      >
        {children}
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />
      </body>
    </html>
  );
}
