import { NextRequest, NextResponse } from 'next/server'
import { getServiceRoleClient } from '@/lib/supabase-admin'
import { calcularMovimientos, Prestamo, PagoPrestamo } from '@/lib/calcular-movimientos-prestamos'

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params

    if (!token) {
      return NextResponse.json(
        { error: 'Token es requerido' },
        { status: 400 }
      )
    }

    // Buscar préstamo por token exacto usando serviceRoleClient
    const serviceRoleClient = getServiceRoleClient()
    const { data: prestamo, error: prestamoError } = await serviceRoleClient
      .from('prestamos')
      .select('id, nombre_prestamista, monto, tasa_interes, fecha_inicio, estado, public_token')
      .eq('public_token', token)
      .single()

    if (prestamoError || !prestamo) {
      return NextResponse.json(
        { error: 'Token inválido o préstamo no encontrado' },
        { status: 404 }
      )
    }

    // Verificación adicional: confirmar que el token coincida exactamente y no sea nulo
    if (!prestamo.public_token || prestamo.public_token !== token) {
      return NextResponse.json(
        { error: 'Token inválido o revocado' },
        { status: 404 }
      )
    }

    // Obtener movimientos del préstamo usando serviceRoleClient
    const { data: movimientos, error: movimientosError } = await serviceRoleClient
      .from('pagos_prestamos')
      .select('*')
      .eq('prestamo_id', prestamo.id)
      .order('fecha', { ascending: true })

    if (movimientosError) {
      console.error('Error obteniendo movimientos:', movimientosError)
      return NextResponse.json(
        { error: 'Error al obtener el extracto' },
        { status: 500 }
      )
    }

    // Calcular movimientos con fórmulas financieras compartidas
    const prestamoData: Prestamo = {
      id: prestamo.id,
      nombre_prestamista: prestamo.nombre_prestamista,
      monto: prestamo.monto,
      tasa_interes: prestamo.tasa_interes,
      fecha_inicio: prestamo.fecha_inicio,
      estado: prestamo.estado
    }

    const movimientosCalculados = calcularMovimientos(prestamoData, movimientos || [])

    // Devolver datos del préstamo y movimientos calculados
    return NextResponse.json({
      prestamo: {
        id: prestamo.id,
        nombre_prestamista: prestamo.nombre_prestamista,
        monto: prestamo.monto,
        tasa_interes: prestamo.tasa_interes,
        fecha_inicio: prestamo.fecha_inicio,
        estado: prestamo.estado
      },
      movimientos: movimientosCalculados
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })

  } catch (error) {
    console.error('Error en API pública de extracto:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
