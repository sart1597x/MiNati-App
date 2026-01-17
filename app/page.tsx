import { redirect } from 'next/navigation'
import { obtenerAnioVigente } from '@/lib/configuracion'

export default async function Home() {
  await obtenerAnioVigente()
  redirect('/dashboard')
}

