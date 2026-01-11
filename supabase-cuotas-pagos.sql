-- Script SQL para crear la tabla cuotas_pagos en Supabase
-- Ejecuta este script en el SQL Editor de tu proyecto Supabase

CREATE TABLE IF NOT EXISTS cuotas_pagos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  socio_id UUID NOT NULL REFERENCES asociados(id) ON DELETE CASCADE,
  numero_cuota INTEGER NOT NULL CHECK (numero_cuota >= 1 AND numero_cuota <= 24),
  fecha_vencimiento DATE NOT NULL,
  fecha_pago DATE,
  monto_cuota NUMERIC(10, 2) NOT NULL DEFAULT 30000,
  monto_mora NUMERIC(10, 2) DEFAULT 0,
  monto_total NUMERIC(10, 2),
  pagado BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  UNIQUE(socio_id, numero_cuota)
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_cuotas_pagos_socio_id ON cuotas_pagos(socio_id);
CREATE INDEX IF NOT EXISTS idx_cuotas_pagos_numero_cuota ON cuotas_pagos(numero_cuota);
CREATE INDEX IF NOT EXISTS idx_cuotas_pagos_pagado ON cuotas_pagos(pagado);

-- Función para calcular monto_total automáticamente
CREATE OR REPLACE FUNCTION calcular_monto_total()
RETURNS TRIGGER AS $$
BEGIN
    NEW.monto_total = COALESCE(NEW.monto_cuota, 30000) + COALESCE(NEW.monto_mora, 0);
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para actualizar monto_total y updated_at
CREATE TRIGGER calcular_monto_total_trigger
    BEFORE INSERT OR UPDATE ON cuotas_pagos
    FOR EACH ROW
    EXECUTE FUNCTION calcular_monto_total();

-- Habilitar Row Level Security (RLS)
ALTER TABLE cuotas_pagos ENABLE ROW LEVEL SECURITY;

-- Política para permitir todas las operaciones (ajusta según tus necesidades de seguridad)
CREATE POLICY "Allow all operations for cuotas_pagos" ON cuotas_pagos
    FOR ALL USING (true) WITH CHECK (true);

