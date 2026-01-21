
# Arquitectura Kinetix Elite V12.4

## 1. Stack Tecnológico
- **Frontend:** React 19 + Tailwind CSS + Lucide Icons + Recharts.
- **Backend:** Supabase (PostgreSQL + Auth).
- **IA:** Google Gemini 3 Flash (Generación de protocolos técnicos).
- **Despliegue:** Vercel.

## 2. Configuración de Base de Datos (Supabase)

Para inicializar tu base de datos profesional:

1. **Crea un proyecto** en [supabase.com](https://supabase.com).
2. Ve al **SQL Editor** (icono de terminal en la barra lateral).
3. Crea una "New Query" y pega el contenido del archivo `database.sql`.
4. Haz clic en **Run**. Esto creará automáticamente toda la infraestructura de tablas, enums y relaciones.

## 3. Despliegue en Vercel

1. Sube tu código a un repositorio de GitHub.
2. Importa el proyecto en Vercel.
3. En **Environment Variables**, configura:
   - `API_KEY`: Tu llave de Google Gemini.
   - (Próxima Fase) `SUPABASE_URL` y `SUPABASE_ANON_KEY`.

## 4. Próximos Pasos de Ingeniería
- **Migración DataEngine:** Actualmente la app usa `localStorage` para persistencia inmediata sin latencia. Una vez configurado Supabase, el `DataEngine` de `App.tsx` debe actualizarse para usar el cliente de Supabase y sincronizar en tiempo real.
- **Auth:** Habilitar Supabase Auth para que los atletas puedan entrar con su propio email y contraseña.
