import { createClient } from '@supabase/supabase-js';

// Acceso seguro a variables de entorno (compatible con Vite)
const env = (import.meta as any).env || {};
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_ANON_KEY;

// Determinar si estamos en modo offline/placeholder
const isPlaceholder = !url || url.includes('placeholder');

export const supabaseConnectionStatus = {
  isConfigured: !isPlaceholder,
  url: isPlaceholder ? 'Modo Offline (Faltan Keys)' : url
};

// VALORES DE RESPALDO (FALLBACK)
const supabaseUrl = url && url.trim() !== '' ? url : 'https://proyect-placeholder.supabase.co';
const supabaseAnonKey = key && key.trim() !== '' ? key : 'placeholder-key-offline-mode';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);