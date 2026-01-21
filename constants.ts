
import { Exercise, Goal, UserLevel } from './types';

export const EXERCISES_DB: Exercise[] = [
  // PECHO
  { id: 'p1', name: 'Press horizontal', muscleGroup: 'Pecho', videoUrl: 'https://youtu.be/g8oG_jaAxvs', technique: '', commonErrors: [] },
  { id: 'p2', name: 'Press inclinado', muscleGroup: 'Pecho', videoUrl: 'https://youtube.com/shorts/TNmeGZp9ols', technique: '', commonErrors: [] },
  { id: 'p3', name: 'Peck fly', muscleGroup: 'Pecho', videoUrl: 'https://youtube.com/shorts/xzdkyCWS2f8', technique: '', commonErrors: [] },
  { id: 'p4', name: 'Press sentado', muscleGroup: 'Pecho', videoUrl: 'https://youtube.com/shorts/JXJmPXlqwh0', technique: '', commonErrors: [] },
  { id: 'p5', name: 'Lagartijas', muscleGroup: 'Pecho', videoUrl: 'https://youtube.com/shorts/SKX9JimnGpg', technique: '', commonErrors: [] },
  { id: 'p6', name: 'Cross over', muscleGroup: 'Pecho', videoUrl: 'https://youtube.com/shorts/QEW6RO0O-ak', technique: '', commonErrors: [] },
  { id: 'p7', name: 'Flow press', muscleGroup: 'Pecho', videoUrl: 'https://youtube.com/shorts/JE8fSUgLebY', technique: '', commonErrors: [] },
  { id: 'p8', name: 'Peck deck', muscleGroup: 'Pecho', videoUrl: 'https://youtube.com/shorts/GdoRBGpGkYA', technique: '', commonErrors: [] },

  // CUADRICEPS
  { id: 'c1', name: 'Sentadilla', muscleGroup: 'Cuadriceps', videoUrl: 'https://youtube.com/shorts/oSxJ78WQBZ0', technique: '', commonErrors: [] },
  { id: 'c2', name: 'Hack inclinada', muscleGroup: 'Cuadriceps', videoUrl: 'https://youtube.com/shorts/_K5qW_sENbg', technique: '', commonErrors: [] },
  { id: 'c3', name: 'Leg extensión', muscleGroup: 'Cuadriceps', videoUrl: 'https://youtu.be/4ZDm5EbiFI8', technique: '', commonErrors: [] },
  { id: 'c4', name: 'Abductores', muscleGroup: 'Cuadriceps', videoUrl: 'https://youtube.com/shorts/HkT-b8oVoF4', technique: '', commonErrors: [] },
  { id: 'c5', name: 'Globet squat', muscleGroup: 'Cuadriceps', videoUrl: 'https://youtube.com/shorts/yTDROg8zZsU', technique: '', commonErrors: [] },
  { id: 'c6', name: 'Low squat', muscleGroup: 'Cuadriceps', videoUrl: 'https://youtube.com/shorts/O6kbqhP_tVE', technique: '', commonErrors: [] },
  { id: 'c7', name: 'Front squats', muscleGroup: 'Cuadriceps', videoUrl: 'https://youtu.be/Q1Ypb8ZNzI4', technique: '', commonErrors: [] },
  { id: 'c8', name: 'Prensa', muscleGroup: 'Cuadriceps', videoUrl: 'https://youtube.com/shorts/CZrG20G5B1g', technique: '', commonErrors: [] },

  // ESPALDA
  { id: 'e1', name: 'Remo suprino', muscleGroup: 'Espalda', videoUrl: 'https://youtube.com/shorts/ZFkJocVACns', technique: '', commonErrors: [] },
  { id: 'e2', name: 'Remo prono', muscleGroup: 'Espalda', videoUrl: 'https://youtu.be/sOij1orUmbk', technique: '', commonErrors: [] },
  { id: 'e3', name: 'Remo T', muscleGroup: 'Espalda', videoUrl: 'https://youtube.com/shorts/iusvKOl99qw', technique: '', commonErrors: [] },
  { id: 'e4', name: 'Jalón abierto', muscleGroup: 'Espalda', videoUrl: 'https://youtube.com/shorts/RD4t94XvKsU', technique: '', commonErrors: [] },
  { id: 'e5', name: 'Jalón cerrado', muscleGroup: 'Espalda', videoUrl: 'https://youtube.com/shorts/Ks3yr_wl8WU', technique: '', commonErrors: [] },
  { id: 'e6', name: 'Remo inclinado', muscleGroup: 'Espalda', videoUrl: 'https://youtube.com/shorts/9u5yLR9zmAs', technique: '', commonErrors: [] },
  { id: 'e7', name: 'Pull over', muscleGroup: 'Espalda', videoUrl: 'https://youtube.com/shorts/QNCHZFa1zU8', technique: '', commonErrors: [] },

  // ISQUIOS
  { id: 'i1', name: 'Peso muerto Rumano', muscleGroup: 'Isquiotibiales', videoUrl: 'https://youtube.com/shorts/9z6AYqXkBbY', technique: '', commonErrors: [] },
  { id: 'i2', name: 'Femoral acostado', muscleGroup: 'Isquiotibiales', videoUrl: 'https://youtube.com/shorts/Tz1XM1y1aEQ', technique: '', commonErrors: [] },
  { id: 'i3', name: 'Femoral sentado', muscleGroup: 'Isquiotibiales', videoUrl: 'https://youtube.com/shorts/oc8SshREFi0', technique: '', commonErrors: [] },
  { id: 'i4', name: 'Curl femoral', muscleGroup: 'Isquiotibiales', videoUrl: 'https://youtu.be/F_SEiWLbMGY', technique: '', commonErrors: [] },

  // BRAZOS
  { id: 'b1', name: 'Predicador', muscleGroup: 'Biceps', videoUrl: 'https://youtube.com/shorts/ShWdDYEfgoU', technique: '', commonErrors: [] },
  { id: 'b2', name: 'Curl suprino', muscleGroup: 'Biceps', videoUrl: 'https://youtube.com/shorts/XynAms-XSqs', technique: '', commonErrors: [] },
  { id: 'b3', name: 'Curl martillo', muscleGroup: 'Biceps', videoUrl: 'https://youtube.com/shorts/1pTUHKXGaSs', technique: '', commonErrors: [] },
  { id: 't1', name: 'Extensión de cuerda', muscleGroup: 'Triceps', videoUrl: 'https://youtube.com/shorts/JVc1KAB_HLY', technique: '', commonErrors: [] },
  { id: 't2', name: 'Fondos', muscleGroup: 'Triceps', videoUrl: 'https://youtube.com/shorts/GOPjlaRVxcU', technique: '', commonErrors: [] },
  { id: 't3', name: 'Press frances', muscleGroup: 'Triceps', videoUrl: 'https://youtube.com/shorts/tU8nos4EoDQ', technique: '', commonErrors: [] },

  // GLÚTEO
  { id: 'g1', name: 'Hip thrust', muscleGroup: 'Glúteo', videoUrl: 'https://youtube.com/shorts/OK-PC9PVQWQ', technique: '', commonErrors: [] },
  { id: 'g2', name: 'Patada para glúteo', muscleGroup: 'Glúteo', videoUrl: 'https://youtu.be/h4yLoQWOxAw', technique: '', commonErrors: [] },
  { id: 'g3', name: 'Desplante bulgaro', muscleGroup: 'Glúteo', videoUrl: 'https://youtube.com/shorts/ODjwvOitOo0', technique: '', commonErrors: [] },

  // FUNCIONALES / CORE
  { id: 'f1', name: 'Burpees', muscleGroup: 'Funcionales', videoUrl: 'https://youtube.com/shorts/EkK3oVBA__Q', technique: '', commonErrors: [] },
  { id: 'a1', name: 'Crunch', muscleGroup: 'Abdomen', videoUrl: 'https://youtu.be/9VopAXZSZDA', technique: '', commonErrors: [] },
  { id: 'a2', name: 'V-ups', muscleGroup: 'Abdomen', videoUrl: 'https://youtu.be/iP2fjvG0g3w', technique: '', commonErrors: [] },
  { id: 'a3', name: 'Plancha baja', muscleGroup: 'Isométricos', videoUrl: 'https://youtube.com/shorts/3AM7L2k7BEw', technique: '', commonErrors: [] }
];

export const MOCK_USER = {
  id: 'u-1',
  name: 'ATLETA KINETIX',
  email: 'atleta@kinetix.com',
  goal: Goal.PERFORMANCE,
  level: UserLevel.ADVANCED,
  role: 'client' as const,
  // Fixed typo: corrected daysPer_week to daysPerWeek to match User interface definition
  daysPerWeek: 5,
  equipment: ['Full Box'],
  streak: 7,
  createdAt: new Date().toISOString()
};
