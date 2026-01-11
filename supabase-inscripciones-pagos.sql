-- Script SQL para crear la tabla inscripciones_pagos en Supabase
-- Ejecuta este script en el SQL Editor de tu proyecto Supabase
-- IMPORTANTE: Este script requiere que la tabla 'asociados' ya exista

-- Tabla de pagos de inscripción
-- NOTA: asociado_id es INTEGER porque la tabla asociados(id) usa INTEGER
CREATE TABLE IF NOT EXISTS inscripciones_pagos (
  id SERIAL PRIMARY KEY,
  asociado_id INTEGER NOT NULL REFERENCES asociados(id) ON DELETE CASCADE,
  cedula TEXT NOT NULL,
  monto NUMERIC(12, 2) NOT NULL DEFAULT 10000,
  fecha_pago DATE NOT NULL DEFAULT CURRENT_DATE,
  pagado BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  UNIQUE(cedula) -- Un solo pago de inscripción por socio (por cédula)
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_inscripciones_pagos_asociado_id ON inscripciones_pagos(asociado_id);
CREATE INDEX IF NOT EXISTS idx_inscripciones_pagos_cedula ON inscripciones_pagos(cedula);
CREATE INDEX IF NOT EXISTS idx_inscripciones_pagos_pagado ON inscripciones_pagos(pagado);
CREATE INDEX IF NOT EXISTS idx_inscripciones_pagos_fecha_pago ON inscripciones_pagos(fecha_pago);

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_inscripciones_pagos_updated_at
    BEFORE UPDATE ON inscripciones_pagos
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Habilitar Row Level Security (RLS)
ALTER TABLE inscripciones_pagos ENABLE ROW LEVEL SECURITY;

-- Política para permitir todas las operaciones
CREATE POLICY "Allow all operations for inscripciones_pagos" ON inscripciones_pagos
    FOR ALL USING (true) WITH CHECK (true);

