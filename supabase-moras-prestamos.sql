-- Script SQL para crear las tablas de moras y préstamos en Supabase
-- Ejecuta este script en el SQL Editor de tu proyecto Supabase

-- Tabla para pagos de moras
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

-- Tabla para préstamos
CREATE TABLE IF NOT EXISTS prestamos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cedula TEXT NOT NULL,
  nombre TEXT NOT NULL,
  whatsapp TEXT,
  monto NUMERIC(10, 2) NOT NULL,
  tasa_interes_mensual NUMERIC(5, 2) NOT NULL,
  fecha_inicio DATE NOT NULL,
  es_socio BOOLEAN NOT NULL DEFAULT false,
  estado TEXT NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'pagado')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Índices para prestamos
CREATE INDEX IF NOT EXISTS idx_prestamos_cedula ON prestamos(cedula);
CREATE INDEX IF NOT EXISTS idx_prestamos_estado ON prestamos(estado);

-- Tabla para pagos de préstamos (movimientos)
CREATE TABLE IF NOT EXISTS pagos_prestamos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  prestamo_id UUID NOT NULL REFERENCES prestamos(id) ON DELETE CASCADE,
  fecha_pago DATE NOT NULL,
  valor_pagado NUMERIC(10, 2) NOT NULL,
  tipo_movimiento TEXT NOT NULL CHECK (tipo_movimiento IN ('pago_interes', 'abono_capital')),
  dias_causados INTEGER,
  interes_causado NUMERIC(10, 2),
  abono_capital NUMERIC(10, 2),
  saldo_anterior NUMERIC(10, 2),
  saldo_total_pendiente NUMERIC(10, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Índices para pagos_prestamos
CREATE INDEX IF NOT EXISTS idx_pagos_prestamos_prestamo_id ON pagos_prestamos(prestamo_id);
CREATE INDEX IF NOT EXISTS idx_pagos_prestamos_fecha_pago ON pagos_prestamos(fecha_pago);

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para actualizar updated_at
CREATE TRIGGER update_prestamos_updated_at
    BEFORE UPDATE ON prestamos
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pagos_prestamos_updated_at
    BEFORE UPDATE ON pagos_prestamos
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Habilitar Row Level Security (RLS)
ALTER TABLE pagos_moras ENABLE ROW LEVEL SECURITY;
ALTER TABLE prestamos ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagos_prestamos ENABLE ROW LEVEL SECURITY;

-- Políticas para permitir todas las operaciones (ajusta según tus necesidades de seguridad)
CREATE POLICY "Allow all operations for pagos_moras" ON pagos_moras
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations for prestamos" ON prestamos
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations for pagos_prestamos" ON pagos_prestamos
    FOR ALL USING (true) WITH CHECK (true);

