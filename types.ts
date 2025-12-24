
export interface GenerationState {
  isLoading: boolean;
  progress: number;
  error: string | null;
  result: string | null;
}

export enum ModelType {
  GEMINI_FLASH = 'gemini-2.5-flash-lite',
  GEMINI_PRO = 'gemini-2.5-pro',
  GROQ_FAST = 'llama-3.1-8b-instant',
  GROQ_QUALITY = 'llama-3.3-70b-versatile'
}

export type AIProvider = 'Gemini' | 'Groq';
export type HumanizeLevel = 'Basique' | 'Pilote automatique';
export type HumanizeQuality = 'Qualité' | 'Équilibre' | 'Amélioré';
export type HumanizeMode = 'Général' | 'Académique' | 'Blog' | 'Formel' | 'Informel' | 'Développer' | 'Simplifier';


export interface HumanizeSettings {
  level: HumanizeLevel;
  quality: HumanizeQuality;
  mode: HumanizeMode;
  provider: AIProvider;
}

// Limites journalières strictes pour l'offre gratuite (Dec 2025 - Données Utilisateur)
// Gemini: Très restreint sur le plan gratuit (20 req/jour pour Flash/Pro)
// Groq: Très généreux (14,400 req/jour pour Llama 3.1 8B)
export const API_LIMITS = {
  [ModelType.GEMINI_FLASH]: 20,
  [ModelType.GEMINI_PRO]: 5, // Souvent inaccessible, garde-fou bas
  [ModelType.GROQ_FAST]: 14400, // Llama 3.1 8B Instant (Usage Intensif)
  [ModelType.GROQ_QUALITY]: 1000 // Llama 3.3 70B Versatile
};
