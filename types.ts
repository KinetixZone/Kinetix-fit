
export enum Goal {
  LOSE_FAT = 'Bajar Grasa',
  GAIN_MUSCLE = 'Subir Músculo',
  PERFORMANCE = 'Rendimiento'
}

export enum UserLevel {
  BEGINNER = 'Principiante',
  INTERMEDIATE = 'Intermedio',
  ADVANCED = 'Avanzado'
}

export type UserRole = 'coach' | 'client' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  goal: Goal;
  level: UserLevel;
  role: UserRole;
  daysPerWeek: number;
  equipment: string[];
  injuries?: string;
  streak: number;
  createdAt: string;
}

export interface Exercise {
  id: string;
  name: string;
  muscleGroup: string;
  videoUrl: string;
  technique: string;
  commonErrors: string[];
}

export interface WorkoutExercise {
  exerciseId: string;
  name: string;
  targetSets: number;
  targetReps: string;
  targetLoad?: string; // Peso sugerido por el coach
  targetRest?: number; // Descanso sugerido en segundos
  coachCue?: string; // Notas del coach
}

export interface Workout {
  id: string;
  name: string;
  day: number;
  exercises: WorkoutExercise[];
}

export interface SetEntry {
  setNumber: number;
  weight: string; // Peso real levantado
  reps: string;   // Reps reales
  rpe?: number;   // Rate of Perceived Exertion (1-10)
  completed: boolean;
  timestamp: number;
}

// Estructura optimizada para persistencia local rápida
export interface WorkoutProgress {
  [exerciseIndex: number]: SetEntry[];
}

export interface SessionSummary {
  exercisesCompleted: number;
  totalVolume: number;
  durationMinutes: number;
  prCount: number; // Récords personales rotos
}

export interface Plan {
  id: string;
  title: string;
  userId: string;
  workouts: Workout[];
  coachNotes?: string;
  updatedAt: string;
}
