import { Exercise, Goal, UserLevel, Plan } from './types';

export const EXERCISES_DB: Exercise[] = [
  // --- PECHO ---
  { id: 'pec1', name: 'Press horizontal', muscleGroup: 'Pecho', videoUrl: 'https://youtu.be/g8oG_jaAxvs?si=ymgMP-_XlUqbZ3TH', technique: '', commonErrors: [] },
  { id: 'pec2', name: 'Press inclinado', muscleGroup: 'Pecho', videoUrl: 'https://youtube.com/shorts/TNmeGZp9ols?si=k1mafvxCM_8ff2K3', technique: '', commonErrors: [] },
  { id: 'pec3', name: 'Peck fly', muscleGroup: 'Pecho', videoUrl: 'https://youtube.com/shorts/xzdkyCWS2f8?si=gehQjzT6jbuoWP38', technique: '', commonErrors: [] },
  { id: 'pec4', name: 'Press sentado', muscleGroup: 'Pecho', videoUrl: 'https://youtube.com/shorts/JXJmPXlqwh0?si=oNTpPEKVOY70JIga', technique: '', commonErrors: [] },
  { id: 'pec5', name: 'Lagartijas', muscleGroup: 'Pecho', videoUrl: 'https://youtube.com/shorts/SKX9JimnGpg?si=9RoUL8CQrt4SOX6h', technique: '', commonErrors: [] },
  { id: 'pec6', name: 'Cross over', muscleGroup: 'Pecho', videoUrl: 'https://youtube.com/shorts/QEW6RO0O-ak?si=TscKmpKwbfMD6qVk', technique: '', commonErrors: [] },
  { id: 'pec7', name: 'Flow press', muscleGroup: 'Pecho', videoUrl: 'https://youtube.com/shorts/JE8fSUgLebY?si=7kJL14kZ0EW1cyPR', technique: '', commonErrors: [] },
  { id: 'pec8', name: 'Peck deck', muscleGroup: 'Pecho', videoUrl: 'https://youtube.com/shorts/GdoRBGpGkYA?si=sab2rofmF3TU7dIg', technique: '', commonErrors: [] },

  // --- CUADRICEPS ---
  { id: 'cua1', name: 'Sentadilla', muscleGroup: 'Cuadriceps', videoUrl: 'https://youtube.com/shorts/oSxJ78WQBZ0?si=GQP3M0V-w-LFXlXZ', technique: '', commonErrors: [] },
  { id: 'cua2', name: 'Hack inclinada', muscleGroup: 'Cuadriceps', videoUrl: 'https://youtube.com/shorts/_K5qW_sENbg?si=RBo1iV9-3kVdQIIO', technique: '', commonErrors: [] },
  { id: 'cua3', name: 'Leg extensión', muscleGroup: 'Cuadriceps', videoUrl: 'https://youtu.be/4ZDm5EbiFI8?si=CO1NoZnVXiTjsoo0', technique: '', commonErrors: [] },
  { id: 'cua4', name: 'Abductores', muscleGroup: 'Cuadriceps', videoUrl: 'https://youtube.com/shorts/HkT-b8oVoF4?si=5VZOnSnAqBpLa2m_', technique: '', commonErrors: [] },
  { id: 'cua5', name: 'Globet squat', muscleGroup: 'Cuadriceps', videoUrl: 'https://youtube.com/shorts/yTDROg8zZsU?si=rcvKpx7tNuH2LrjC', technique: '', commonErrors: [] },
  { id: 'cua6', name: 'Low squat', muscleGroup: 'Cuadriceps', videoUrl: 'https://youtube.com/shorts/O6kbqhP_tVE?si=0arF8SGdF4aj4gCm', technique: '', commonErrors: [] },
  { id: 'cua7', name: 'Front squats', muscleGroup: 'Cuadriceps', videoUrl: 'https://youtu.be/Q1Ypb8ZNzI4?si=cL7135el1GIvX3_j', technique: '', commonErrors: [] },
  { id: 'cua8', name: 'Heels squats', muscleGroup: 'Cuadriceps', videoUrl: 'https://youtube.com/shorts/79E_U4zY7gI?si=16HC9STsZRzNKJwb', technique: '', commonErrors: [] },
  { id: 'cua9', name: 'Steep up', muscleGroup: 'Cuadriceps', videoUrl: 'https://youtube.com/shorts/mw6iqu9K8DY?si=K_Xu-3xVsB0seUBL', technique: '', commonErrors: [] },
  { id: 'cua10', name: 'Prensa', muscleGroup: 'Cuadriceps', videoUrl: 'https://youtube.com/shorts/CZrG20G5B1g?si=jalpioPkL_AtWHso', technique: '', commonErrors: [] },

  // --- ESPALDA ---
  { id: 'esp1', name: 'Remo suprino', muscleGroup: 'Espalda', videoUrl: 'https://youtube.com/shorts/ZFkJocVACns?si=bukuYi7OtmPPDCTj', technique: '', commonErrors: [] },
  { id: 'esp2', name: 'Remo prono', muscleGroup: 'Espalda', videoUrl: 'https://youtu.be/sOij1orUmbk?si=a1sXZqJvoPqK-FhG', technique: '', commonErrors: [] },
  { id: 'esp3', name: 'Remo T', muscleGroup: 'Espalda', videoUrl: 'https://youtube.com/shorts/iusvKOl99qw?si=kRIl1It2_DMTyuNF', technique: '', commonErrors: [] },
  { id: 'esp4', name: 'Jalón abierto', muscleGroup: 'Espalda', videoUrl: 'https://youtube.com/shorts/RD4t94XvKsU?si=vl4V4ns1X8wDWi7J', technique: '', commonErrors: [] },
  { id: 'esp5', name: 'Jalón cerrado', muscleGroup: 'Espalda', videoUrl: 'https://youtube.com/shorts/Ks3yr_wl8WU?si=eilaLUFNwpvUh5w7', technique: '', commonErrors: [] },
  { id: 'esp6', name: 'Remo maquina', muscleGroup: 'Espalda', videoUrl: 'https://youtube.com/shorts/4o8scFhoDdE?si=BBoPiM9wKL8nvP1C', technique: '', commonErrors: [] },
  { id: 'esp7', name: 'Remo inclinado', muscleGroup: 'Espalda', videoUrl: 'https://youtube.com/shorts/9u5yLR9zmAs?si=DZHKyWnvSvKuHn9b', technique: '', commonErrors: [] },
  { id: 'esp8', name: 'Pull over', muscleGroup: 'Espalda', videoUrl: 'https://youtube.com/shorts/QNCHZFa1zU8?si=QOvnvJc1Bjpjfr3h', technique: '', commonErrors: [] },
  { id: 'esp9', name: 'Jalón cruzado', muscleGroup: 'Espalda', videoUrl: 'https://youtu.be/G7vnN9SuW4c?si=xalIXxvFQIdOi0st', technique: '', commonErrors: [] },

  // --- ISQUIOTIBIALES ---
  { id: 'isq1', name: 'Peso muerto Rumano', muscleGroup: 'Isquiotibiales', videoUrl: 'https://youtube.com/shorts/9z6AYqXkBbY?si=iZgw0BHjmIKFMxIu', technique: '', commonErrors: [] },
  { id: 'isq2', name: 'Peso muerto Convencional', muscleGroup: 'Isquiotibiales', videoUrl: 'https://youtube.com/shorts/rzpikhhtwwA?si=jqKzOAzgZ8ultTNO', technique: '', commonErrors: [] },
  { id: 'isq3', name: 'Diferentes pesos muertos', muscleGroup: 'Isquiotibiales', videoUrl: 'https://youtube.com/shorts/5kYMN400cOs?si=OtJSPJ7bgrv5-WSz', technique: '', commonErrors: [] },
  { id: 'isq4', name: 'Femoral acostado', muscleGroup: 'Isquiotibiales', videoUrl: 'https://youtube.com/shorts/Tz1XM1y1aEQ?si=SqK6sI-h07FMGTCG', technique: '', commonErrors: [] },
  { id: 'isq5', name: 'Femoral sentado', muscleGroup: 'Isquiotibiales', videoUrl: 'https://youtube.com/shorts/oc8SshREFi0?si=z0klzYNet5Tl19gM', technique: '', commonErrors: [] },
  { id: 'isq6', name: 'Peso muerto cuerda', muscleGroup: 'Isquiotibiales', videoUrl: 'https://youtube.com/shorts/cd2A4tYBLDs?si=cwQE2keI09kA79ls', technique: '', commonErrors: [] },
  { id: 'isq7', name: 'Kang squats', muscleGroup: 'Isquiotibiales', videoUrl: 'https://youtube.com/shorts/3vkdME1JZEY?si=yQ31mh2ZfUFx_wtz', technique: '', commonErrors: [] },
  { id: 'isq8', name: 'Curl femoral', muscleGroup: 'Isquiotibiales', videoUrl: 'https://youtu.be/F_SEiWLbMGY?si=_NFNUq8w7l5bUHwz', technique: '', commonErrors: [] },

  // --- BICEPS ---
  { id: 'bic1', name: 'Predicador', muscleGroup: 'Biceps', videoUrl: 'https://youtube.com/shorts/ShWdDYEfgoU?si=zrJCabe0t_WU9HP9', technique: '', commonErrors: [] },
  { id: 'bic2', name: 'Curl suprino', muscleGroup: 'Biceps', videoUrl: 'https://youtube.com/shorts/XynAms-XSqs?si=NTFvHMnnMENckYeY', technique: '', commonErrors: [] },
  { id: 'bic3', name: 'Curl hércules', muscleGroup: 'Biceps', videoUrl: 'https://youtube.com/shorts/_x80qv0h3Xs?si=UNMdgCA92sRRFUdk', technique: '', commonErrors: [] },
  { id: 'bic4', name: 'Curl cuerda', muscleGroup: 'Biceps', videoUrl: 'https://youtube.com/shorts/KiyMFeMg04o?si=HuVL7BUlgShAU-V3', technique: '', commonErrors: [] },
  { id: 'bic5', name: 'Curl martillo', muscleGroup: 'Biceps', videoUrl: 'https://youtube.com/shorts/1pTUHKXGaSs?si=QHCLnT5kNBYIQ85n', technique: '', commonErrors: [] },

  // --- TRICEPS ---
  { id: 'tri1', name: 'Extensión de cuerda', muscleGroup: 'Triceps', videoUrl: 'https://youtube.com/shorts/JVc1KAB_HLY?si=8sVXyezDRUtnjVDX', technique: '', commonErrors: [] },
  { id: 'tri2', name: 'Extensión de triangulo', muscleGroup: 'Triceps', videoUrl: 'https://youtube.com/shorts/3Iu8DikX1Pk?si=We9Bp6RlUCaKYRbc', technique: '', commonErrors: [] },
  { id: 'tri3', name: 'Fondos', muscleGroup: 'Triceps', videoUrl: 'https://youtube.com/shorts/GOPjlaRVxcU?si=ew1gaKPRpvLgFvgE', technique: '', commonErrors: [] },
  { id: 'tri4', name: 'Press frances', muscleGroup: 'Triceps', videoUrl: 'https://youtube.com/shorts/tU8nos4EoDQ?si=nBEx7Rwaf-RKBame', technique: '', commonErrors: [] },
  { id: 'tri5', name: 'Press copa', muscleGroup: 'Triceps', videoUrl: 'https://youtube.com/shorts/m4MHwioXgw0?si=wao3-OoPtjYgVnK3', technique: '', commonErrors: [] },
  { id: 'tri6', name: 'Extensión suprina', muscleGroup: 'Triceps', videoUrl: 'https://youtube.com/shorts/0Hd9taS4QEs?si=HUndqKqtw75anft3', technique: '', commonErrors: [] },

  // --- HOMBRO ---
  { id: 'hom1', name: 'Press militar', muscleGroup: 'Hombro', videoUrl: 'https://youtube.com/shorts/0ph4dQ4GOI4?si=aAqdYrWYNuY4T0Sr', technique: '', commonErrors: [] },
  { id: 'hom2', name: 'Press smith', muscleGroup: 'Hombro', videoUrl: 'https://youtube.com/shorts/qVx9Sxz0PPc?si=ImGNFvI3YTTkCbcd', technique: '', commonErrors: [] },
  { id: 'hom3', name: 'Elevación lateral', muscleGroup: 'Hombro', videoUrl: 'https://youtube.com/shorts/vwfaFckD1JI?si=JP_WjrUF4SVQbZts', technique: '', commonErrors: [] },
  { id: 'hom4', name: 'Elevación frontal', muscleGroup: 'Hombro', videoUrl: 'https://youtube.com/shorts/jk7YrK79ciA?si=cuyF59bt_jHrtsCb', technique: '', commonErrors: [] },
  { id: 'hom5', name: 'Elevación neutra', muscleGroup: 'Hombro', videoUrl: 'https://youtube.com/shorts/TUaZYRyAV1k?si=bfT6Ds4JP6smdBqB', technique: '', commonErrors: [] },
  { id: 'hom6', name: 'Face pull', muscleGroup: 'Hombro', videoUrl: 'https://youtube.com/shorts/Lz9rWJfGaQA?si=TCPXZn2LPz49nLJP', technique: '', commonErrors: [] },
  { id: 'hom7', name: 'Elevación posterior', muscleGroup: 'Hombro', videoUrl: 'https://youtube.com/shorts/nO-JNf2b3s8?si=5odeLGpzfeY4dkL_', technique: '', commonErrors: [] },
  { id: 'hom8', name: 'Arnold press', muscleGroup: 'Hombro', videoUrl: 'https://youtube.com/shorts/llERM60yGZc?si=BDuaDwNkpsI3AfAH', technique: '', commonErrors: [] },

  // --- GLÚTEO ---
  { id: 'glu1', name: 'Hip thrus', muscleGroup: 'Glúteo', videoUrl: 'https://youtube.com/shorts/OK-PC9PVQWQ?si=BVAi8noSR3MdYhLS', technique: '', commonErrors: [] },
  { id: 'glu2', name: 'Extensión de cadera', muscleGroup: 'Glúteo', videoUrl: 'https://youtube.com/shorts/K0oRgljazZc?si=GxU7WSKGpymsvoFZ', technique: '', commonErrors: [] },
  { id: 'glu3', name: 'Patada para glúteo', muscleGroup: 'Glúteo', videoUrl: 'https://youtu.be/h4yLoQWOxAw?si=LL7rL9MnRTm9u53V', technique: '', commonErrors: [] },
  { id: 'glu4', name: 'Patada cable', muscleGroup: 'Glúteo', videoUrl: 'https://youtube.com/shorts/mbW5uKoLrRo?si=f-7Tw371Fn6WHgQI', technique: '', commonErrors: [] },
  { id: 'glu5', name: 'Desplante bulgaro', muscleGroup: 'Glúteo', videoUrl: 'https://youtube.com/shorts/ODjwvOitOo0?si=PujSjXsS4VN2WC3m', technique: '', commonErrors: [] },
  { id: 'glu6', name: 'Desplantes', muscleGroup: 'Glúteo', videoUrl: 'https://youtube.com/shorts/h8T5Bx0d0fk?si=EB-w3zaZV8F2Iwl9', technique: '', commonErrors: [] },

  // --- PANTORRILLA ---
  { id: 'pan1', name: 'Costurera', muscleGroup: 'Pantorrilla', videoUrl: 'https://youtube.com/shorts/jeGHLQoKfPk?si=G7lH_NgR1CWEE3KX', technique: '', commonErrors: [] },
  { id: 'pan2', name: 'Elevación de talón', muscleGroup: 'Pantorrilla', videoUrl: 'https://youtube.com/shorts/JhDqNv2DoAU?si=fD5fUHJpwVR2s0Pu', technique: '', commonErrors: [] },

  // --- FUNCIONALES ---
  { id: 'fun1', name: 'Oleajes', muscleGroup: 'Funcionales', videoUrl: 'https://youtube.com/shorts/2DxpsLjRwZI?si=362yY_Vy2tN5TsIz', technique: '', commonErrors: [] },
  { id: 'fun2', name: 'Swing', muscleGroup: 'Funcionales', videoUrl: 'https://youtube.com/shorts/ROAhRv5x-Ow?si=B-2TCElUrZMsRMaN', technique: '', commonErrors: [] },
  { id: 'fun3', name: 'Shoulder tap', muscleGroup: 'Funcionales', videoUrl: 'https://youtube.com/shorts/J9QSqLq4L6U?si=_g5ziS-Mc0CXFfzJ', technique: '', commonErrors: [] },
  { id: 'fun4', name: 'Escaladores', muscleGroup: 'Funcionales', videoUrl: 'https://youtube.com/shorts/V0UoH5TG6fo?si=yJCQduYnA1MCvYOs', technique: '', commonErrors: [] },
  { id: 'fun5', name: 'Jumping Jacks', muscleGroup: 'Funcionales', videoUrl: 'https://youtu.be/Omk6XKk-BZg?si=PsqRWdeJqSp9Hti0', technique: '', commonErrors: [] },
  { id: 'fun6', name: 'Burpees', muscleGroup: 'Funcionales', videoUrl: 'https://youtube.com/shorts/EkK3oVBA__Q?si=_aaScPjJPih7Dp4c', technique: '', commonErrors: [] },

  // --- ABDOMEN ---
  { id: 'abd1', name: 'Crunch', muscleGroup: 'Abdomen', videoUrl: 'https://youtu.be/9VopAXZSZDA?si=-xZ7GCjf1O1FuyPh', technique: '', commonErrors: [] },
  { id: 'abd2', name: 'V-ups', muscleGroup: 'Abdomen', videoUrl: 'https://youtu.be/iP2fjvG0g3w?si=lMIUWpgdoO1xKRMS', technique: '', commonErrors: [] },
  { id: 'abd3', name: 'Pallof press', muscleGroup: 'Abdomen', videoUrl: 'https://youtu.be/o_CxFP4FJhA?si=OM_OseO0R5YFD1yf', technique: '', commonErrors: [] },
  { id: 'abd4', name: 'Giro en polea', muscleGroup: 'Abdomen', videoUrl: 'https://youtube.com/shorts/FM7sTCeyOrk?si=MIiQ7kAf2xpe0Asv', technique: '', commonErrors: [] },
  { id: 'abd5', name: 'Giro ruso', muscleGroup: 'Abdomen', videoUrl: 'https://youtube.com/shorts/CqvohZl3rFo?si=W88vl3a2KhPz4b_E', technique: '', commonErrors: [] },
  { id: 'abd6', name: 'Elevación de pies', muscleGroup: 'Abdomen', videoUrl: 'https://youtube.com/shorts/6NA99YASwd8?si=B0kFzFzdWogifUco', technique: '', commonErrors: [] },
  { id: 'abd7', name: 'Crunch pelota', muscleGroup: 'Abdomen', videoUrl: 'https://youtu.be/_Bw3j1ckBpo?si=z7-IEl_NrjecADiT', technique: '', commonErrors: [] },
  { id: 'abd8', name: 'Extensión pelota', muscleGroup: 'Abdomen', videoUrl: 'https://youtube.com/shorts/q_iz2BBnRSI?si=wBO8qoLAfNOx4oBw', technique: '', commonErrors: [] },
  { id: 'abd9', name: 'Circuito trx (abdomen)', muscleGroup: 'Abdomen', videoUrl: 'https://youtube.com/shorts/1ItKDquJcEU?si=v-8VY9EwNPZHF_6V', technique: '', commonErrors: [] },
  { id: 'abd10', name: 'Circuito abdomen', muscleGroup: 'Abdomen', videoUrl: 'https://youtube.com/shorts/3rAc5JfScUI?si=BUDVau8zw8czhsqx', technique: '', commonErrors: [] },

  // --- ISOMETRICOS ---
  { id: 'iso1', name: 'Plancha baja', muscleGroup: 'Isométricos', videoUrl: 'https://youtube.com/shorts/3AM7L2k7BEw?si=vEbQE6-xEuzwHEdQ', technique: '', commonErrors: [] },
  { id: 'iso2', name: 'Sentadilla isometrica', muscleGroup: 'Isométricos', videoUrl: 'https://youtube.com/shorts/Hx99A39dEMU?si=WHb1RoGc5h9oRGW5', technique: '', commonErrors: [] },
  { id: 'iso3', name: 'Barquito isometrico', muscleGroup: 'Isométricos', videoUrl: 'https://youtube.com/shorts/lJoKi3-XYuw?si=IOLEJ4DGqawF40Xj', technique: '', commonErrors: [] }
];

