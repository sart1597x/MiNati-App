-- =====================================================
-- SCRIPT SQL: BORRADO EN CASCADA PARA ASOCIADOS
-- MiNati2026 - Ejecutar en el SQL Editor de Supabase
-- =====================================================
-- 
-- OBJETIVO:
-- Permitir eliminar asociados definitivamente del sistema.
-- Al eliminar un asociado, se borran automáticamente
-- todos los registros relacionados en TODOS los módulos.
--
-- IMPORTANTE:
-- - Este script NO modifica lógica de negocio
-- - NO elimina tablas ni datos existentes
-- - Solo ajusta constraints de foreign keys
-- =====================================================

-- =====================================================
-- 1. TABLA: cuotas_pagos
-- Relación: socio_id -> asociados(id)
-- =====================================================
-- Eliminar constraint existente si existe
DO $$ 
BEGIN
    -- Buscar y eliminar constraint de cuotas_pagos
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'cuotas_pagos' 
        AND constraint_type = 'FOREIGN KEY'
        AND constraint_name LIKE '%socio_id%'
    ) THEN
        ALTER TABLE cuotas_pagos 
        DROP CONSTRAINT IF EXISTS cuotas_pagos_socio_id_fkey;
    END IF;
END $$;

-- Recrear constraint con ON DELETE CASCADE
ALTER TABLE cuotas_pagos
ADD CONSTRAINT cuotas_pagos_socio_id_fkey 
FOREIGN KEY (socio_id) 
REFERENCES asociados(id) 
ON DELETE CASCADE;

-- =====================================================
-- 2. TABLA: inscripciones
-- Relación: socio_id -> asociados(id)
-- =====================================================
-- Eliminar constraint existente si existe
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'inscripciones' 
        AND constraint_type = 'FOREIGN KEY'
        AND constraint_name LIKE '%socio_id%'
    ) THEN
        ALTER TABLE inscripciones 
        DROP CONSTRAINT IF EXISTS inscripciones_socio_id_fkey;
    END IF;
END $$;

-- Recrear constraint con ON DELETE CASCADE
ALTER TABLE inscripciones
ADD CONSTRAINT inscripciones_socio_id_fkey 
FOREIGN KEY (socio_id) 
REFERENCES asociados(id) 
ON DELETE CASCADE;

-- =====================================================
-- 3. TABLA: inscripciones_pagos
-- Relación: asociado_id -> asociados(id)
-- =====================================================
-- Eliminar constraint existente si existe
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'inscripciones_pagos' 
        AND constraint_type = 'FOREIGN KEY'
        AND constraint_name LIKE '%asociado_id%'
    ) THEN
        ALTER TABLE inscripciones_pagos 
        DROP CONSTRAINT IF EXISTS inscripciones_pagos_asociado_id_fkey;
    END IF;
END $$;

-- Recrear constraint con ON DELETE CASCADE
ALTER TABLE inscripciones_pagos
ADD CONSTRAINT inscripciones_pagos_asociado_id_fkey 
FOREIGN KEY (asociado_id) 
REFERENCES asociados(id) 
ON DELETE CASCADE;

-- =====================================================
-- 4. TABLA: moras
-- Relación: asociado_id -> asociados(id)
-- NOTA: asociado_id puede ser UUID o INTEGER según la BD
-- =====================================================
-- Eliminar constraint existente si existe
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'moras' 
        AND constraint_type = 'FOREIGN KEY'
        AND constraint_name LIKE '%asociado_id%'
    ) THEN
        ALTER TABLE moras 
        DROP CONSTRAINT IF EXISTS moras_asociado_id_fkey;
    END IF;
END $$;

-- Recrear constraint con ON DELETE CASCADE
-- Manejar tanto UUID como INTEGER según el tipo de columna
DO $$ 
BEGIN
    -- Verificar el tipo de dato de asociado_id en moras
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'moras' 
        AND column_name = 'asociado_id'
        AND data_type = 'uuid'
    ) THEN
        -- Si es UUID, verificar que asociados.id también sea UUID
        ALTER TABLE moras
        ADD CONSTRAINT moras_asociado_id_fkey 
        FOREIGN KEY (asociado_id) 
        REFERENCES asociados(id) 
        ON DELETE CASCADE;
    ELSIF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'moras' 
        AND column_name = 'asociado_id'
        AND data_type IN ('integer', 'bigint')
    ) THEN
        -- Si es INTEGER, crear constraint con INTEGER
        ALTER TABLE moras
        ADD CONSTRAINT moras_asociado_id_fkey 
        FOREIGN KEY (asociado_id) 
        REFERENCES asociados(id) 
        ON DELETE CASCADE;
    END IF;
END $$;

