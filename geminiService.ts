import { GoogleGenAI, Type } from "@google/genai";
import { User } from "./types";

const getApiKey = () => {
  return (process?.env as any)?.API_KEY || 
         (window as any)?.process?.env?.API_KEY || 
         localStorage.getItem('KX_BACKUP_API_KEY') || 
         '';
};

export async function generateSmartRoutine(user: User) {
  const apiKey = getApiKey();
  
  if (!apiKey) {
    throw new Error("No se detectó la API_KEY. Por favor, usa el panel de configuración.");
  }

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `Actúa como Master Coach de Kinetix Functional Zone.
  Crea un plan para: Atleta: ${user.name}, Meta: ${user.goal}, Nivel: ${user.level}, Material: ${user.equipment.join(', ')}.
  
  JSON Requerido:
  {
    "title": "NOMBRE DEL PLAN",
    "workouts": [
      {
        "name": "SESIÓN X",
        "day": 1,
        "exercises": [
          { "exerciseId": "p1", "targetSets": 4, "targetReps": "12", "coachCue": "Instrucción" }
        ]
      }
    ]
  }
  Usa solo IDs: p1,p2,p3,p4,c1,c2,c3,e1,e2,e3,i1,i2,b1,t1,g1,g2,f1,a1.`;

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
    throw new Error("Error en el motor de IA. Revisa tu API Key.");
  }
}