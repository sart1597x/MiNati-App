-- Script SQL para crear las tablas de liquidación en Supabase
-- Ejecuta este script en el SQL Editor de tu proyecto Supabase

-- Tabla de asociados liquidados
CREATE TABLE IF NOT EXISTS asociados_liquidados (
  id SERIAL PRIMARY KEY,
  nombres_asociados TEXT[] NOT NULL,
  total_cuotas INTEGER NOT NULL DEFAULT 0,
  total_inscripciones NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_utilidad NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_comision NUMERIC(12, 2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
  descuento_4xmil NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_deducciones NUMERIC(12, 2) NOT NULL DEFAULT 0,
  neto_entregar NUMERIC(12, 2) NOT NULL DEFAULT 0,
  impuesto_4xmil_operativo NUMERIC(12, 2) NOT NULL DEFAULT 0,
  impuesto_4xmil_egreso NUMERIC(12, 2) NOT NULL DEFAULT 0,
  utilidad_bruta_repartible NUMERIC(12, 2) NOT NULL DEFAULT 0,
  fecha_liquidacion DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_asociados_liquidados_fecha ON asociados_liquidados(fecha_liquidacion);
CREATE INDEX IF NOT EXISTS idx_asociados_liquidados_created ON asociados_liquidados(created_at);

-- Habilitar Row Level Security (RLS)
ALTER TABLE asociados_liquidados ENABLE ROW LEVEL SECURITY;

-- Política para permitir todas las operaciones
CREATE POLICY "Allow all operations for asociados_liquidados" ON asociados_liquidados
    FOR ALL USING (true) WITH CHECK (true);

