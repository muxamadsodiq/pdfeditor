import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Yusuf PDF Editor",
  description: "Free public PDF editor foundation",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
