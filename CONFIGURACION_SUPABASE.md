# Configuración de Supabase

## Pasos para conectar tu aplicación con Supabase

### 1. Crear el archivo de variables de entorno

Crea un archivo `.env.local` en la raíz del proyecto con el siguiente contenido:

```
NEXT_PUBLIC_SUPABASE_URL=tu_url_de_supabase_aqui
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key_de_supabase_aqui
```

### 2. Obtener tus credenciales de Supabase

1. Ve a tu proyecto en [Supabase](https://supabase.com)
2. Ve a **Settings** → **API**
3. Copia la **URL** del proyecto y pégala en `NEXT_PUBLIC_SUPABASE_URL`
4. Copia la **anon/public key** y pégala en `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 3. Crear la tabla en Supabase

1. Ve a **SQL Editor** en tu proyecto de Supabase
2. Abre el archivo `supabase-setup.sql` de este proyecto
3. Copia y pega todo el contenido en el SQL Editor
4. Ejecuta el script (botón "Run")

Esto creará la tabla `socios` con todos los campos necesarios.

### 4. Configurar políticas de seguridad (RLS)

El script SQL incluye una política básica que permite todas las operaciones. Para producción, deberías ajustar las políticas según tus necesidades de seguridad.

### 5. Instalar dependencias e iniciar

```bash
npm install
npm run dev
```

### 6. Acceder a la página de socios

Una vez que todo esté configurado, visita:
- http://localhost:3000/socios

## Estructura de la tabla `socios`

- `id` (UUID): Identificador único
- `nombre` (TEXT): Nombre del socio
- `cedula` (TEXT): Cédula (única)
- `whatsapp` (TEXT): Número de WhatsApp
- `cupos` (INTEGER): Cantidad de cupos
- `created_at` (TIMESTAMP): Fecha de creación
- `updated_at` (TIMESTAMP): Fecha de última actualización

