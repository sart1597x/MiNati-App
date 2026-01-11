-- Script SQL para crear la tabla de socios en Supabase
-- Ejecuta este script en el SQL Editor de tu proyecto Supabase

CREATE TABLE IF NOT EXISTS socios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  cedula TEXT NOT NULL UNIQUE,
  whatsapp TEXT NOT NULL,
  cupos INTEGER NOT NULL DEFAULT 1 CHECK (cupos > 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Índice para búsquedas rápidas por cédula
CREATE INDEX IF NOT EXISTS idx_socios_cedula ON socios(cedula);

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para actualizar updated_at
CREATE TRIGGER update_socios_updated_at BEFORE UPDATE ON socios
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Habilitar Row Level Security (RLS) - Ajusta según tus necesidades
ALTER TABLE socios ENABLE ROW LEVEL SECURITY;

-- Política para permitir todas las operaciones (ajusta según tus necesidades de seguridad)
-- En producción, deberías crear políticas más restrictivas
CREATE POLICY "Allow all operations for authenticated users" ON socios
    FOR ALL USING (true) WITH CHECK (true);

-- O si prefieres permitir todo sin autenticación (solo para desarrollo):
-- DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON socios;
-- CREATE POLICY "Allow all operations" ON socios
--     FOR ALL USING (true) WITH CHECK (true);

