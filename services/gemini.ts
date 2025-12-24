import { HumanizeSettings } from "../types";

export const humanizeText = async (inputText: string, settings: HumanizeSettings, adminCode?: string): Promise<string> => {
  if (!inputText.trim()) {
    throw new Error("Le texte d'entrée est vide.");
  }

  // En mode sécurisé, on appelle notre propre API Vercel
  // L'URL relative '/api/humanize' fonctionnera sur Vercel et avec 'vercel dev'
  const response = await fetch('/api/humanize', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // On envoie le code admin dans les headers s'il est présent
      ...(adminCode ? { 'X-Admin-Code': adminCode } : {})
    },
    body: JSON.stringify({
      text: inputText,
      settings: settings
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Erreur lors de la génération (Serveur)");
  }

  return data.result;
};
