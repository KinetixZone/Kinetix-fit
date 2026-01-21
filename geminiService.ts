import { GoogleGenAI, Type } from "@google/genai";
import { User } from "./types";

const getApiKey = () => {
  return (process?.env as any)?.API_KEY || 
         localStorage.getItem('KX_CONF_API_KEY') || 
         '';
};

export async function generateSmartRoutine(user: User) {
  const apiKey = getApiKey();
  
  if (!apiKey) {
    throw new Error("API KEY no detectada en Vercel ni en LocalStorage.");
  }

  // Siempre instanciamos una nueva conexión para asegurar que use la última llave
  const ai = new GoogleGenAI({ apiKey });

  const prompt = `Actúa como Master Coach de Kinetix Functional Zone.
  Diseña un plan funcional para:
  Atleta: ${user.name} | Meta: ${user.goal} | Nivel: ${user.level} | Material: ${user.equipment.join(', ')}
  
  Devuelve UNICAMENTE un JSON válido:
  {
    "title": "NOMBRE DEL PLAN",
    "workouts": [
      {
        "name": "DÍA 1: EMPUJE",
        "day": 1,
        "exercises": [
          { "exerciseId": "p1", "targetSets": 4, "targetReps": "12", "coachCue": "Baja lento" }
        ]
      }
    ]
  }
  Usa exclusivamente estos IDs: p1,p2,p3,p4,c1,c2,c3,e1,e2,e3,i1,i2,b1,t1,g1,g2,f1,a1.`;

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
    if (!text) throw new Error("Respuesta vacía de la IA.");
    return JSON.parse(text);
  } catch (error: any) {
    console.error("Gemini Error:", error);
    if (error.message?.includes("entity was not found")) {
      throw new Error("API Key inválida o modelo no encontrado.");
    }
    throw new Error("Error conectando con el motor de IA.");
  }
}