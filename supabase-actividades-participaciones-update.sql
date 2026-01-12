-- Script SQL OPCIONAL para agregar campos de pago a participaciones_actividades
-- Ejecuta este script SOLO si los campos pagado y fecha_pago no existen en la tabla
-- Si ya existen, no es necesario ejecutar este script

-- Agregar columna pagado si no existe
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'participaciones_actividades' 
        AND column_name = 'pagado'
    ) THEN
        ALTER TABLE participaciones_actividades 
        ADD COLUMN pagado BOOLEAN NOT NULL DEFAULT false;
    END IF;
END $$;

-- Agregar columna fecha_pago si no existe
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'participaciones_actividades' 
        AND column_name = 'fecha_pago'
    ) THEN
        ALTER TABLE participaciones_actividades 
        ADD COLUMN fecha_pago DATE;
    END IF;
END $$;

