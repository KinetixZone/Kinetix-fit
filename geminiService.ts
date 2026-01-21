import { GoogleGenAI, Type } from "@google/genai";
import { User } from "./types";

export async function generateSmartRoutine(user: User) {
  // En navegadores, process.env puede fallar si no hay un bundler.
  // Intentamos obtener la llave de forma segura.
  let apiKey = '';
  try {
    apiKey = (process?.env as any)?.API_KEY || '';
  } catch (e) {
    console.warn("No se pudo leer process.env directamente.");
  }
  
  if (!apiKey) {
    throw new Error("No se detectó la API_KEY en el entorno. Asegúrate de haber hecho Redeploy en Vercel.");
  }

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `Actúa como Master Coach de Kinetix Functional Zone.
  Diseña un plan de entrenamiento para:
  Atleta: ${user.name}
  Objetivo: ${user.goal}
  Nivel: ${user.level}
  Días: ${user.daysPerWeek}
  Material: ${user.equipment.join(', ')}
  
  Devuelve un JSON estrictamente válido con:
  {
    "title": "NOMBRE DEL PLAN",
    "workouts": [
      {
        "name": "SESIÓN X",
        "day": 1,
        "exercises": [
          { "exerciseId": "p1", "targetSets": 4, "targetReps": "12", "coachCue": "Instrucción técnica" }
        ]
      }
    ]
  }
  Usa solo estos IDs: p1,p2,p3,p4,c1,c2,c3,e1,e2,e3,i1,i2,b1,t1,g1,g2,f1,a1.`;

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
    throw new Error("Error al conectar con la IA de Google.");
  }
}