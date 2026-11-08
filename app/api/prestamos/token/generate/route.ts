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

    // Verificar si ya existe un token
    const { data: prestamoExistente, error: prestamoError } = await serviceRoleClient
      .from('prestamos')
      .select('id, public_token')
      .eq('id', prestamoId)
      .single()

    if (prestamoError || !prestamoExistente) {
      return NextResponse.json(
        { error: 'Préstamo no encontrado' },
        { status: 404 }
      )
    }

    // Si ya tiene un token, devolverlo
    if (prestamoExistente.public_token) {
      const origin = process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_APP_URL
        ? process.env.NEXT_PUBLIC_APP_URL
        : request.nextUrl.origin
      const publicUrl = `${origin}/prestamos/public/${prestamoExistente.public_token}`
      return NextResponse.json({
        publicToken: prestamoExistente.public_token,
        publicUrl
      })
    }

    // Generar nuevo token
    const token = crypto.randomUUID()

    // Actualizar préstamo con el token
    const { error: updateError } = await serviceRoleClient
      .from('prestamos')
      .update({ public_token: token })
      .eq('id', prestamoId)

    if (updateError) {
      console.error('Error actualizando token:', updateError)
      return NextResponse.json(
        { error: 'Error al generar el enlace' },
        { status: 500 }
      )
    }

    const origin = process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_APP_URL
      ? process.env.NEXT_PUBLIC_APP_URL
      : request.nextUrl.origin
    const publicUrl = `${origin}/prestamos/public/${token}`

    return NextResponse.json({
      publicToken: token,
      publicUrl
    })

  } catch (error) {
    console.error('Error en generate token:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
