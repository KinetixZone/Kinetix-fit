
import { GoogleGenAI, Type } from "@google/genai";
import { User, Exercise } from "../types";

const getApiKey = () => process.env.API_KEY || (import.meta as any).env?.VITE_API_KEY || (import.meta as any).env?.API_KEY;

/**
 * Generador de Rutinas
 */
export async function generateSmartRoutine(user: User) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("ERROR: FALTA API KEY.");

  const ai = new GoogleGenAI({ apiKey: apiKey });

  const systemInstruction = `Eres el Head Coach de Kinetix Functional Zone.
  Tu misión es diseñar protocolos de entrenamiento de élite en formato JSON.
  Debes ser técnico, preciso y motivador en los consejos (coachCue).
  Considera nivel: ${user.level}, meta: ${user.goal} y equipo: ${user.equipment.join(', ')}.
  Prioriza movimientos compuestos y eficiencia de tiempo.`;

  const prompt = `GENERA UN PLAN SEMANAL COMPLETO PARA EL ATLETA: ${user.name.toUpperCase()}.
  DÍAS DISPONIBLES: ${user.daysPerWeek}.
  
  OBLIGATORIO FORMATO JSON PURO CON ESTA ESTRUCTURA EXACTA.`;

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
    throw new Error("NO SE PUDO CONECTAR CON EL COACH IA.");
  }
}

/**
 * Análisis de Progreso (Insights)
 */
export async function analyzeProgress(user: User, history: any[]) {
  const apiKey = getApiKey();
  if (!apiKey) return "Error: No API Key";

  const ai = new GoogleGenAI({ apiKey });
  
  // Resumir historial para no saturar tokens
  const summary = history.slice(0, 5).map(h => ({
    date: h.date,
    workout: h.workoutName,
    volume: h.summary.totalVolume,
    exercises: Object.keys(h.logs).length
  }));

  const prompt = `Analiza el progreso reciente de este atleta:
  Datos: ${JSON.stringify(summary)}
  
  Detecta tendencias: ¿Está subiendo el volumen? ¿Es consistente?
  Dame 3 consejos breves y directos (Bullet points) para mejorar su rendimiento la próxima semana.
  Tono: Coach de alto rendimiento, duro pero justo.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
  });

  return response.text;
}

/**
 * Chatbot Técnico (Dudas rápidas)
 */
export async function getTechnicalAdvice(query: string, contextExercises: Exercise[]) {
  const apiKey = getApiKey();
  if (!apiKey) return "Error de conexión.";

  const ai = new GoogleGenAI({ apiKey });
  
  // Contexto ligero de ejercicios disponibles
  const exercisesList = contextExercises.map(e => e.name).join(", ");

  const systemInstruction = `Eres un experto en biomecánica y entrenador de fuerza.
  Tu objetivo es resolver dudas rápidas del atleta EN EL GIMNASIO.
  Sé conciso (máximo 2 oraciones).
  Si piden sustituciones, sugiere ejercicios de esta lista: ${exercisesList}.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: query,
    config: { systemInstruction }
  });

  return response.text;
}
