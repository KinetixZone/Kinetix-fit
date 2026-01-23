
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

export interface SystemConfig {
  appName: string;
  logoUrl: string;
  themeColor: string;
  ai: {
      chatbot: {
          enabled: boolean;
      }
  }
}

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
  isActive?: boolean;
  accessUntil?: string; // Fecha de vencimiento (YYYY-MM-DD)
  coachId?: string;
}

export interface Exercise {
  id: string;
  name: string;
  muscleGroup: string;
  videoUrl: string;
  technique: string;
  commonErrors: string[];
  imageUrl?: string; // Soporte para imágenes externas
}

export interface WorkoutExercise {
  exerciseId: string;
  name: string;
  targetSets: number;
  targetReps: string;
  targetLoad?: string; // Puede ser "50" o "50,60,70" para series ascendentes
  targetRest?: number;
  coachCue?: string;
  supersetId?: string; // Para agrupar ejercicios
}

export interface Workout {
  id: string;
  name: string;
  day: number;
  date?: string; // Fecha específica (YYYY-MM-DD)
  isClass?: boolean;
  classType?: string;
  exercises: WorkoutExercise[];
  isCompleted?: boolean;
}

export interface SetEntry {
  setNumber: number;
  weight: string;
  reps: string;
  rpe?: number;
  completed: boolean;
  timestamp: number;
}

export interface WorkoutProgress {
  [exerciseIndex: number]: SetEntry[];
}

export interface SessionSummary {
  exercisesCompleted: number;
  totalVolume: number;
  durationMinutes: number;
  prCount: number;
}

export interface Plan {
  id: string;
  title: string;
  userId: string;
  workouts: Workout[];
  coachNotes?: string;
  updatedAt: string;
}

export interface ChatMessage {
    role: 'user' | 'ai';
    text: string;
    timestamp: number;
}

export interface RoutineTemplate {
  id: string;
  title: string;
  workouts: Workout[];
  createdBy: string;
}
