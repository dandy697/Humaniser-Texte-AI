
import { GoogleGenAI } from "@google/genai";
import Groq from "groq-sdk";

export const config = {
    runtime: 'edge',
};

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Code',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

export default async function handler(req: Request) {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const { text, settings } = await req.json();
        const { provider, quality, level, mode } = settings;

        // --- SECURITY CHECK (Serveur) ---
        // Si Gemini est demandé, on vérifie le code Admin envoyé dans les headers ou body
        if (provider === 'Gemini') {
            const adminCode = req.headers.get('X-Admin-Code');
            const secureCode = process.env.VITE_ADMIN_CODE || process.env.ADMIN_CODE; // Compatibilité

            if (!secureCode) {
                return new Response(JSON.stringify({ error: "Configuration serveur incomplète (Code Admin manquant)." }), { status: 500, headers: corsHeaders });
            }

            if (adminCode !== secureCode) {
                return new Response(JSON.stringify({ error: "🔒 Accès refusé. Code administrateur invalide." }), { status: 403, headers: corsHeaders });
            }
        }

        // --- AI LOGIC (Similaire à l'ancien client mais sécurisé) ---

        // --- PREPARATION DU PROMPT (LOGIQUE INTELLIGENTE) ---

        const bannedWords = "En conclusion, En somme, Par ailleurs, De surcroît, Il est impératif, Il est crucial, Le paysage de, Dans un monde en constante évolution, Favoriser, Optimiser les synergies, En outre, De plus, Il est important de noter";

        // 1. Règle de Longueur (Iso-longueur par défaut)
        let lengthRule = "Garde approximativement le même nombre de mots que le texte original (Iso-longueur). Ne résume pas, ne coupe pas d'informations.";
        if (mode === 'Simplifier') lengthRule = "Synthétise le texte pour le rendre plus court et percutant (-20% de longueur).";
        if (mode === 'Développer') lengthRule = "Développe les idées pour enrichir le texte avec des détails pertinents (+20% de longueur).";

        // 2. Règle de Ton/Mode
        let toneRule = "";
        if (mode === 'Formel' || mode === 'Académique') toneRule = "Garde le vouvoiement et une posture d'expert, mais sois direct.";
        if (mode === 'Informel' || mode === 'Blog') toneRule = "Utilise l'humour, l'ironie légère et le tutoiement si adapté.";

        const systemInstruction = `
Tu es un Ghostwriter expert spécialisé dans la réécriture indétectable.
Ta mission : Humaniser le texte fourni pour qu'il trompe les détecteurs d'IA, tout en respectant scrupuleusement le fond.

RÈGLES CRITIQUES (INTELLIGENCE MÉTIER) :
1.  **PROFESSIONNALISME (VOCABULAIRE)** :
    *   **CONSERVE IMPÉRATIVEMENT** les termes techniques, le jargon métier, les noms propres et le vocabulaire professionnel précis. Ne les "vulgarise" pas.
    *   Humanise uniquement la **structure** des phrases, les **transitions** et le **rythme**.

2.  **LONGUEUR & DENSITÉ** :
    *   ${lengthRule}

3.  **ANTI-DÉTECTION (GHOSTWRITING)** :
    *   **INTERDICTION** d'utiliser le jargon "ChatGPT" (LISTE NOIRE : ${bannedWords}).
    *   **BURSTINESS** : Alterne phrases courtes et longues. Brise la monotonie.
    *   **TON** : ${toneRule}

4.  **FORMATAGE** :
    *   Privilégie les paragraphes denses. Évite les listes à puces excessives.

TA RÉPONSE :
Renvoie UNIQUEMENT le texte réécrit. Pas de "Voici le texte", pas de guillemets. Juste le résultat.
`;

        // Temperature adjustments
        let temperature = 0.9;
        if (quality === 'Qualité') temperature = 0.7; // Balance
        if (quality === 'Amélioré') temperature = 1.0; // Max Humanization


        // --- EXECUTION ---

        if (provider === 'Groq') {
            if (!process.env.GROQ_API_KEY) throw new Error("Clé Groq manquante sur le serveur.");

            const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
            const model = quality === 'Amélioré' ? 'llama-3.3-70b-versatile' : 'llama-3.1-8b-instant';

            const completion = await groq.chat.completions.create({
                messages: [
                    { role: "system", content: systemInstruction },
                    { role: "user", content: text }
                ],
                model: model,
                temperature: temperature,
                top_p: 0.95,
            });

            return new Response(JSON.stringify({ result: completion.choices[0]?.message?.content || "" }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });

        } else {
            // Gemini
            const apiKey = process.env.GEMINI_API_KEY;
            if (!apiKey) throw new Error("Clé Gemini manquante sur le serveur.");

            const ai = new GoogleGenAI({ apiKey });
            const model = quality === 'Amélioré' ? 'gemini-2.5-pro' : 'gemini-2.5-flash-lite';

            const response = await ai.models.generateContent({
                model: model,
                contents: { role: 'user', parts: [{ text: text }] } as any,
                config: {
                    systemInstruction: { parts: [{ text: systemInstruction }] },
                    temperature: temperature,
                    topP: 0.95,
                },
            });

            const resultText = typeof response.text === 'function' ? response.text() : (response.text || (response as any).candidates?.[0]?.content?.parts?.[0]?.text);

            return new Response(JSON.stringify({ result: resultText }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }

    } catch (error: any) {
        console.error("API Error:", error);
        return new Response(JSON.stringify({ error: error.message || "Erreur serveur interne" }), { status: 500, headers: corsHeaders });
    }
}
