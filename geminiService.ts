
import { GoogleGenAI, Type } from "@google/genai";
import { User } from "./types";

/**
 * Kinetix Performance Engine V12
 * IA optimizada para protocolos de entrenamiento técnico.
 */
export async function generateSmartRoutine(user: User) {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

  const systemInstruction = `Eres el Head Coach de Kinetix Functional Zone.
  Tu misión es diseñar protocolos de entrenamiento de élite en formato JSON.
  Considera nivel: ${user.level}, meta: ${user.goal} y equipo: ${user.equipment.join(', ')}.
  Sé agresivo en la selección de ejercicios pero seguro técnicamente.`;

  const prompt = `DISEÑA UN PROGRAMA SEMANAL COMPLETO PARA EL ATLETA: ${user.name.toUpperCase()}.
  DÍAS POR SEMANA: ${user.daysPerWeek}.
  
  FORMATO JSON REQUERIDO (OBLIGATORIO):
  {
    "title": "NOMBRE DEL PROGRAMA",
    "workouts": [
      {
        "id": "w1",
        "name": "DÍA 1: ENFOQUE TÉCNICO",
        "day": 1,
        "exercises": [
          { 
            "exerciseId": "id_local", 
            "name": "Nombre Ejercicio", 
            "targetSets": 4, 
            "targetReps": "10-12", 
            "coachCue": "Instrucción corta de ejecución" 
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

    const text = response.text || '{}';
    return JSON.parse(text);
  } catch (error: any) {
    console.error("AI Engine Failure:", error);
    
    if (error.status === 429 || error.message?.includes('429')) {
      throw new Error("LÍMITE DE CONSULTAS ALCANZADO. REINTENTA EN 60 SEGUNDOS.");
    }
    
    throw new Error("EL COACH IA NO ESTÁ DISPONIBLE. REINTENTA EN UN MOMENTO.");
  }
}
