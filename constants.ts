
import { Exercise, Goal, UserLevel } from './types';

export const EXERCISES_DB: Exercise[] = [
  // PECHO
  { id: 'p1', name: 'Press horizontal', muscleGroup: 'Pecho', videoUrl: 'https://youtu.be/g8oG_jaAxvs', technique: 'Empuje horizontal con barra o mancuernas.', commonErrors: ['Arquear demasiado la espalda', 'Bajar muy rápido'] },
  { id: 'p2', name: 'Press inclinado', muscleGroup: 'Pecho', videoUrl: 'https://youtube.com/shorts/TNmeGZp9ols', technique: 'Enfoque en la parte superior del pectoral.', commonErrors: ['Rebotar la barra', 'Codos muy abiertos'] },
  { id: 'p3', name: 'Peck fly', muscleGroup: 'Pecho', videoUrl: 'https://youtube.com/shorts/xzdkyCWS2f8', technique: 'Aperturas en máquina o cables.', commonErrors: ['Juntar las manos con excesiva fuerza'] },
  { id: 'p4', name: 'Press sentado', muscleGroup: 'Pecho', videoUrl: 'https://youtube.com/shorts/JXJmPXlqwh0', technique: 'Press en máquina asistida.', commonErrors: ['Rango de movimiento incompleto'] },
  
  // CUADRICEPS
  { id: 'c1', name: 'Sentadilla', muscleGroup: 'Cuadriceps', videoUrl: 'https://youtube.com/shorts/oSxJ78WQBZ0', technique: 'Flexión de rodilla y cadera con peso.', commonErrors: ['Rodillas hacia adentro (valgo)'] },
  { id: 'c2', name: 'Leg extensión', muscleGroup: 'Cuadriceps', videoUrl: 'https://youtu.be/4ZDm5EbiFI8', technique: 'Extensión de pierna sentado.', commonErrors: ['Levantar los glúteos del asiento'] },
  { id: 'c3', name: 'Prensa', muscleGroup: 'Cuadriceps', videoUrl: 'https://youtube.com/shorts/CZrG20G5B1g', technique: 'Empuje de plataforma con piernas.', commonErrors: ['Bloquear rodillas al extender'] },
  
  // ESPALDA
  { id: 'e1', name: 'Jalón abierto', muscleGroup: 'Espalda', videoUrl: 'https://youtube.com/shorts/RD4t94XvKsU', technique: 'Tracción vertical hacia el pecho.', commonErrors: ['Balancear el torso', 'No retraer escápulas'] },
  { id: 'e2', name: 'Remo inclinado', muscleGroup: 'Espalda', videoUrl: 'https://youtube.com/shorts/9u5yLR9zmAs', technique: 'Tracción horizontal con barra o mancuerna.', commonErrors: ['Encoger hombros', 'Cerrar el pecho'] },
  { id: 'e3', name: 'Pull over', muscleGroup: 'Espalda', videoUrl: 'https://youtube.com/shorts/QNCHZFa1zU8', technique: 'Extensión de hombro con brazos semi-rectos.', commonErrors: ['Flexionar demasiado los codos'] },

  // ISQUIOS
  { id: 'i1', name: 'Peso muerto Rumano', muscleGroup: 'Isquiotibiales', videoUrl: 'https://youtube.com/shorts/9z6AYqXkBbY', technique: 'Bisagra de cadera manteniendo piernas semi-rectas.', commonErrors: ['Encorvar la espalda'] },
  { id: 'i2', name: 'Femoral sentado', muscleGroup: 'Isquiotibiales', videoUrl: 'https://youtube.com/shorts/oc8SshREFi0', technique: 'Flexión de pierna en máquina.', commonErrors: ['Movimientos bruscos'] },

  // BICEPS / TRICEPS
  { id: 'b1', name: 'Curl suprino', muscleGroup: 'Biceps', videoUrl: 'https://youtube.com/shorts/XynAms-XSqs', technique: 'Flexión de codo con palmas arriba.', commonErrors: ['Usar el hombro para subir'] },
  { id: 't1', name: 'Extensión de cuerda', muscleGroup: 'Triceps', videoUrl: 'https://youtube.com/shorts/JVc1KAB_HLY', technique: 'Extensión de codo en polea alta.', commonErrors: ['Separar los codos del cuerpo'] },

  // GLÚTEO
  { id: 'g1', name: 'Hip thrust', muscleGroup: 'Glúteo', videoUrl: 'https://youtube.com/shorts/OK-PC9PVQWQ', technique: 'Empuje de cadera con espalda apoyada.', commonErrors: ['No extender cadera completamente'] },
  { id: 'g2', name: 'Desplante bulgaro', muscleGroup: 'Glúteo/Pierna', videoUrl: 'https://youtube.com/shorts/ODjwvOitOo0', technique: 'Sentadilla a una pierna con pie trasero elevado.', commonErrors: ['Inclinación excesiva sin control'] },

  // FUNCIONALES / ABDOMEN
  { id: 'f1', name: 'Jumping Jacks', muscleGroup: 'Funcionales', videoUrl: 'https://youtu.be/Omk6XKk6BKk', technique: 'Salto abriendo brazos y piernas.', commonErrors: ['Caer con los pies planos'] },
  { id: 'a1', name: 'Crunch', muscleGroup: 'Abdomen', videoUrl: 'https://youtu.be/9VopAXZSZDA', technique: 'Flexión abdominal controlada.', commonErrors: ['Tirar del cuello con las manos'] }
];

// Actualizado para cumplir con la interfaz User
export const MOCK_USER = {
  id: 'u1',
  name: 'Alex Guerrero',
  email: 'alex@example.com',
  goal: Goal.GAIN_MUSCLE,
  level: UserLevel.INTERMEDIATE,
  role: 'client' as const,
  daysPerWeek: 4,
  equipment: ['Barra', 'Mancuernas', 'Bancos', 'Poleas'],
  streak: 5,
  createdAt: new Date().toISOString()
};
