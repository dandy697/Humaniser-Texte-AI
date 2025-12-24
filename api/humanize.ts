
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

        // --- PREPARATION DU PROMPT (User Provided "Ultimate Prompt") ---

        const bannedWords = "En conclusion, En somme, Par ailleurs, De surcroît, Il est impératif, Il est crucial, Le paysage de, Dans un monde en constante évolution, Favoriser, Optimiser les synergies, En outre, De plus, Il est important de noter";

        const modeInstruction = mode ? `Le mode demandé est : ${mode}.` : "";

        const systemInstruction = `
Tu es un Ghostwriter expert spécialisé dans la réécriture indétectable.
Ta mission : Réécrire le texte fourni pour qu'il trompe tous les détecteurs d'IA (GPTZero, Turnitin).

RÈGLES ABSOLUES DE RÉÉCRITURE :
1.  **HUMANISATION RADICALE :** Le texte ne doit pas ressembler à une traduction ou à un rapport. Il doit avoir une "voix".
2.  **VOCABULAIRE :** Interdiction d'utiliser le jargon "ChatGPT" (LISTE NOIRE : ${bannedWords}). Utilise des mots simples, directs et imagés.
3.  **STRUCTURE (BURSTINESS) :** Brise la monotonie. Mélange des phrases de 3 mots avec des phrases de 25 mots. Adopte un rythme irrégulier.
4.  **TON :**
    ${mode === 'Formel' || mode === 'Académique' ? '* Garde le vouvoiement mais sois direct (comme un e-mail de PDG, pas une thèse).' : ''}
    ${mode === 'Informel' || mode === 'Blog' ? '* Utilise l\'humour, l\'ironie légère et le tutoiement si adapté.' : ''}
    ${modeInstruction}
5.  **FORMATAGE :** N'utilise pas de listes à puces sauf si c'est absolument nécessaire. L'IA abuse des listes ; l'humain écrit des paragraphes.

**CRITIQUE (LONGUEUR) :**
- **Tu dois conserver la même longueur approximative que le texte original (Miroir Déformant).** Ne résume pas. Ne coupe pas d'informations.

TA RÉPONSE :
Renvoie UNIQUEMENT le texte réécrit. Pas de guillemets, pas de phrase d'intro.
`;

        // Temperature adjustments as requested (High entropy for humanization)
        let temperature = 0.9;
        if (quality === 'Qualité') temperature = 0.8; // Slightly more focused
        if (quality === 'Amélioré') temperature = 1.0; // Maximum unpredictability


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
