-- Script SQL para agregar columna estado a la tabla asociados en Supabase
-- Ejecuta este script en el SQL Editor de tu proyecto Supabase
-- IMPORTANTE: Este script agrega soporte para estado 'RETIRADO' en socios

-- Agregar columna estado a la tabla asociados
ALTER TABLE asociados 
ADD COLUMN IF NOT EXISTS estado TEXT NOT NULL DEFAULT 'ACTIVO';

-- Crear índice para búsquedas rápidas de socios por estado
CREATE INDEX IF NOT EXISTS idx_asociados_estado ON asociados(estado);

-- Nota: Los registros existentes quedarán con estado = 'ACTIVO' por defecto
-- Esto asegura compatibilidad con el sistema existente

