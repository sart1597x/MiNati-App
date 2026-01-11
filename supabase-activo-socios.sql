-- Script SQL para agregar columna activo a la tabla asociados en Supabase
-- Ejecuta este script en el SQL Editor de tu proyecto Supabase
-- IMPORTANTE: Este script implementa soft delete para socios

-- Agregar columna activo a la tabla asociados
ALTER TABLE asociados 
ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT true;

-- Crear índice para búsquedas rápidas de socios activos
CREATE INDEX IF NOT EXISTS idx_asociados_activo ON asociados(activo);

-- Nota: Los registros existentes quedarán con activo = true por defecto
-- Esto asegura que todos los socios actuales sigan siendo activos

