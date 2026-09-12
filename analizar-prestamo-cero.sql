-- ANÁLISIS DE UN PRÉSTAMO PAGADO CON MONTO = 0
-- Para verificar si la información del desembolso está disponible

-- 1. ENCONTRAR EL PRÉSTAMO POR NÚMERO DE CRÉDITO
SELECT 
    id,
    nombre_prestamista,
    monto as monto_actual,
    estado,
    fecha_inicio,
    tasa_interes
FROM prestamos
WHERE nombre_prestamista ILIKE '%MARIANA LOPEZ%'
  AND estado = 'pagado' 
  AND monto = 0
ORDER BY fecha_inicio DESC;

-- 2. VER TODOS LOS MOVIMIENTOS DE MARIANA LOPEZ (para identificar NAT0046)
SELECT 
    p.id,
    p.nombre_prestamista,
    p.monto as monto_actual,
    p.estado,
    p.fecha_inicio,
    pp.id as movimiento_id,
    pp.tipo_movimiento,
    pp.valor_pagado,
    pp.saldo_pendiente,
    pp.capital_pendiente,
    pp.fecha as fecha_movimiento
FROM prestamos p
LEFT JOIN pagos_prestamos pp ON p.id = pp.prestamo_id
WHERE p.nombre_prestamista ILIKE '%MARIANA LOPEZ%'
ORDER BY p.fecha_inicio DESC, pp.fecha ASC;

-- 3. VER MOVIMIENTOS COMPLETOS DEL PRÉSTAMO ID 46 (NAT0046)
SELECT 
    id,
    prestamo_id,
    tipo_movimiento,
    valor_pagado,
    saldo_pendiente,
    capital_pendiente,
    interes_causado,
    interes_pagado,
    abono_capital,
    fecha
FROM pagos_prestamos
WHERE prestamo_id = 46  -- ID 46 = NAT0046 de MARIANA LOPEZ
ORDER BY fecha ASC, id ASC;

-- 4. VER EL PRIMER MOVIMIENTO (DESEMBOLSO) DEL PRÉSTAMO ID 46
SELECT 
    id,
    prestamo_id,
    tipo_movimiento,
    saldo_pendiente as monto_desembolso,
    capital_pendiente,
    fecha
FROM pagos_prestamos
WHERE prestamo_id = 46  -- ID 46 = NAT0046 de MARIANA LOPEZ
  AND tipo_movimiento = 'desembolso'
ORDER BY fecha ASC, id ASC
LIMIT 1;

-- 5. RESTAURAR EL MONTO DEL PRÉSTAMO ID 46 (SOLO EJECUTAR DESPUÉS DE VERIFICAR)
UPDATE prestamos
SET monto = 700000  -- Monto original del desembolso
WHERE id = 46;

-- 6. VERIFICAR QUE LA RESTAURACIÓN FUE EXITOSA
SELECT 
    id,
    nombre_prestamista,
    monto as monto_restaurado,
    estado,
    fecha_inicio
FROM prestamos
WHERE id = 46;

-- 7. REVERTIR LA RESTAURACIÓN (porque afecta el cálculo de caja)
UPDATE prestamos
SET monto = 0
WHERE id = 46;

-- 8. VERIFICAR QUE SE REVERTIÓ CORRECTAMENTE
SELECT 
    id,
    nombre_prestamista,
    monto as monto_actual,
    estado,
    fecha_inicio
FROM prestamos
WHERE id = 46;
