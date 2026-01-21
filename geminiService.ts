
import { GoogleGenAI, Type } from "@google/genai";
import { User, Goal, UserLevel } from "./types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function generateSmartRoutine(user: User) {
  const prompt = `Como Master Coach de Kinetix Functional Zone, genera un protocolo de entrenamiento profesional en ESPAÑOL para:
  - Atleta: ${user.name}
  - Objetivo: ${user.goal}
  - Nivel: ${user.level}
  - Frecuencia: ${user.daysPerWeek} sesiones semanales
  - Equipamiento: ${user.equipment.join(', ')}
  
  REQUISITOS TÉCNICOS:
  1. Títulos de los Workouts deben ser impactantes (ej: "Protocolo A: Fuerza Explosiva").
  2. Instrucciones de Coach (coachCue) cortas y centradas en la técnica (ej: "Foco en la fase excéntrica").
  3. Usa SOLO estos IDs de ejercicios: p1, p2, p3, p4 (Pecho), c1, c2, c3 (Pierna), e1, e2, e3 (Espalda), i1, i2 (Isquios), b1 (Biceps), t1 (Triceps), g1, g2 (Glúteo), a1 (Abdomen).
  4. Formato de repeticiones puede ser rango (ej: "8-12") o fijo.
  
  Responde con un JSON puro que siga estrictamente este esquema.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          workouts: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                day: { type: Type.NUMBER },
                exercises: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      exerciseId: { type: Type.STRING },
                      targetSets: { type: Type.NUMBER },
                      targetReps: { type: Type.STRING },
                      coachCue: { type: Type.STRING }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  });

  return JSON.parse(response.text);
}
