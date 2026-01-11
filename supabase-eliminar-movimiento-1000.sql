-- Script SQL para encontrar y eliminar el movimiento huérfano de $1.000
-- Ejecuta este script en el SQL Editor de tu proyecto Supabase

-- PASO 1: Buscar movimientos de $1.000 que no tengan referencia_id
-- (Movimientos huérfanos que no están vinculados a ningún pago)
SELECT 
  id,
  tipo,
  concepto,
  monto,
  fecha,
  referencia_id,
  created_at
FROM caja_central
WHERE monto = 1000
  AND (referencia_id IS NULL OR referencia_id = '')
ORDER BY created_at DESC;

-- PASO 2: Si encuentras el movimiento, elimínalo usando su ID
-- Reemplaza 'ID_DEL_MOVIMIENTO' con el ID real que encuentres en el paso anterior
-- DELETE FROM caja_central WHERE id = 'ID_DEL_MOVIMIENTO';

-- PASO 3 (OPCIONAL): Buscar todos los movimientos sin referencia_id
-- Esto te mostrará todos los movimientos que no están vinculados a pagos
SELECT 
  id,
  tipo,
  concepto,
  monto,
  fecha,
  referencia_id,
  created_at
FROM caja_central
WHERE referencia_id IS NULL OR referencia_id = ''
ORDER BY created_at DESC;

