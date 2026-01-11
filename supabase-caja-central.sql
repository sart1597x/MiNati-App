-- Script SQL para crear la tabla caja_central en Supabase
-- Ejecuta este script en el SQL Editor de tu proyecto Supabase

-- Tabla de movimientos de caja central
CREATE TABLE IF NOT EXISTS caja_central (
  id SERIAL PRIMARY KEY,
  tipo TEXT NOT NULL CHECK (tipo IN ('INGRESO', 'EGRESO')),
  concepto TEXT NOT NULL,
  monto NUMERIC(12, 2) NOT NULL,
  saldo_anterior NUMERIC(12, 2) NOT NULL DEFAULT 0,
  nuevo_saldo NUMERIC(12, 2) NOT NULL,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_caja_central_fecha ON caja_central(fecha);
CREATE INDEX IF NOT EXISTS idx_caja_central_tipo ON caja_central(tipo);
CREATE INDEX IF NOT EXISTS idx_caja_central_created_at ON caja_central(created_at);

-- Habilitar Row Level Security (RLS)
ALTER TABLE caja_central ENABLE ROW LEVEL SECURITY;

-- Política para permitir todas las operaciones
CREATE POLICY "Allow all operations for caja_central" ON caja_central
    FOR ALL USING (true) WITH CHECK (true);

