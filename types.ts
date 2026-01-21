
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
  targetLoad?: string; // Nuevo campo para Peso/Carga
  coachCue?: string;
}

export interface Workout {
  id: string;
  name: string;
  day: number;
  exercises: WorkoutExercise[];
}

export interface SetLog {
  weight: number;
  reps: number;
  done: boolean;
}

export interface WorkoutLog {
  id: string;
  workoutId: string;
  userId: string;
  date: string;
  exercisesData: {
    exerciseId: string;
    sets: SetLog[];
  }[];
}

export interface Plan {
  id: string;
  title: string;
  userId: string;
  workouts: Workout[];
  coachNotes?: string;
  updatedAt: string;
}
