-- Script SQL para agregar la columna fecha a la tabla actividades si no existe
-- Ejecuta este script en el SQL Editor de tu proyecto Supabase

-- Verificar y agregar columna fecha si no existe
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'actividades' 
        AND column_name = 'fecha'
    ) THEN
        ALTER TABLE actividades ADD COLUMN fecha DATE;
        -- Si ya hay registros, usar created_at como fecha por defecto
        UPDATE actividades SET fecha = DATE(created_at) WHERE fecha IS NULL;
    END IF;
END $$;

