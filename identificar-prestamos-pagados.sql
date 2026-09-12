-- IDENTIFICAR PRÉSTAMOS PAGADOS QUE DEJARÁN DE CONTABILIZARSE
-- Este script identifica los préstamos con estado 'pagado' que actualmente
-- están siendo contados como capital prestado pero dejarán de estarlo
-- después agregar el filtro .eq('estado', 'activo') a obtenerTotalCapitalPrestado()

-- 1. Identificar préstamos con monto = 0 (efectivamente pagados por el bug)
SELECT 
    id,
    nombre_prestamista,
    monto as monto_actual,
    estado,
    fecha_inicio
FROM prestamos
WHERE monto = 0
ORDER BY id;

-- 2. Identificar préstamos con estado 'pagado'
SELECT 
    id,
    nombre_prestamista,
    monto as monto_actual,
    estado,
    fecha_inicio
FROM prestamos
WHERE estado = 'pagado'
ORDER BY id;

-- 3. Calcular el total actual (todos los préstamos)
SELECT 
    SUM(monto) as total_capital_actual
FROM prestamos;

-- 4. Calcular el total excluyendo préstamos con monto = 0
SELECT 
    SUM(monto) as total_capital_excluyendo_cero
FROM prestamos
WHERE monto > 0;

-- 5. Mostrar la diferencia
SELECT 
    (SELECT SUM(monto) FROM prestamos WHERE monto = 0) as capital_prestamos_cero,
    (SELECT SUM(monto) FROM prestamos WHERE monto > 0) as capital_prestamos_positivos,
    (SELECT SUM(monto) FROM prestamos) as total_actual,
    (SELECT COUNT(*) FROM prestamos WHERE monto = 0) as cantidad_prestamos_cero;
