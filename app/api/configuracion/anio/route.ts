import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const { data, error } = await supabase
    .from("configuracion_natillera")
    .select("anio_vigente")
    .eq("es_activa", true)
    .single();

  if (error || !data) {
    return NextResponse.json({ anio: null });
  }

  return NextResponse.json({
    anio: data.anio_vigente,
  });
}
