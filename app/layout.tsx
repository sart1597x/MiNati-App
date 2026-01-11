import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MiNati2026 - Mi Natillera",
  description: "Aplicación para gestionar tu natillera",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}

