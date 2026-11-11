import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
// 1. Import ThemeProvider yang baru saja kita buat
import { ThemeProvider } from "@/components/ThemeProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PropertiERP",
  description: "Sistem Terpadu POS, Stok, Logistik & Keuangan",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // 2. Suppress hydration warning perlu ditambahkan
    // agar Next.js tidak error saat next-themes mengubah class 'dark'/'light' di html
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      {/* 3. Gunakan warna background dari variabel tema kita */}
      <body className="min-h-full flex flex-col bg-[var(--bg-base)] text-[var(--text-primary)] transition-colors duration-200">
        {/* 4. Bungkus aplikasi dengan ThemeProvider */}
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}