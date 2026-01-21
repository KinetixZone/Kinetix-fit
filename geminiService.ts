import { GoogleGenAI, Type } from "@google/genai";
import { User } from "./types";

export async function generateSmartRoutine(user: User) {
  const apiKey = process.env.API_KEY;
  
  if (!apiKey) {
    throw new Error("ERROR_CONFIG: Falta la API_KEY en Vercel.");
  }

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `Actúa como Master Coach de Kinetix Functional Zone. Diseña un protocolo de entrenamiento profesional en ESPAÑOL para este atleta:
  - Nombre: ${user.name}
  - Objetivo: ${user.goal}
  - Nivel: ${user.level}
  - Frecuencia: ${user.daysPerWeek} días/semana
  - Equipo: ${user.equipment.join(', ')}
  
  ESTRUCTURA REQUERIDA (JSON):
  {
    "title": "NOMBRE DEL PLAN",
    "workouts": [
      {
        "name": "NOMBRE DE LA SESIÓN",
        "day": 1,
        "exercises": [
          { "exerciseId": "ID", "targetSets": 4, "targetReps": "10-12", "coachCue": "CONSEJO TÉCNICO" }
        ]
      }
    ]
  }

  REGLAS:
  1. Usa solo estos IDs: p1, p2, p3, p4, c1, c2, c3, e1, e2, e3, i1, i2, b1, t1, g1, g2, a1.
  2. Títulos en MAYÚSCULAS.
  3. coachCue máximo 6 palabras.
  4. Devuelve ÚNICAMENTE el JSON puro.`;

  try {
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
  } catch (error) {
    console.error("Gemini Error:", error);
    throw error;
  }
}