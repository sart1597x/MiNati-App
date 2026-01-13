-- Script SQL para crear las tablas de inversiones en Supabase
-- ⚠️ IMPORTANTE: Estas tablas son COMPLETAMENTE INDEPENDIENTES de otros módulos
-- Ejecuta este script en el SQL Editor de tu proyecto Supabase

-- ============================================
-- TABLA: inversiones
-- ============================================
CREATE TABLE IF NOT EXISTS inversiones (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  valor NUMERIC(12, 2) NOT NULL DEFAULT 0,
  fecha DATE NOT NULL,
  utilidad NUMERIC(12, 2) DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Índices para inversiones
CREATE INDEX IF NOT EXISTS idx_inversiones_fecha ON inversiones(fecha);
CREATE INDEX IF NOT EXISTS idx_inversiones_created_at ON inversiones(created_at);

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_inversiones_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para actualizar updated_at
CREATE TRIGGER update_inversiones_updated_at
    BEFORE UPDATE ON inversiones
    FOR EACH ROW
    EXECUTE FUNCTION update_inversiones_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
ALTER TABLE inversiones ENABLE ROW LEVEL SECURITY;

-- Política para permitir todas las operaciones
CREATE POLICY "Allow all operations for inversiones" ON inversiones
    FOR ALL USING (true) WITH CHECK (true);

