-- Script SQL para crear la tabla de inversiones en Supabase
-- ⚠️ IMPORTANTE: Esta tabla es COMPLETAMENTE INDEPENDIENTE de otros módulos
-- Ejecuta este script en el SQL Editor de tu proyecto Supabase

-- ============================================
-- TABLA: inversiones
-- ============================================
CREATE TABLE IF NOT EXISTS public.inversiones (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  fecha DATE NOT NULL,
  valor_invertido NUMERIC(12, 2) NOT NULL DEFAULT 0,
  utilidad_reportada NUMERIC(12, 2) DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Índices para inversiones
CREATE INDEX IF NOT EXISTS idx_inversiones_fecha ON public.inversiones(fecha);
CREATE INDEX IF NOT EXISTS idx_inversiones_created_at ON public.inversiones(created_at);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
ALTER TABLE public.inversiones ENABLE ROW LEVEL SECURITY;

-- Política para permitir todas las operaciones
CREATE POLICY "Allow all operations for inversiones" ON public.inversiones
    FOR ALL USING (true) WITH CHECK (true);

