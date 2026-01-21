
import { GoogleGenAI, Type } from "@google/genai";
import { User } from "./types";

export async function generateSmartRoutine(user: User) {
  // En Vercel, process.env.API_KEY se inyecta automáticamente
  const apiKey = process.env.API_KEY;
  
  if (!apiKey) {
    throw new Error("API_KEY no configurada. Verifica las variables de entorno en Vercel.");
  }

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `Actúa como Master Coach de Kinetix Functional Zone. Diseña un protocolo de entrenamiento profesional en ESPAÑOL para este atleta:
  - Nombre: ${user.name}
  - Objetivo: ${user.goal}
  - Nivel: ${user.level}
  - Frecuencia: ${user.daysPerWeek} días/semana
  - Equipo: ${user.equipment.join(', ')}
  
  REGLAS:
  1. Usa solo IDs válidos: p1, p2, p3, p4 (Pecho), c1, c2, c3 (Pierna), e1, e2, e3 (Espalda), i1, i2 (Isquios), b1 (Biceps), t1 (Triceps), g1, g2 (Glúteo), a1 (Abdomen).
  2. Títulos en MAYÚSCULAS.
  3. coachCue cortos (máx 5 palabras).
  4. Devuelve ÚNICAMENTE el JSON.`;

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
