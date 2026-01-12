-- Script SQL para crear la tabla actividades_caritas en Supabase
-- Ejecuta este script en el SQL Editor de tu proyecto Supabase
-- Esta tabla almacena las caritas (boletas/tablas) de cada actividad

CREATE TABLE IF NOT EXISTS actividades_caritas (
  id SERIAL PRIMARY KEY,
  actividad_id INTEGER NOT NULL REFERENCES actividades(id) ON DELETE CASCADE,
  asociado_id INTEGER NOT NULL REFERENCES asociados(id) ON DELETE CASCADE,
  cantidad INTEGER NOT NULL DEFAULT 1 CHECK (cantidad >= 1),
  pagadas INTEGER NOT NULL DEFAULT 0 CHECK (pagadas >= 0),
  valor_unitario NUMERIC(10, 2) NOT NULL DEFAULT 0,
  total_pagado NUMERIC(12, 2) NOT NULL DEFAULT 0,
  estado TEXT NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN ('PAGADO', 'PENDIENTE')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  UNIQUE(actividad_id, asociado_id)
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_actividades_caritas_actividad_id ON actividades_caritas(actividad_id);
CREATE INDEX IF NOT EXISTS idx_actividades_caritas_asociado_id ON actividades_caritas(asociado_id);
CREATE INDEX IF NOT EXISTS idx_actividades_caritas_estado ON actividades_caritas(estado);

-- Función para calcular estado automáticamente
CREATE OR REPLACE FUNCTION calcular_estado_actividad_carita()
RETURNS TRIGGER AS $$
BEGIN
    -- Estado = PAGADO si pagadas >= cantidad, PENDIENTE en otro caso
    IF NEW.pagadas >= NEW.cantidad THEN
        NEW.estado = 'PAGADO';
    ELSE
        NEW.estado = 'PENDIENTE';
    END IF;
    
    -- Calcular total_pagado
    NEW.total_pagado = NEW.pagadas * NEW.valor_unitario;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para calcular estado y total_pagado automáticamente
CREATE TRIGGER calcular_estado_actividad_carita_trigger
    BEFORE INSERT OR UPDATE ON actividades_caritas
    FOR EACH ROW
    EXECUTE FUNCTION calcular_estado_actividad_carita();

-- Habilitar Row Level Security (RLS)
ALTER TABLE actividades_caritas ENABLE ROW LEVEL SECURITY;

-- Política para permitir todas las operaciones (ajusta según tus necesidades de seguridad)
CREATE POLICY "Allow all operations for actividades_caritas" ON actividades_caritas
    FOR ALL USING (true) WITH CHECK (true);

