import { createClient } from '@supabase/supabase-js';

// Acceso seguro a variables de entorno (compatible con Vite)
const env = (import.meta as any).env || {};
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_ANON_KEY;

// VALORES DE RESPALDO (FALLBACK)
// Si no hay llaves configuradas, usamos una URL ficticia válida para que createClient no lance error.
// Esto permite que la app arranque en modo "Offline" y solo falle al intentar sincronizar,
// en lugar de mostrar una pantalla blanca de error al inicio.
const supabaseUrl = url && url.trim() !== '' ? url : 'https://proyect-placeholder.supabase.co';
const supabaseAnonKey = key && key.trim() !== '' ? key : 'placeholder-key-offline-mode';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);