-- Script SQL para crear las tablas de actividades en Supabase
-- Ejecuta este script en el SQL Editor de tu proyecto Supabase

-- Tabla de actividades
CREATE TABLE IF NOT EXISTS actividades (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  fecha DATE NOT NULL,
  costo_inversion NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ganancia_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  utilidad_neta NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Tabla de participaciones en actividades
CREATE TABLE IF NOT EXISTS participaciones_actividades (
  id SERIAL PRIMARY KEY,
  actividad_id INTEGER NOT NULL REFERENCES actividades(id) ON DELETE CASCADE,
  asociado_id INTEGER NOT NULL REFERENCES asociados(id) ON DELETE CASCADE,
  nombre_asociado TEXT NOT NULL,
  cantidad_caritas INTEGER NOT NULL DEFAULT 1,
  valor_carita NUMERIC(10, 2) NOT NULL DEFAULT 0,
  valor_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  UNIQUE(actividad_id, asociado_id)
);

-- Tabla de gastos bancarios (4xMil Operativo)
CREATE TABLE IF NOT EXISTS gastos_bancarios (
  id SERIAL PRIMARY KEY,
  descripcion TEXT NOT NULL DEFAULT '4xMil Operativo',
  valor NUMERIC(12, 2) NOT NULL,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_actividades_fecha ON actividades(fecha);
CREATE INDEX IF NOT EXISTS idx_participaciones_actividad ON participaciones_actividades(actividad_id);
CREATE INDEX IF NOT EXISTS idx_participaciones_asociado ON participaciones_actividades(asociado_id);
CREATE INDEX IF NOT EXISTS idx_gastos_fecha ON gastos_bancarios(fecha);

-- Habilitar Row Level Security (RLS)
ALTER TABLE actividades ENABLE ROW LEVEL SECURITY;
ALTER TABLE participaciones_actividades ENABLE ROW LEVEL SECURITY;
ALTER TABLE gastos_bancarios ENABLE ROW LEVEL SECURITY;

-- Políticas para permitir todas las operaciones
CREATE POLICY "Allow all operations for actividades" ON actividades
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations for participaciones_actividades" ON participaciones_actividades
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations for gastos_bancarios" ON gastos_bancarios
    FOR ALL USING (true) WITH CHECK (true);
