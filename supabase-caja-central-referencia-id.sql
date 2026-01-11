-- Script SQL para agregar la columna referencia_id a caja_central
-- Ejecuta este script en el SQL Editor de tu proyecto Supabase

-- Agregar columna referencia_id (puede ser NULL para movimientos antiguos o manuales)
ALTER TABLE caja_central 
ADD COLUMN IF NOT EXISTS referencia_id TEXT;

-- Crear índice para búsquedas rápidas por referencia_id
CREATE INDEX IF NOT EXISTS idx_caja_central_referencia_id ON caja_central(referencia_id);

-- Comentario: referencia_id almacena el ID del pago original que generó este movimiento
-- Formato: "cuota:{id}", "mora:{id}", "inscripcion:{cedula}" o null para movimientos manuales

