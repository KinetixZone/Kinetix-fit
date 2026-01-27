import { GoogleGenAI, Type } from "@google/genai";
import { User, Exercise, Plan, OverrideSchemaResponse } from "../types";

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
 * Generador de UI Schema para Edición (Fase 1)
 * Genera un esquema determinista de campos editables por método.
 */
export async function generateEditionSchema(template: Plan, athlete: User): Promise<OverrideSchemaResponse> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    // Definición estricta del Prompt Maestro
    const systemInstruction = `# Kinetix-fit — UI Schema de edición por método (Fase 1, sin mutaciones)

Eres un asistente especializado en generar un **UI Schema determinista** para formularios de edición de overrides por bloque de entrenamiento. 
NO debes modificar plantillas maestras, métodos, orden, estructura ni ejercicios. 
NO devuelvas prosa, ni explicaciones fuera del JSON. 
Tu única salida es UN bloque JSON válido.

## Objetivo
Dada una **Plantilla Maestra** y los datos del **atleta**, debes devolver un **UI Schema** que describa EXCLUSIVAMENTE los **campos editables** por bloque, de acuerdo con su **método**. 
Este schema lo usará el frontend para construir inputs de overrides (los overrides se guardan por atleta, nunca en la plantilla).

## Reglas inmutables (obligatorias)
- No cambies: **method, estructura, orden de bloques ni lista de ejercicios**.
- La **Plantilla Maestra** es inmutable.
- No generes valores ni edites datos de la plantilla; solo describe inputs editables.
- No compartas overrides entre atletas; el schema es para la **asignación** actual.
- Si el bloque no tiene 'id' o su 'method' no está en la lista soportada, responde con status:"ERROR" y explica el motivo en issues[].

## Campos permitidos por método (únicos aceptados)
- FUERZA: loadKg, reps, sets, rest_sec, tempo (opcional), notes
- AHAP: loadKg, reps, rest_sec, rounds (opcional), targetReps (opcional), notes
- BISERIE: byExercise → { [exerciseId]: { loadKg?, reps?, rest_sec?, notes? } }
- DROPSET: initialLoadKg, dropPercent | dropKg, reps, rest_sec, notes  (dropPercent y dropKg son mutuamente excluyentes)
- TABATA: work_time_sec, rest_time_sec, rounds, sets, rest_between_sets_sec
- EMOM: reps | duration_sec (por minuto/bloque), duration_min (opcional), notes

## Reglas específicas por método (UI)
- FUERZA: incluir loadKg (step 0.5, min 0), reps (min 1), sets (min 1), rest_sec (min 0); tempo y notes como opcionales.
- AHAP: incluir loadKg (step 0.5, min 0), reps (min 1), rest_sec (min 0), y opcionales rounds/targetReps; notes opcional.
- BISERIE: NUNCA agregues/elimines ejercicios.
- DROPSET: dropPercent y dropKg son mutuamente excluyentes (constraints.oneOf).
- TABATA: work_time_sec (min 5), rest_time_sec (min 0), rounds (min 1), sets (min 1 opcional).
- EMOM: permitir reps o duration_sec; duration_min es opcional.

Validaciones mínimas:
Verifica que template.id y athlete.id existan.
Verifica cada block.id y method.`;

    const cleanTemplate = {
        id: template.id,
        name: template.title,
        blocks: template.workouts.flatMap(w => w.exercises.map(ex => ({
            id: ex.exerciseId, // Using exerciseId as block ID for this context
            method: (ex.method || 'standard').toUpperCase().replace('STANDARD', 'FUERZA'), // Mapping standard to FUERZA for the prompt
            name: ex.name,
            // Include pair info for Biserie logic
            pair: ex.pair ? { id: ex.pair.exerciseId, name: ex.pair.name } : undefined
        })))
    };

    const cleanAthlete = {
        id: athlete.id,
        name: athlete.name
    };

    const prompt = JSON.stringify({ template: cleanTemplate, athlete: cleanAthlete });

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
                systemInstruction,
                responseMimeType: "application/json"
            }
        });

        return JSON.parse(response.text || '{}');
    } catch (error) {
        console.error("Schema Generation Error:", error);
        return {
            status: 'ERROR',
            templateId: template.id,
            athleteId: athlete.id,
            uiSchemaVersion: 1,
            blocks: [],
            issues: ['Connection failure with AI']
        };
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