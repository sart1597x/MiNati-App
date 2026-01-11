'use client'

import Link from 'next/link'
import { Home, UserPlus, Receipt, AlertCircle, DollarSign, Wallet, LogOut, Calculator, Settings } from 'lucide-react'

export default function DashboardPage() {
  const handleLogout = () => {
    if (confirm('¿Estás seguro de que deseas cerrar sesión?')) {
      // Aquí puedes agregar lógica de logout si es necesario
      window.location.href = '/'
    }
  }

  const cards = [
    {
      title: 'Inscribir Socios',
      description: 'Registrar nuevos asociados en la natillera',
      icon: UserPlus,
      href: '/socios',
      color: 'from-blue-500 to-blue-600',
      hoverColor: 'hover:from-blue-600 hover:to-blue-700'
    },
    {
      title: 'Registro de Cuotas',
      description: 'Control y registro de pagos de cuotas',
      icon: Receipt,
      href: '/pagos',
      color: 'from-green-500 to-green-600',
      hoverColor: 'hover:from-green-600 hover:to-green-700'
    },
    {
      title: 'Control de Moras',
      description: 'Gestión de multas por retraso en pagos',
      icon: AlertCircle,
      href: '/moras',
      color: 'from-red-500 to-red-600',
      hoverColor: 'hover:from-red-600 hover:to-red-700'
    },
    {
      title: 'Préstamos',
      description: 'Administración de créditos y préstamos',
      icon: DollarSign,
      href: '/prestamos',
      color: 'from-purple-500 to-purple-600',
      hoverColor: 'hover:from-purple-600 hover:to-purple-700'
    },
    {
      title: 'Caja Central',
      description: 'Resumen de saldo total y movimientos',
      icon: Wallet,
      href: '/caja',
      color: 'from-yellow-500 to-yellow-600',
      hoverColor: 'hover:from-yellow-600 hover:to-yellow-700'
    },
    {
      title: 'Liquidar Asociados',
      description: 'Sistema de liquidación anual de asociados',
      icon: Calculator,
      href: '/liquidacion',
      color: 'from-indigo-900 to-indigo-800',
      hoverColor: 'hover:from-indigo-800 hover:to-indigo-700'
    },
    {
      title: 'Registrar Gasto Bancario (4xMil)',
      description: 'Registrar gastos bancarios 4xMil operativo',
      icon: DollarSign,
      href: '/gastos-bancarios',
      color: 'from-red-900 to-red-800',
      hoverColor: 'hover:from-red-800 hover:to-red-700'
    },
    {
      title: 'Actividades',
      description: 'Registrar actividades y participaciones',
      icon: DollarSign,
      href: '/actividades',
      color: 'from-purple-900 to-purple-800',
      hoverColor: 'hover:from-purple-800 hover:to-purple-700'
    }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-12 text-center relative">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Home className="w-12 h-12 text-white" />
            <h1 className="text-5xl font-bold text-white">MiNati2026</h1>
          </div>
          <p className="text-xl text-gray-300">Panel de Control Principal</p>
          {/* Ícono de Configuración */}
          <Link
            href="/configuracion"
            className="absolute top-0 right-0 p-2 text-gray-400 hover:text-white transition-colors duration-200"
            title="Configuración"
          >
            <Settings className="w-6 h-6" />
          </Link>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {cards.map((card, index) => {
            const Icon = card.icon
            return (
              <Link
                key={index}
                href={card.href}
                className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${card.color} ${card.hoverColor} p-8 shadow-2xl transition-all duration-300 transform hover:scale-105 hover:shadow-3xl`}
              >
                <div className="relative z-10">
                  <div className="mb-4">
                    <Icon className="w-16 h-16 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">{card.title}</h2>
                  <p className="text-gray-100 text-sm">{card.description}</p>
                </div>
                <div className="absolute inset-0 bg-black opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>
              </Link>
            )
          })}
        </div>

        {/* Logout Button */}
        <div className="flex justify-center">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-8 py-4 bg-gray-800 hover:bg-gray-700 text-white rounded-xl shadow-lg transition-all duration-300 transform hover:scale-105"
          >
            <LogOut className="w-5 h-5" />
            <span className="text-lg font-semibold">Cerrar Sesión</span>
          </button>
        </div>
      </div>
    </div>
  )
}

