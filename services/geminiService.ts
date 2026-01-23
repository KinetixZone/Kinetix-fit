
import { GoogleGenAI, Type } from "@google/genai";
import { User, Exercise } from "../types";

/**
 * Helper: Extraer contexto de fuerza del historial
 */
const getStrengthContext = (history: any[]) => {
  if (!history || history.length === 0) return "No hay historial previo. Asume cargas moderadas.";
  
  // Tomamos las últimas 5 sesiones para ver pesos recientes
  const recentSessions = history.slice(0, 5);
  let contextStr = "HISTORIAL RECIENTE DE FUERZA:\n";
  
  recentSessions.forEach(session => {
    // Buscamos el peso máximo levantado en esa sesión
    let maxWeight = 0;
    if (session.logs) {
      Object.values(session.logs).forEach((sets: any) => {
        sets.forEach((s: any) => {
          const w = parseFloat(s.weight);
          if (w > maxWeight) maxWeight = w;
        });
      });
    }
    if (maxWeight > 0) {
      contextStr += `- En rutina "${session.workoutName}": Llegó a mover ${maxWeight}kg.\n`;
    }
  });
  
  return contextStr;
};

/**
 * Generador de Rutinas
 */
export async function generateSmartRoutine(user: User, history: any[] = []) {
  // Correct initialization: new GoogleGenAI({ apiKey: process.env.API_KEY }) directly.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const strengthContext = getStrengthContext(history);

  const systemInstruction = `Eres el Head Coach de Kinetix Functional Zone.
  Tu misión es diseñar protocolos de entrenamiento de élite en formato JSON.
  Debes ser técnico, preciso y motivador en los consejos (coachCue).
  Considera nivel: ${user.level}, meta: ${user.goal} y equipo: ${user.equipment.join(', ')}.
  Prioriza movimientos compuestos y eficiencia de tiempo.
  IMPORTANTE: Usa el historial de fuerza provisto para sugerir cargas (targetLoad) realistas (RPE 7-8).`;

  const prompt = `GENERA UN PLAN SEMANAL COMPLETO PARA EL ATLETA: ${user.name.toUpperCase()}.
  DÍAS DISPONIBLES: ${user.daysPerWeek}.
  
  ${strengthContext}
  
  Si hay historial, calcula el 'targetLoad' aproximado para los compuestos principales.
  OBLIGATORIO FORMATO JSON PURO CON ESTA ESTRUCTURA EXACTA.`;

  try {
    // Using gemini-3-flash-preview for general generation
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
                        targetLoad: { type: Type.STRING, description: "Peso sugerido en kg (ej: '80')" },
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

    // Extract text directly using .text property
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
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
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
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
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
