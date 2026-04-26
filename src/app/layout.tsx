import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StumpTheSchwab — Future Studio",
  description: "A rebuilt music production and sound design playground.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
