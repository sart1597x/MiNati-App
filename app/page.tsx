import { redirect } from 'next/navigation'

export default async function Home() {
  const anio = await obtenerAnioVigente()
  redirect('/dashboard')
}

