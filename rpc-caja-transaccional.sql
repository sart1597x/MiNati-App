-- FUNCIÓN RPC PARA MOVIMIENTOS ATÓMICOS DE CAJA CENTRAL
-- FASE 2: Corrección de race conditions en movimientos simultáneos
-- Esta función garantiza que cada movimiento de caja sea atómico usando advisory lock
-- para serializar todas las operaciones de caja y evitar condiciones de carrera

-- Crear o reemplazar la función RPC
CREATE OR REPLACE FUNCTION crear_movimiento_caja_atomico(
  p_tipo TEXT,
  p_concepto TEXT,
  p_monto NUMERIC,
  p_fecha TEXT,
  p_referencia_id TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  v_saldo_anterior NUMERIC;
  v_nuevo_saldo NUMERIC;
  v_movimiento_id BIGINT;
  v_lock_acquired BOOLEAN;
BEGIN
  -- Obtener advisory lock para serializar operaciones de caja
  -- Usamos un ID fijo (123456789) específico para operaciones de caja
  -- pg_try_advisory_xact_lock es transaccional: se libera automáticamente al commit/rollback
  v_lock_acquired := pg_try_advisory_xact_lock(123456789);
  
  IF NOT v_lock_acquired THEN
    -- Si no se puede obtener el lock, esperar (usar pg_advisory_xact_lock en lugar de try)
    PERFORM pg_advisory_xact_lock(123456789);
  END IF;
  
  -- Leer el último saldo (ahora serializado por el advisory lock)
  SELECT nuevo_saldo INTO v_saldo_anterior
  FROM caja_central
  ORDER BY fecha DESC, created_at DESC
  LIMIT 1;
  
  -- Si no hay movimientos, saldo anterior es 0
  IF v_saldo_anterior IS NULL THEN
    v_saldo_anterior := 0;
  END IF;
  
  -- Calcular nuevo saldo según el tipo de movimiento
  IF p_tipo = 'INGRESO' THEN
    v_nuevo_saldo := v_saldo_anterior + p_monto;
  ELSIF p_tipo = 'EGRESO' THEN
    v_nuevo_saldo := v_saldo_anterior - p_monto;
  ELSE
    -- Tipo inválido
    RETURN json_build_object(
      'success', false,
      'error', 'Tipo de movimiento inválido: debe ser INGRESO o EGRESO'
    );
  END IF;
  
  -- Validar que el saldo no sea negativo (para EGRESOS)
  IF v_nuevo_saldo < 0 THEN
    RETURN json_build_object(
      'success', false,
      'error', 'El saldo no puede ser negativo. Saldo actual: ' || v_saldo_anterior || ', Monto: ' || p_monto
    );
  END IF;
  
  -- Insertar movimiento con el saldo_anterior correcto
  INSERT INTO caja_central (
    tipo, concepto, monto, saldo_anterior, nuevo_saldo, fecha, referencia_id
  ) VALUES (
    p_tipo, p_concepto, p_monto, v_saldo_anterior, v_nuevo_saldo, p_fecha, p_referencia_id
  )
  RETURNING id INTO v_movimiento_id;
  
  -- Retornar resultado exitoso (el advisory lock se libera automáticamente al commit)
  RETURN json_build_object(
    'success', true,
    'movimiento_id', v_movimiento_id,
    'saldo_anterior', v_saldo_anterior,
    'nuevo_saldo', v_nuevo_saldo
  );
  
EXCEPTION
  WHEN OTHERS THEN
    -- Retornar error en caso de excepción (el advisory lock se libera automáticamente al rollback)
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Grant execute permissions (ajustar según tu usuario de Supabase)
-- GRANT EXECUTE ON FUNCTION crear_movimiento_caja_atomico TO authenticated;
-- GRANT EXECUTE ON FUNCTION crear_movimiento_caja_atomico TO anon;

-- Prueba de la función (descomentar para probar)
-- SELECT crear_movimiento_caja_atomico(
--   'INGRESO',
--   'Prueba movimiento atómico',
--   100000,
--   '2026-09-03',
--   NULL
-- );
