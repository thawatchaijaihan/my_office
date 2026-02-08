import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import Script from "next/script";

const poppins = Poppins({
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});

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
    <html lang="th" className={`light ${poppins.variable}`} style={{ colorScheme: "light" }} suppressHydrationWarning>
      <body
        className="antialiased min-h-screen bg-slate-50 text-slate-900 font-sans"
        style={{ fontFamily: "var(--font-poppins), sans-serif", backgroundColor: "#f8fafc", color: "#0f172a" }}
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
