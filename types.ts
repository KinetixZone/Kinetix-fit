
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

export type TrainingMethod = 'standard' | 'biserie' | 'ahap' | 'dropset' | 'tabata' | 'emom';

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

// --- CONFIGURACIONES AVANZADAS ---

export interface TabataConfig {
  workTimeSec: number;
  restTimeSec: number;
  rounds: number;
  sets: number;
  restBetweenSetsSec: number;
  structure: 'simple' | 'alternado' | 'lista';
  exercises: { id: string; name: string; videoUrl?: string }[]; 
}

export interface EmomConfig {
  durationMin: number;
  type: 'simple' | 'alternado' | 'complejo';
  // Simple
  simpleConfig?: { exercise: string; reps?: string; durationSec?: number };
  // Alternado
  minuteOdd?: { exercise: string; reps?: string; durationSec?: number };
  minuteEven?: { exercise: string; reps?: string; durationSec?: number };
  // Complejo
  blocks?: { minutes: number[]; exercise: string; reps?: string; durationSec?: number }[];
}

export interface WorkoutExercise {
  exerciseId: string;
  name: string;
  targetSets: number;
  targetReps: string;
  targetLoad?: string;
  targetRest?: number;
  coachCue?: string;
  videoUrl?: string;
  method?: TrainingMethod;
  
  // CAMPOS OPCIONALES PARA MÉTODOS AVANZADOS (SAFE MODE)
  
  // Para BISERIE
  pair?: {
    exerciseId: string;
    name: string;
    targetReps: string;
    targetLoad?: string;
    videoUrl?: string;
  };

  // Para AHAP
  targetWeights?: string[];

  // Para DROP SET
  dropsetPatternMode?: 'FIXED' | 'PER_SERIES'; 
  drops?: { weight: string; reps: string }[]; 
  dropsetSeriesPatterns?: { [setIndex: number]: { weight: string; reps: string }[] };

  // Para TABATA (Nuevo)
  tabataConfig?: TabataConfig;

  // Para EMOM (Nuevo)
  emomConfig?: EmomConfig;
}

export interface Workout {
  id: string;
  name: string;
  day: number;
  exercises: WorkoutExercise[];
  isCompleted?: boolean;
  isClass?: boolean;
  classType?: string;
  scheduledDate?: string; // ISO 8601 YYYY-MM-DD
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

// --- UI SCHEMA GENERATION TYPES (FASE 1) ---

export interface SchemaField {
  name: string;
  type: 'number' | 'string' | 'textarea' | 'object';
  label: string;
  optional: boolean;
  min?: number;
  max?: number;
  step?: number;
  helpText?: string;
  constraints?: { oneOf?: string[] };
}

export interface BlockSchema {
  blockId: string; // exerciseId en el contexto actual
  method: string;
  title: string;
  editableFields: SchemaField[];
  exercises?: { // Específico para BISERIE/Complex
    exerciseId: string;
    fields: SchemaField[];
  }[];
}

export interface OverrideSchemaResponse {
  status: 'OK' | 'ERROR';
  templateId: string;
  athleteId: string;
  uiSchemaVersion: number;
  blocks: BlockSchema[];
  issues: string[];
}
