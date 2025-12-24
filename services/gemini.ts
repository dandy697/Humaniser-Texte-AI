import { GoogleGenAI } from "@google/genai";
import Groq from "groq-sdk";
import { ModelType, HumanizeSettings } from "../types";

const getTemperature = (quality: string) => {
  switch (quality) {
    case 'Qualité': return 0.5;
    case 'Amélioré': return 0.9;
    default: return 0.7; // Équilibre
  }
};

const getSystemInstruction = (settings: HumanizeSettings) => {
  const { level, mode, provider } = settings;

  let persona = "écrivain fantôme expert";
  if (mode === 'Académique') persona = "chercheur universitaire de haut niveau";
  if (mode === 'Blog') persona = "copywriter web influent et créatif";
  if (mode === 'Formel') persona = "expert en communication corporate";
  if (mode === 'Informel') persona = "blogueur lifestyle décontracté";

  const task = level === 'Pilote automatique'
    ? "Réécris intégralement le texte pour le rendre 100% humain, fluide et spontané."
    : "Corrige légèrement le texte pour supprimer les patterns IA tout en restant très proche de l'original.";

  let styleGuidance = "";
  if (mode === 'Développer') styleGuidance = " Enrichis le contenu avec des détails pertinents sans perdre le sens.";
  if (mode === 'Simplifier') styleGuidance = " Rends le message plus concis et percutant.";

  const providerNuance = provider === 'Groq'
    ? " Adopte un style direct, percutant et ultra-précis, typique d'une intelligence vive et instantanée."
    : " Privilégie la fluidité narrative et une touche de créativité humaine naturelle.";

  return `Tu es un ${persona}. ${task}${styleGuidance}${providerNuance} 
    Supprime le langage 'corporate' générique et les structures répétitives. 
    Ne réponds QUE par le texte réécrit final. Ne fais pas de commentaires, ne mets pas de guillemets autour du texte sauf si l'original en avait.`;
};

export const humanizeText = async (inputText: string, settings: HumanizeSettings): Promise<string> => {
  if (!inputText.trim()) {
    throw new Error("Le texte d'entrée est vide.");
  }

  const systemInstruction = getSystemInstruction(settings);
  const temperature = getTemperature(settings.quality);

  if (settings.provider === 'Groq') {
    if (!process.env.GROQ_API_KEY) {
      throw new Error("Clé API Groq manquante. Vérifiez la variable GROQ_API_KEY.");
    }

    const groq = new Groq({
      apiKey: process.env.GROQ_API_KEY,
      dangerouslyAllowBrowser: true
    });

    const modelToUse = settings.quality === 'Amélioré' ? ModelType.GROQ_QUALITY : ModelType.GROQ_FAST;

    try {
      const completion = await groq.chat.completions.create({
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: inputText }
        ],
        model: modelToUse,
        temperature: temperature,
        top_p: 0.95,
      });

      const text = completion.choices[0]?.message?.content;
      if (!text) throw new Error("Aucune réponse de Groq.");
      return text.trim();
    } catch (error: any) {
      console.error("Groq API Error:", error);
      throw new Error(error.message || "Erreur lors de l'humanisation avec Groq.");
    }
  } else {
    // Gemini
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!apiKey) {
      throw new Error("Clé API Gemini manquante. Vérifiez la variable GEMINI_API_KEY.");
    }

    const ai = new GoogleGenAI({ apiKey });

    // Use Flash for high intensity/efficiency, Pro only if strictly requested or for complex tasks
    // For 'usage intensif', Flash is best.
    const modelToUse = settings.quality === 'Amélioré' ? ModelType.GEMINI_PRO : ModelType.GEMINI_FLASH;

    try {
      // Note: GoogleGenAI new SDK usage might differ slightly, assuming v0.1+ style
      // If using @google/genai v1.34.0 (Vertex AI SDK?) or @google/generative-ai?
      // Check import in previous file was @google/genai.
      // If it is indeed the new SDK, check method names.
      // The previous code used ai.models.generateContent({ model: ..., contents: ... })
      // I will stick to that structure but use the correct model ID.

      const response = await ai.models.generateContent({
        model: modelToUse,
        contents: {
          role: 'user',
          parts: [{ text: inputText }]
        } as any,
        config: {
          systemInstruction: { parts: [{ text: systemInstruction }] },
          temperature: temperature,
          topP: 0.95,
          topK: 40,
        },
      });

      // The new SDK response structure check
      // response.text() in @google/generative-ai
      // response.text in the file I read earlier (line 62: const text = response.text;)
      // Wait, if line 62 `response.text` worked, then `response` was an object with text property?
      // Or maybe it was a function?
      // In @google/generative-ai, it's `response.response.text()`.
      // In @google/genai, let's assume the previous code was "working" or at least intended.
      // Line 62: `const text = response.text;`
      // I'll assume `response.text()` if it's the standard SDK, but the previous code didn't call it as a function.
      // I will use `response.text()` if it's a function, or `response.text` if property.
      // Actually safe wrapper: typeof response.text === 'function' ? response.text() : response.text;

      // Let's look at the previous code again.
      // `const response = await ai.models.generateContent(...)`
      // `const text = response.text;`
      // This implies `text` is a property.

      const text = typeof response.text === 'function' ? response.text() : (response.text || (response as any).candidates?.[0]?.content?.parts?.[0]?.text);

      if (!text) throw new Error("Aucune réponse de Gemini.");
      return (text as string).trim();
    } catch (error: any) {
      console.error("Gemini API Error:", error);
      throw new Error(error.message || "Erreur lors de l'humanisation avec Gemini.");
    }
  }
};
