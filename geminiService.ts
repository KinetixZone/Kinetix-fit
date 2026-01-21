import { GoogleGenAI, Type } from "@google/genai";
import { User } from "./types";

export async function generateSmartRoutine(user: User) {
  const apiKey = process.env.API_KEY;
  
  if (!apiKey) {
    throw new Error("API_KEY_MISSING: La llave de Gemini no está configurada en el entorno.");
  }

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `Actúa como Master Coach de Kinetix. Diseña un plan de entrenamiento profesional en ESPAÑOL:
  Atleta: ${user.name}
  Objetivo: ${user.goal}
  Nivel: ${user.level}
  Días: ${user.daysPerWeek}
  Equipo: ${user.equipment.join(', ')}
  
  Devuelve un JSON con esta estructura exacta:
  {
    "title": "NOMBRE DEL PLAN",
    "workouts": [
      {
        "name": "NOMBRE SESIÓN",
        "day": 1,
        "exercises": [
          { "exerciseId": "ID", "targetSets": 4, "targetReps": "10-12", "coachCue": "Frase corta técnica" }
        ]
      }
    ]
  }

  IDs VÁLIDOS: p1, p2, p3, p4, c1, c2, c3, e1, e2, e3, i1, i2, b1, t1, g1, g2, f1, a1.
  Reglas: Títulos en MAYÚSCULAS, coachCue breve. Solo JSON.`;

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

    const text = response.text;
    if (!text) throw new Error("La IA no devolvió contenido.");
    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini Error:", error);
    throw error;
  }
}