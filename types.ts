
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
  hasNewUpdate?: boolean;
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
  coachCue?: string; // Instrucción específica del coach para este cliente
}

export interface Workout {
  id: string;
  name: string;
  day: number;
  exercises: WorkoutExercise[];
}

export interface WorkoutLog {
  id: string;
  workoutId: string;
  userId: string;
  date: string;
  rpe: number; // Esfuerzo 1-10
  coachNote?: string; // Comentario del cliente al coach
  setsData: { exerciseId: string, sets: { w: number, r: number }[] }[];
}

export interface Plan {
  id: string;
  title: string;
  userId: string;
  workouts: Workout[];
  coachNotes?: string;
  updatedAt: string;
}

export interface KinetixClass {
  id: string;
  title: string;
  date: string;
  time: string;
  instructor: string;
}
