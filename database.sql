-- KINETIX ELITE COMMAND - SUPABASE SCHEMA V1.0

-- 1. EXTENSIONES (Para UUIDs)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. ENUMS (TIPOS DE DATOS PERSONALIZADOS)
CREATE TYPE fitness_goal AS ENUM ('Bajar Grasa', 'Subir Músculo', 'Rendimiento');
CREATE TYPE fitness_level AS ENUM ('Principiante', 'Intermedio', 'Avanzado');
CREATE TYPE user_role AS ENUM ('coach', 'client', 'admin');

-- 3. TABLA DE USUARIOS
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  goal fitness_goal DEFAULT 'Rendimiento',
  level fitness_level DEFAULT 'Avanzado',
  role user_role DEFAULT 'client',
  days_per_week INTEGER DEFAULT 5,
  equipment TEXT[] DEFAULT '{}',
  injuries TEXT,
  streak INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TABLA DE EJERCICIOS (MAESTRO)
CREATE TABLE IF NOT EXISTS exercises (
  id TEXT PRIMARY KEY, -- IDs cortos para compatibilidad con constants.ts
  name TEXT NOT NULL,
  muscle_group TEXT NOT NULL,
  video_url TEXT,
  technique TEXT,
  common_errors TEXT[] DEFAULT '{}'
);

-- 5. TABLA DE PLANES (PROGRAMACIÓN)
CREATE TABLE IF NOT EXISTS plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. TABLA DE ENTRENAMIENTOS (DÍAS DENTRO DE UN PLAN)
CREATE TABLE IF NOT EXISTS workouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id UUID REFERENCES plans(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  day_number INTEGER NOT NULL
);

-- 7. TABLA DE EJERCICIOS POR ENTRENAMIENTO (RELACIÓN)
CREATE TABLE IF NOT EXISTS workout_exercises (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workout_id UUID REFERENCES workouts(id) ON DELETE CASCADE,
  exercise_id TEXT REFERENCES exercises(id) ON DELETE SET NULL,
  target_sets INTEGER DEFAULT 4,
  target_reps TEXT DEFAULT '10-12',
  coach_cue TEXT
);

-- 8. TABLA DE LOGS DE SESIÓN (HISTORIAL)
CREATE TABLE IF NOT EXISTS workout_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  workout_id UUID REFERENCES workouts(id) ON DELETE SET NULL,
  date TIMESTAMPTZ DEFAULT NOW()
);

-- 9. TABLA DE SERIES REGISTRADAS
CREATE TABLE IF NOT EXISTS set_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  log_id UUID REFERENCES workout_logs(id) ON DELETE CASCADE,
  exercise_id TEXT REFERENCES exercises(id) ON DELETE SET NULL,
  weight NUMERIC DEFAULT 0,
  reps INTEGER DEFAULT 0,
  done BOOLEAN DEFAULT FALSE
);

-- 10. INSERCIÓN DE EJERCICIOS INICIALES (BASADO EN constants.ts)
INSERT INTO exercises (id, name, muscle_group, video_url) VALUES
('p1', 'Press horizontal', 'Pecho', 'https://youtu.be/g8oG_jaAxvs'),
('p2', 'Press inclinado', 'Pecho', 'https://youtube.com/shorts/TNmeGZp9ols'),
('c1', 'Sentadilla', 'Cuadriceps', 'https://youtube.com/shorts/oSxJ78WQBZ0'),
('e1', 'Remo suprino', 'Espalda', 'https://youtube.com/shorts/ZFkJocVACns'),
('i1', 'Peso muerto Rumano', 'Isquiotibiales', 'https://youtube.com/shorts/9z6AYqXkBbY'),
('g1', 'Hip thrust', 'Glúteo', 'https://youtube.com/shorts/OK-PC9PVQWQ')
ON CONFLICT (id) DO NOTHING;