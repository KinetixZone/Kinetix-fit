
# Arquitectura SmartFit Individual MVP

## 1. Stack Tecnológico
- **Tipo de App:** Web PWA (Responsive Mobile-First) para máxima accesibilidad, convertible a Mobile con Capacitor o React Native.
- **Frontend:** React 18 + Tailwind CSS + Lucide Icons + Recharts.
- **Backend (Recomendado):** Supabase (PostgreSQL + Auth + Storage).
  - *Ventajas:* Soporte nativo para suscripciones en tiempo real, autenticación simple y manejo de archivos (videos de ejercicios).
- **IA:** Google Gemini (Generación de rutinas dinámicas basadas en el perfil).
- **Video:** Cloudinary (Streaming adaptativo) o Supabase Storage.

## 2. Modelo de Base de Datos (Relacional - Supabase/PostgreSQL)

### Tabla: `users`
- `id`: uuid (PK)
- `email`: text (unique)
- `full_name`: text
- `fitness_goal`: enum ('lose_fat', 'gain_muscle', 'performance')
- `level`: enum ('beginner', 'intermediate', 'advanced')
- `equipment`: text[] (array de equipos disponibles)
- `streak`: integer (default 0)

### Tabla: `exercises`
- `id`: uuid (PK)
- `name`: text
- `muscle_group`: text
- `video_url`: text
- `technique_desc`: text
- `common_errors`: text[]

### Tabla: `plans`
- `id`: uuid (PK)
- `coach_id`: uuid (FK -> users.id)
- `user_id`: uuid (FK -> users.id)
- `title`: text
- `created_at`: timestamp

### Tabla: `workouts` (Días de entrenamiento dentro de un plan)
- `id`: uuid (PK)
- `plan_id`: uuid (FK)
- `day_number`: integer
- `name`: text (ej. "Empuje A", "Tracción B")

### Tabla: `exercise_logs` (Historial de series)
- `id`: uuid (PK)
- `user_id`: uuid (FK)
- `workout_id`: uuid (FK)
- `exercise_id`: uuid (FK)
- `weight`: numeric
- `reps`: integer
- `rpe`: integer (1-10)
- `created_at`: timestamp

## 3. Flujos Críticos

### Generador Inteligente
El sistema toma el `user_profile` y las `injuries`. Envía un prompt estructurado a Gemini 3 Flash. La respuesta JSON se valida y se guarda como el `current_plan` del usuario.

### Progresión de Cargas (Algoritmo Epley/Brzycki)
El sistema calcula el 1RM estimado en cada serie. Si el usuario completa todas las repeticiones objetivo con un RPE < 8, la próxima sesión del mismo ejercicio sugerirá un incremento de 2.5kg - 5kg automáticamente.

## 4. Visual Design System
- **Fondo:** `#09090b` (Zinc-950)
- **Acento Primario:** `#ea580c` (Orange-600)
- **Acento Secundario:** `#18181b` (Zinc-900 para cards)
- **Tipografía:** Inter (Sans-serif moderna y legible en pantallas pequeñas).
