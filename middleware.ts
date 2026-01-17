import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // Headers para evitar caché de seguridad
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  response.headers.set('Pragma', 'no-cache')
  response.headers.set('Expires', '0')

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  // ✅ VALIDACIÓN REAL: Usar getUser() para validar sesión con el servidor
  const { data: { user }, error } = await supabase.auth.getUser()

  // Si estamos en la ruta de login
  if (request.nextUrl.pathname.startsWith('/login')) {
    // Si hay usuario válido, redirigir al home
    if (user && !error) {
      const redirectResponse = NextResponse.redirect(new URL('/', request.url))
      redirectResponse.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
      return redirectResponse
    }
    // Si no hay usuario, permitir acceso al login
    return response
  }

  // ✅ VALIDACIÓN ESTRICTA: Si no hay usuario válido, redirigir a login
  // Esto incluye la ruta raíz / y todas las rutas protegidas
  if (!user || error) {
    const redirectResponse = NextResponse.redirect(new URL('/login', request.url))
    redirectResponse.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
    // Limpiar cookies de sesión si no hay usuario válido
    redirectResponse.cookies.delete('sb-access-token')
    redirectResponse.cookies.delete('sb-refresh-token')
    // Limpiar cualquier cookie de Supabase que pueda existir
    const allCookies = request.cookies.getAll()
    allCookies.forEach(cookie => {
      if (cookie.name.includes('supabase') || cookie.name.includes('sb-') || cookie.name.includes('auth')) {
        redirectResponse.cookies.delete(cookie.name)
      }
    })
    return redirectResponse
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
}