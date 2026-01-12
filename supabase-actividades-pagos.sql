-- Script SQL para crear la tabla actividades_pagos en Supabase
-- Esta tabla es COMPLETAMENTE INDEPENDIENTE de cuotas_pagos
-- Ejecuta este script en el SQL Editor de tu proyecto Supabase

CREATE TABLE IF NOT EXISTS actividades_pagos (
  id SERIAL PRIMARY KEY,
  actividad_id INTEGER NOT NULL REFERENCES actividades(id) ON DELETE CASCADE,
  socio_id INTEGER NOT NULL REFERENCES asociados(id) ON DELETE CASCADE,
  carita_numero INTEGER NOT NULL CHECK (carita_numero >= 1),
  monto NUMERIC(10, 2) NOT NULL DEFAULT 0,
  estado TEXT NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN ('PAGADO', 'PENDIENTE')),
  fecha_pago DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  UNIQUE(actividad_id, socio_id, carita_numero)
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_actividades_pagos_actividad_id ON actividades_pagos(actividad_id);
CREATE INDEX IF NOT EXISTS idx_actividades_pagos_socio_id ON actividades_pagos(socio_id);
CREATE INDEX IF NOT EXISTS idx_actividades_pagos_estado ON actividades_pagos(estado);
CREATE INDEX IF NOT EXISTS idx_actividades_pagos_carita_numero ON actividades_pagos(carita_numero);

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_actividades_pagos_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para actualizar updated_at
CREATE TRIGGER update_actividades_pagos_updated_at
    BEFORE UPDATE ON actividades_pagos
    FOR EACH ROW
    EXECUTE FUNCTION update_actividades_pagos_updated_at_column();

-- Habilitar Row Level Security (RLS)
ALTER TABLE actividades_pagos ENABLE ROW LEVEL SECURITY;

-- Política para permitir todas las operaciones (ajusta según tus necesidades de seguridad)
CREATE POLICY "Allow all operations for actividades_pagos" ON actividades_pagos
    FOR ALL USING (true) WITH CHECK (true);