export const INITIAL_TEMPLATES: Plan[] = [
    {
        id: 'tpl-1',
        title: 'Full Body - Básico',
        userId: 'TEMPLATE',
        updatedAt: new Date().toISOString(),
        workouts: [
            {
                id: 'w-1',
                name: 'Cuerpo Completo A',
                day: 1,
                exercises: [
                    { exerciseId: 'cua1', name: 'Sentadilla', targetSets: 4, targetReps: '12', targetRest: 90, method: 'standard', videoUrl: 'https://youtube.com/shorts/oSxJ78WQBZ0' },
                    { exerciseId: 'pec1', name: 'Press horizontal', targetSets: 4, targetReps: '12', targetRest: 90, method: 'standard', videoUrl: 'https://youtu.be/g8oG_jaAxvs' },
                    { exerciseId: 'esp4', name: 'Jalón abierto', targetSets: 4, targetReps: '12', targetRest: 60, method: 'standard', videoUrl: 'https://youtube.com/shorts/RD4t94XvKsU' },
                    { exerciseId: 'abd1', name: 'Crunch', targetSets: 3, targetReps: '15', targetRest: 60, method: 'standard', videoUrl: 'https://youtu.be/9VopAXZSZDA' }
                ]
            },
            {
                id: 'w-2',
                name: 'Cuerpo Completo B',
                day: 3,
                exercises: [
                    { exerciseId: 'isq1', name: 'Peso muerto Rumano', targetSets: 4, targetReps: '10', targetRest: 90, method: 'standard', videoUrl: 'https://youtube.com/shorts/9z6AYqXkBbY' },
                    { exerciseId: 'hom1', name: 'Press militar', targetSets: 4, targetReps: '12', targetRest: 90, method: 'standard', videoUrl: 'https://youtube.com/shorts/0ph4dQ4GOI4' },
                    { exerciseId: 'esp1', name: 'Remo suprino', targetSets: 4, targetReps: '12', targetRest: 60, method: 'standard', videoUrl: 'https://youtube.com/shorts/ZFkJocVACns' },
                    { exerciseId: 'iso1', name: 'Plancha baja', targetSets: 3, targetReps: '45s', targetRest: 60, method: 'standard', videoUrl: 'https://youtube.com/shorts/3AM7L2k7BEw' }
                ]
            }
        ]
    }
];

export const MOCK_USER = {
  id: '00000000-0000-0000-0000-000000000001', 
  name: 'ATLETA KINETIX',
  email: 'atleta@kinetix.com',
  goal: Goal.PERFORMANCE,
  level: UserLevel.ADVANCED,
  role: 'client' as const,
  daysPerWeek: 5,
  equipment: ['Full Box'],
  streak: 7,
  createdAt: new Date().toISOString()
};