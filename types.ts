
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

export type TrainingMethod = 'standard' | 'biserie' | 'ahap' | 'dropset';

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
  coachId?: string;
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
  targetLoad?: string;
  targetRest?: number;
  coachCue?: string;
  method?: TrainingMethod;
  
  // CAMPOS OPCIONALES PARA MÉTODOS AVANZADOS (SAFE MODE)
  
  // Para BISERIE: El segundo ejercicio se guarda aquí
  pair?: {
    exerciseId: string; // ID del catálogo
    name: string;
    targetReps: string;
    targetLoad?: string;
  };

  // Para AHAP: Lista de pesos específicos por serie (ej: ["10", "12", "15", "20"])
  targetWeights?: string[];

  // Para DROP SET: Configuración de drops (ej: "10kg x 10 -> 5kg x 10")
  drops?: { weight: string; reps: string }[];
}

export interface Workout {
  id: string;
  name: string;
  day: number;
  exercises: WorkoutExercise[];
  isCompleted?: boolean;
  isClass?: boolean;
  classType?: string;
}

export interface SetEntry {
  setNumber: number;
  weight: string;
  reps: string;
  completed: boolean;
  timestamp: number;
}

export interface WorkoutProgress {
  [exerciseIndex: number]: SetEntry[];
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
