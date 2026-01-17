import { createClient } from '@supabase/supabase-js'
import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials not found. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env.local file')
}

// Cliente legacy (para compatibilidad con código existente)
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
})

// Cliente singleton para el navegador (Next.js 14 App Router)
// Esto evita la advertencia "Multiple GoTrueClient instances detected"
let browserClient: SupabaseClient | null = null

export function getBrowserClient(): SupabaseClient {
  // Crear la instancia solo una vez (patrón singleton)
  // Esto evita que Next.js cree una segunda instancia durante el 'Hot Reload' de desarrollo
  if (browserClient) return browserClient

  browserClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        detectSessionInUrl: true,
        persistSession: true,
        // Esto evita que se cree una instancia si ya hay una activa en el window
        autoRefreshToken: true
      }
    }
  )
  
  return browserClient
}

// Tipo para el Socio (tabla: asociados)
// NOTA: La tabla asociados usa id SERIAL (INTEGER), pero Supabase puede devolverlo como string
export interface Socio {
  id?: number | string  // SERIAL (INTEGER) en la BD, pero Supabase puede devolverlo como string
  nombre: string
  cedula: string
  whatsapp: string
  cantidad_cupos: number  // Nombre de columna en BD: cantidad_cupos (no "cupos")
  activo?: boolean  // Soft delete: true = activo, false = inactivo/retirado
  estado?: string  // Estado del socio: 'ACTIVO' o 'RETIRADO'
  created_at?: string
  updated_at?: string
}

// Tipo para Pago de Cuota (tabla: cuotas_pagos)
// NOTA: La tabla cuotas_pagos usa id UUID, asociados.id es SERIAL (INTEGER)
// IMPORTANTE: La relación principal con asociados se hace mediante cedula (String),
// NO mediante socio_id ni asociado_id numéricos para evitar errores de tipo en Supabase
export interface PagoCuota {
  id?: string  // UUID en la BD
  cedula: string  // String - RELACIÓN PRINCIPAL con asociados, NO usar IDs numéricos
  numero_cuota: number
  fecha_vencimiento: string
  fecha_pago?: string
  monto_cuota: number
  monto_mora?: number
  monto_total?: number
  pagado: boolean
  created_at?: string
  updated_at?: string
}

// Tipo para Estado de Cuota (para la visualización)
export interface EstadoCuota {
  numero: number
  fechaVencimiento: Date
  fechaLimite: Date
  pagado: boolean
  fechaPago?: Date
  montoMora: number
  estado: 'pagado' | 'pendiente' | 'mora' // pagado=verde, pendiente=amarillo, mora=rojo
}

