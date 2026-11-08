import { NextRequest, NextResponse } from 'next/server'
import { getServiceRoleClient } from '@/lib/supabase-admin'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { prestamoId } = body

    if (!prestamoId) {
      return NextResponse.json(
        { error: 'prestamoId es requerido' },
        { status: 400 }
      )
    }

    const serviceRoleClient = getServiceRoleClient()

    // Revocar token estableciéndolo a null
    const { error: updateError } = await serviceRoleClient
      .from('prestamos')
      .update({ public_token: null })
      .eq('id', prestamoId)

    if (updateError) {
      console.error('Error revocando token:', updateError)
      return NextResponse.json(
        { error: 'Error al revocar el enlace' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Enlace revocado exitosamente'
    })

  } catch (error) {
    console.error('Error en revoke token:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
