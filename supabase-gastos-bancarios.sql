-- Script SQL para crear la tabla gastos_bancarios en Supabase
-- Ejecuta este script en el SQL Editor de tu proyecto Supabase

-- Tabla de gastos bancarios (4xMil Operativo)
CREATE TABLE IF NOT EXISTS gastos_bancarios (
  id SERIAL PRIMARY KEY,
  descripcion TEXT NOT NULL DEFAULT '4xMil Operativo',
  valor NUMERIC(12, 2) NOT NULL,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Índice para búsquedas rápidas por fecha
CREATE INDEX IF NOT EXISTS idx_gastos_fecha ON gastos_bancarios(fecha);

-- Habilitar Row Level Security (RLS)
ALTER TABLE gastos_bancarios ENABLE ROW LEVEL SECURITY;

-- Política para permitir todas las operaciones
CREATE POLICY "Allow all operations for gastos_bancarios" ON gastos_bancarios
    FOR ALL USING (true) WITH CHECK (true);