-- =====================================================
-- 5. TABLA: actividades_caritas
-- Relación: socio_id -> asociados(id)
-- =====================================================
-- Eliminar constraint existente si existe
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'actividades_caritas' 
        AND constraint_type = 'FOREIGN KEY'
        AND constraint_name LIKE '%socio_id%'
    ) THEN
        ALTER TABLE actividades_caritas 
        DROP CONSTRAINT IF EXISTS actividades_caritas_socio_id_fkey;
    END IF;
END $$;

-- Recrear constraint con ON DELETE CASCADE
ALTER TABLE actividades_caritas
ADD CONSTRAINT actividades_caritas_socio_id_fkey 
FOREIGN KEY (socio_id) 
REFERENCES asociados(id) 
ON DELETE CASCADE;

-- =====================================================
-- 6. TABLA: actividades_pagos
-- Relación: socio_id -> asociados(id)
-- =====================================================
-- Eliminar constraint existente si existe
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'actividades_pagos' 
        AND constraint_type = 'FOREIGN KEY'
        AND constraint_name LIKE '%socio_id%'
    ) THEN
        ALTER TABLE actividades_pagos 
        DROP CONSTRAINT IF EXISTS actividades_pagos_socio_id_fkey;
    END IF;
END $$;

-- Recrear constraint con ON DELETE CASCADE
ALTER TABLE actividades_pagos
ADD CONSTRAINT actividades_pagos_socio_id_fkey 
FOREIGN KEY (socio_id) 
REFERENCES asociados(id) 
ON DELETE CASCADE;

-- =====================================================
-- 7. TABLA: participaciones_actividades
-- Relación: asociado_id -> asociados(id)
-- =====================================================
-- Eliminar constraint existente si existe
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'participaciones_actividades' 
        AND constraint_type = 'FOREIGN KEY'
        AND constraint_name LIKE '%asociado_id%'
    ) THEN
        ALTER TABLE participaciones_actividades 
        DROP CONSTRAINT IF EXISTS participaciones_actividades_asociado_id_fkey;
    END IF;
END $$;

-- Recrear constraint con ON DELETE CASCADE
ALTER TABLE participaciones_actividades
ADD CONSTRAINT participaciones_actividades_asociado_id_fkey 
FOREIGN KEY (asociado_id) 
REFERENCES asociados(id) 
ON DELETE CASCADE;

-- =====================================================
-- 8. TABLA: prestamos
-- Relación: asociado_id -> asociados(id) (opcional)
-- =====================================================
-- Eliminar constraint existente si existe
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'prestamos' 
        AND constraint_type = 'FOREIGN KEY'
        AND constraint_name LIKE '%asociado_id%'
    ) THEN
        ALTER TABLE prestamos 
        DROP CONSTRAINT IF EXISTS prestamos_asociado_id_fkey;
    END IF;
END $$;

-- Recrear constraint con ON DELETE CASCADE (solo si la columna existe)
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'prestamos' 
        AND column_name = 'asociado_id'
    ) THEN
        ALTER TABLE prestamos
        ADD CONSTRAINT prestamos_asociado_id_fkey 
        FOREIGN KEY (asociado_id) 
        REFERENCES asociados(id) 
        ON DELETE CASCADE;
    END IF;
END $$;

-- =====================================================
-- VERIFICACIÓN FINAL
-- =====================================================
-- Mostrar todas las foreign keys hacia asociados(id) con CASCADE
SELECT 
    tc.table_name,
    kcu.column_name,
    tc.constraint_name,
    rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.referential_constraints AS rc
    ON tc.constraint_name = rc.constraint_name
    AND tc.table_schema = rc.constraint_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND kcu.table_name IN (
        'cuotas_pagos',
        'inscripciones',
        'inscripciones_pagos',
        'moras',
        'actividades_caritas',
        'actividades_pagos',
        'participaciones_actividades',
        'prestamos'
    )
    AND kcu.column_name IN ('socio_id', 'asociado_id')
    AND rc.unique_constraint_name IN (
        SELECT constraint_name 
        FROM information_schema.table_constraints 
        WHERE table_name = 'asociados' 
        AND constraint_type = 'PRIMARY KEY'
    )
ORDER BY tc.table_name, kcu.column_name;

-- =====================================================
-- FIN DEL SCRIPT
-- =====================================================
-- Después de ejecutar este script:
-- 1. Al eliminar un asociado, se borrarán automáticamente:
--    - Todas sus cuotas (cuotas_pagos)
--    - Todas sus inscripciones (inscripciones, inscripciones_pagos)
--    - Todas sus moras (moras)
--    - Todas sus participaciones en actividades (actividades_caritas, actividades_pagos, participaciones_actividades)
--    - Todos sus préstamos relacionados (prestamos, si tiene asociado_id)
-- 2. Los movimientos en caja_central NO se eliminan (son históricos)
-- 3. La lógica de negocio NO se modifica
-- =====================================================

