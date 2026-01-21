import { GoogleGenAI, Type } from "@google/genai";
import { User } from "./types";

export async function generateSmartRoutine(user: User) {
  const apiKey = process.env.API_KEY;
  
  if (!apiKey) {
    throw new Error("No hay API_KEY. Verifica los ajustes de Vercel y haz Redeploy.");
  }

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `Actúa como Master Coach de Kinetix Functional Zone.
  Crea un plan de entrenamiento para:
  Atleta: ${user.name}
  Meta: ${user.goal}
  Nivel: ${user.level}
  Días: ${user.daysPerWeek}
  Material: ${user.equipment.join(', ')}
  
  Estructura JSON (RESPONDE SOLO JSON):
  {
    "title": "NOMBRE DEL PLAN",
    "workouts": [
      {
        "name": "SESIÓN X",
        "day": 1,
        "exercises": [
          { 
            "exerciseId": "USA ESTOS: p1,p2,p3,p4,c1,c2,c3,e1,e2,e3,i1,i2,b1,t1,g1,g2,f1,a1", 
            "targetSets": 4, 
            "targetReps": "12", 
            "coachCue": "Instrucción técnica" 
          }
        ]
      }
    ]
  }

  REGLAS:
  1. Solo usa los IDs de ejercicio permitidos.
  2. No añadas texto fuera del JSON.
  3. Todo en ESPAÑOL.`;

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
  } catch (error: any) {
    console.error("Gemini Error:", error);
    throw new Error("La IA no pudo generar la rutina. Revisa la API KEY en Vercel.");
  }
}