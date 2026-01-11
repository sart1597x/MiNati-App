-- =====================================================
-- SCRIPT SQL COMPLETO PARA CREAR TODAS LAS TABLAS
-- MiNati2026 - Ejecutar en el SQL Editor de Supabase
-- =====================================================

-- =====================================================
-- 1. TABLA: moras
-- Control de moras con todas las columnas especificadas
-- =====================================================
CREATE TABLE IF NOT EXISTS moras (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  asociado_id UUID,
  fecha_pago DATE,
  cuota INTEGER NOT NULL CHECK (cuota >= 1 AND cuota <= 24),
  dias_mora INTEGER NOT NULL DEFAULT 0 CHECK (dias_mora >= 0 AND dias_mora <= 15),
  valor_mora NUMERIC(10, 2) NOT NULL DEFAULT 3000,
  total_sancion NUMERIC(10, 2) NOT NULL DEFAULT 0,
  valor_pagado NUMERIC(10, 2) NOT NULL DEFAULT 0,
  resta NUMERIC(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Índices para moras
CREATE INDEX IF NOT EXISTS idx_moras_asociado_id ON moras(asociado_id);
CREATE INDEX IF NOT EXISTS idx_moras_cuota ON moras(cuota);
CREATE INDEX IF NOT EXISTS idx_moras_fecha_pago ON moras(fecha_pago);
CREATE INDEX IF NOT EXISTS idx_moras_resta ON moras(resta) WHERE resta > 0;

-- =====================================================
-- 2. TABLA: historial_moras
-- Registro de cada abono o pago total realizado
-- =====================================================
CREATE TABLE IF NOT EXISTS historial_moras (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mora_id UUID NOT NULL REFERENCES moras(id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  valor NUMERIC(10, 2) NOT NULL,
  tipo_pago TEXT NOT NULL CHECK (tipo_pago IN ('abono', 'pago_total')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Índices para historial_moras
CREATE INDEX IF NOT EXISTS idx_historial_moras_mora_id ON historial_moras(mora_id);
CREATE INDEX IF NOT EXISTS idx_historial_moras_fecha ON historial_moras(fecha);
CREATE INDEX IF NOT EXISTS idx_historial_moras_tipo_pago ON historial_moras(tipo_pago);

-- =====================================================
-- 3. TABLA: prestamos
-- Información de préstamos con las columnas especificadas
-- =====================================================
CREATE TABLE IF NOT EXISTS prestamos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_nombre TEXT NOT NULL,
  es_socio BOOLEAN NOT NULL DEFAULT false,
  monto NUMERIC(10, 2) NOT NULL,
  tasa NUMERIC(5, 2) NOT NULL,
  fecha_inicio DATE NOT NULL,
  estado TEXT NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'pagado')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Índices para prestamos
CREATE INDEX IF NOT EXISTS idx_prestamos_cliente_nombre ON prestamos(cliente_nombre);
CREATE INDEX IF NOT EXISTS idx_prestamos_estado ON prestamos(estado);
CREATE INDEX IF NOT EXISTS idx_prestamos_fecha_inicio ON prestamos(fecha_inicio);
CREATE INDEX IF NOT EXISTS idx_prestamos_es_socio ON prestamos(es_socio);

-- =====================================================
-- 4. TABLA: pagos_prestamos
-- Historial detallado del extracto de préstamos
-- =====================================================
CREATE TABLE IF NOT EXISTS pagos_prestamos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  prestamo_id UUID NOT NULL REFERENCES prestamos(id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  tipo_movimiento TEXT NOT NULL CHECK (tipo_movimiento IN ('pago_interes', 'abono_capital', 'desembolso')),
  valor_pagado NUMERIC(10, 2) NOT NULL,
  interes_causado NUMERIC(10, 2) DEFAULT 0,
  abono_capital NUMERIC(10, 2) DEFAULT 0,
  saldo_pendiente NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Índices para pagos_prestamos
CREATE INDEX IF NOT EXISTS idx_pagos_prestamos_prestamo_id ON pagos_prestamos(prestamo_id);
CREATE INDEX IF NOT EXISTS idx_pagos_prestamos_fecha ON pagos_prestamos(fecha);
CREATE INDEX IF NOT EXISTS idx_pagos_prestamos_tipo_movimiento ON pagos_prestamos(tipo_movimiento);

-- =====================================================
-- TABLA ADICIONAL: pagos_moras (para compatibilidad con código actual)
-- Esta tabla es usada por el código TypeScript actual
-- =====================================================
CREATE TABLE IF NOT EXISTS pagos_moras (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mora_id TEXT NOT NULL,
  fecha_pago DATE NOT NULL,
  valor_recibido NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Índices para pagos_moras
CREATE INDEX IF NOT EXISTS idx_pagos_moras_mora_id ON pagos_moras(mora_id);
CREATE INDEX IF NOT EXISTS idx_pagos_moras_fecha_pago ON pagos_moras(fecha_pago);

-- =====================================================
-- FUNCIONES Y TRIGGERS
-- =====================================================

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para actualizar updated_at
CREATE TRIGGER update_moras_updated_at
    BEFORE UPDATE ON moras
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_prestamos_updated_at
    BEFORE UPDATE ON prestamos
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pagos_prestamos_updated_at
    BEFORE UPDATE ON pagos_prestamos
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Función para calcular resta automáticamente en moras
CREATE OR REPLACE FUNCTION calcular_resta_mora()
RETURNS TRIGGER AS $$
BEGIN
    NEW.resta = NEW.total_sancion - NEW.valor_pagado;
    IF NEW.resta < 0 THEN
        NEW.resta = 0;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para calcular resta en moras
CREATE TRIGGER calcular_resta_mora_trigger
    BEFORE INSERT OR UPDATE ON moras
    FOR EACH ROW
    EXECUTE FUNCTION calcular_resta_mora();

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE moras ENABLE ROW LEVEL SECURITY;
ALTER TABLE historial_moras ENABLE ROW LEVEL SECURITY;
ALTER TABLE prestamos ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagos_prestamos ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagos_moras ENABLE ROW LEVEL SECURITY;

-- Políticas para permitir todas las operaciones
-- ⚠️ AJUSTA ESTAS POLÍTICAS SEGÚN TUS NECESIDADES DE SEGURIDAD ⚠️

CREATE POLICY "Allow all operations for moras" ON moras
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations for historial_moras" ON historial_moras
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations for prestamos" ON prestamos
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations for pagos_prestamos" ON pagos_prestamos
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations for pagos_moras" ON pagos_moras
    FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- VERIFICACIÓN FINAL
-- =====================================================

-- Verificar que las tablas se crearon correctamente
DO $$
DECLARE
    tabla_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO tabla_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name IN ('moras', 'historial_moras', 'prestamos', 'pagos_prestamos', 'pagos_moras');
    
    IF tabla_count = 5 THEN
        RAISE NOTICE '✅ Todas las tablas se crearon exitosamente!';
        RAISE NOTICE '   - moras';
        RAISE NOTICE '   - historial_moras';
        RAISE NOTICE '   - prestamos';
        RAISE NOTICE '   - pagos_prestamos';
        RAISE NOTICE '   - pagos_moras (compatibilidad)';
    ELSE
        RAISE WARNING '⚠️ Solo se crearon % de 5 tablas esperadas', tabla_count;
    END IF;
END $$;
