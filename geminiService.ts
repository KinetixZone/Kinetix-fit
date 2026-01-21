
import { GoogleGenAI, Type } from "@google/genai";
import { User } from "./types";

/**
 * Kinetix Intelligent Engine (KIE) v4
 * Genera rutinas de alto rendimiento basadas en biometría y equipamiento disponible.
 */
export async function generateSmartRoutine(user: User) {
  // Uso estricto de process.env.API_KEY de Vercel
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

  const systemInstruction = `Eres el Head Coach de Kinetix Functional Zone. 
  Tu estilo es técnico, motivacional y orientado a resultados de élite. 
  Diseñas planes que optimizan el volumen de carga semanal. 
  Solo respondes en JSON puro, sin explicaciones.`;

  const prompt = `DISEÑA PROTOCOLO DE ENTRENAMIENTO PARA:
  ATLETA: ${user.name} | NIVEL: ${user.level} | META: ${user.goal}
  DÍAS DISPONIBLES: ${user.daysPerWeek} | EQUIPO: ${user.equipment.join(', ')}

  REQUISITOS DEL PROTOCOLO:
  1. Estructura lógica A/B/C...
  2. Enfoque en progresión de cargas.
  3. Cues técnicas breves y agresivas para cada ejercicio.
  4. Usa IDs estándar (p1, c1, e1, i1, b1, g1, f1, a1) o nombres descriptivos.

  ESQUEMA JSON OBLIGATORIO:
  {
    "title": "NOMBRE DEL PROGRAMA (Ej: KINETIX X-TREME v4)",
    "workouts": [
      {
        "id": "w1",
        "name": "DÍA 1: ENFOQUE FUERZA",
        "day": 1,
        "exercises": [
          { 
            "exerciseId": "p1", 
            "name": "Press Plano", 
            "targetSets": 4, 
            "targetReps": "8-10", 
            "coachCue": "Explota en el empuje, controla 3s la bajada" 
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
            title: {
              type: Type.STRING,
              description: 'Nombre épico del programa.',
            },
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
                      },
                      required: ["exerciseId", "targetSets", "targetReps"]
                    }
                  }
                },
                required: ["id", "name", "day", "exercises"]
              }
            }
          },
          required: ["title", "workouts"],
          propertyOrdering: ["title", "workouts"],
        }
      },
    });

    // Directly access the .text property (SDK Rule)
    const jsonStr = response.text?.trim() || '{}';
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("Kinetix AI Failure:", error);
    throw new Error("El motor Kinetix AI no respondió satisfactoriamente. Verifica la API_KEY.");
  }
}
