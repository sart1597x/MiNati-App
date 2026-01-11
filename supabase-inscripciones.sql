-- Script SQL para crear la tabla inscripciones en Supabase
-- Ejecuta este script en el SQL Editor de tu proyecto Supabase
-- IMPORTANTE: Esta tabla es independiente de inscripciones_pagos

-- Tabla de inscripciones
CREATE TABLE IF NOT EXISTS inscripciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  socio_id integer NOT NULL,
  valor integer NOT NULL,
  estado text NOT NULL CHECK (estado IN ('PENDIENTE', 'PAGADA')),
  fecha_inscripcion date NOT NULL,
  fecha_pago date,
  created_at timestamp DEFAULT now()
);

