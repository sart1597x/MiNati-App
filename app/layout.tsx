import type { Metadata } from "next";
import "./globals.css";
import { obtenerAnioVigente } from "@/lib/configuracion";

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: "MiNati - Mi Natillera",
  description: "Aplicación para gestionar tu natillera",
};

export default async function RootLayout({
  
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const anio = await obtenerAnioVigente();
  return (
    <html lang="es" className="overflow-x-hidden">
      <body className="antialiased overflow-x-hidden w-full max-w-full">{children}</body>
    </html>
  );
}

