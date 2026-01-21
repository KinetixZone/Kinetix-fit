
import { GoogleGenAI, Type } from "@google/genai";
import { User } from "../types";

/**
 * Kinetix Intelligent Coaching V12.1
 * Diseñado para generar protocolos técnicos de alto rendimiento.
 */
export async function generateSmartRoutine(user: User) {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

  const systemInstruction = `Eres el Head Coach de Kinetix Functional Zone.
  Tu misión es diseñar protocolos de entrenamiento de élite en formato JSON.
  Debes ser técnico, preciso y motivador en los consejos (coachCue).
  Considera nivel: ${user.level}, meta: ${user.goal} y equipo: ${user.equipment.join(', ')}.
  Prioriza movimientos compuestos y eficiencia de tiempo.`;

  const prompt = `GENERA UN PLAN SEMANAL COMPLETO PARA EL ATLETA: ${user.name.toUpperCase()}.
  DÍAS DISPONIBLES: ${user.daysPerWeek}.
  
  OBLIGATORIO FORMATO JSON PURO:
  {
    "title": "NOMBRE DEL PLAN",
    "workouts": [
      {
        "id": "w_random",
        "name": "DÍA 1: ENFOQUE TÉCNICO",
        "day": 1,
        "exercises": [
          { 
            "exerciseId": "id_local", 
            "name": "Nombre del Ejercicio", 
            "targetSets": 4, 
            "targetReps": "10-12", 
            "coachCue": "Instrucción técnica breve" 
          }
        ]
      }
    ]
  }`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        systemInstruction,
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
                  id: { type: Type.STRING },
                  name: { type: Type.STRING },
                  day: { type: Type.NUMBER },
                  exercises: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        exerciseId: { type: Type.STRING },
                        name: { type: Type.STRING },
                        targetSets: { type: Type.NUMBER },
                        targetReps: { type: Type.STRING },
                        coachCue: { type: Type.STRING }
                      }
                    }
                  }
                }
              }
            }
          },
          required: ["title", "workouts"]
        }
      },
    });

    return JSON.parse(response.text || '{}');
  } catch (error: any) {
    console.error("AI Generation Error:", error);
    if (error.status === 429) {
      throw new Error("EL COACH ESTÁ OCUPADO. REINTENTA EN 60 SEGUNDOS.");
    }
    throw new Error("NO SE PUDO CONECTAR CON EL COACH IA.");
  }
}
