-- Script SQL para crear las tablas de actividades en Supabase
-- ⚠️ IMPORTANTE: Estas tablas son COMPLETAMENTE INDEPENDIENTES de cuotas
-- Ejecuta este script en el SQL Editor de tu proyecto Supabase

-- ============================================
-- TABLA 1: actividades_caritas
-- ============================================
-- Almacena la estructura base de las caritas (boletas/tableros) por socio
CREATE TABLE IF NOT EXISTS actividades_caritas (
  id SERIAL PRIMARY KEY,
  actividad_id INTEGER NOT NULL REFERENCES actividades(id) ON DELETE CASCADE,
  socio_id INTEGER NOT NULL REFERENCES asociados(id) ON DELETE CASCADE,
  carita_numero INTEGER NOT NULL CHECK (carita_numero >= 1),
  estado TEXT NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE', 'PAGADO')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  UNIQUE(actividad_id, socio_id, carita_numero)
);

-- Índices para actividades_caritas
CREATE INDEX IF NOT EXISTS idx_actividades_caritas_actividad_id ON actividades_caritas(actividad_id);
CREATE INDEX IF NOT EXISTS idx_actividades_caritas_socio_id ON actividades_caritas(socio_id);
CREATE INDEX IF NOT EXISTS idx_actividades_caritas_estado ON actividades_caritas(estado);
CREATE INDEX IF NOT EXISTS idx_actividades_caritas_carita_numero ON actividades_caritas(carita_numero);

-- ============================================
-- TABLA 2: actividades_pagos
-- ============================================
-- Almacena los pagos registrados de las caritas
CREATE TABLE IF NOT EXISTS actividades_pagos (
  id SERIAL PRIMARY KEY,
  actividad_id INTEGER NOT NULL REFERENCES actividades(id) ON DELETE CASCADE,
  socio_id INTEGER NOT NULL REFERENCES asociados(id) ON DELETE CASCADE,
  carita_numero INTEGER NOT NULL CHECK (carita_numero >= 1),
  monto INTEGER NOT NULL DEFAULT 0,
  fecha_pago DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  UNIQUE(actividad_id, socio_id, carita_numero)
);

-- Índices para actividades_pagos
CREATE INDEX IF NOT EXISTS idx_actividades_pagos_actividad_id ON actividades_pagos(actividad_id);
CREATE INDEX IF NOT EXISTS idx_actividades_pagos_socio_id ON actividades_pagos(socio_id);
CREATE INDEX IF NOT EXISTS idx_actividades_pagos_carita_numero ON actividades_pagos(carita_numero);
CREATE INDEX IF NOT EXISTS idx_actividades_pagos_fecha_pago ON actividades_pagos(fecha_pago);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
ALTER TABLE actividades_caritas ENABLE ROW LEVEL SECURITY;
ALTER TABLE actividades_pagos ENABLE ROW LEVEL SECURITY;

-- Políticas para actividades_caritas
CREATE POLICY "Allow all operations for actividades_caritas" ON actividades_caritas
    FOR ALL USING (true) WITH CHECK (true);

-- Políticas para actividades_pagos
CREATE POLICY "Allow all operations for actividades_pagos" ON actividades_pagos
    FOR ALL USING (true) WITH CHECK (true);
