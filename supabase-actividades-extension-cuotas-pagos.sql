-- Script SQL para EXTENDER la tabla cuotas_pagos con campos de contexto para actividades
-- NO crea tablas nuevas, solo agrega campos opcionales a la tabla existente
-- Ejecuta este script en el SQL Editor de tu proyecto Supabase

-- Agregar campos de contexto para diferenciar pagos de actividades
-- Estos campos son OPCIONALES (NULL por defecto) para no romper pagos de cuotas existentes
ALTER TABLE cuotas_pagos 
ADD COLUMN IF NOT EXISTS tipo_origen TEXT CHECK (tipo_origen IN ('CUOTA', 'ACTIVIDAD')),
ADD COLUMN IF NOT EXISTS referencia_id INTEGER; -- Para actividades: actividad_id

-- Crear índice para búsquedas rápidas de pagos de actividades
CREATE INDEX IF NOT EXISTS idx_cuotas_pagos_tipo_origen ON cuotas_pagos(tipo_origen);
CREATE INDEX IF NOT EXISTS idx_cuotas_pagos_referencia_id ON cuotas_pagos(referencia_id);

-- Actualizar registros existentes para que sean de tipo CUOTA (por defecto)
UPDATE cuotas_pagos 
SET tipo_origen = 'CUOTA' 
WHERE tipo_origen IS NULL;

