-- SCRIPT PARA RESTAURAR MONTOS ORIGINALES DE PRÉSTAMOS PAGADOS
-- Este script restaura el monto original de préstamos que fueron pagados
-- y cuyo monto fue puesto en 0 por el bug anterior

-- 1. VERIFICAR PRÉSTAMOS PAGADOS CON MONTO = 0
SELECT 
    id,
    nombre_prestamista,
    monto as monto_actual,
    estado,
    fecha_inicio
FROM prestamos
WHERE estado = 'pagado' AND monto = 0;

-- 2. OBTENER EL MONTO ORIGINAL DESDE EL PRIMER MOVIMIENTO (desembolso)
-- Para cada préstamo pagado con monto = 0, buscar el primer movimiento
WITH prestamos_pagados_cero AS (
    SELECT id, nombre_prestamista, monto as monto_actual
    FROM prestamos
    WHERE estado = 'pagado' AND monto = 0
),
primeros_movimientos AS (
    SELECT 
        pp.prestamo_id,
        pp.saldo_pendiente as monto_original,
        ROW_NUMBER() OVER (PARTITION BY pp.prestamo_id ORDER BY pp.fecha ASC, pp.id ASC) as rn
    FROM pagos_prestamos pp
    WHERE pp.tipo_movimiento = 'desembolso'
)
SELECT 
    p.id,
    p.nombre_prestamista,
    p.monto_actual,
    pm.monto_original
FROM prestamos_pagados_cero p
LEFT JOIN primeros_movimientos pm ON p.id = pm.prestamo_id AND pm.rn = 1;

-- 3. RESTAURAR LOS MONTOS ORIGINALES
-- ⚠️ EJECUTAR SOLO DESPUÉS DE VERIFICAR LOS RESULTADOS ANTERIORES
UPDATE prestamos p
SET monto = pm.monto_original
FROM (
    SELECT 
        pp.prestamo_id,
        pp.saldo_pendiente as monto_original,
        ROW_NUMBER() OVER (PARTITION BY pp.prestamo_id ORDER BY pp.fecha ASC, pp.id ASC) as rn
    FROM pagos_prestamos pp
    WHERE pp.tipo_movimiento = 'desembolso'
) pm
WHERE p.id = pm.prestamo_id 
  AND pm.rn = 1
  AND p.estado = 'pagado' 
  AND p.monto = 0;

-- 4. VERIFICAR RESULTADO DE LA ACTUALIZACIÓN
SELECT 
    id,
    nombre_prestamista,
    monto as monto_restaurado,
    estado,
    fecha_inicio
FROM prestamos
WHERE estado = 'pagado' AND monto > 0
ORDER BY nombre_prestamista;
