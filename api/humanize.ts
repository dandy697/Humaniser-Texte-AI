
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

        // System Instruction Construction
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

        const systemInstruction = `Tu es un ${persona}. ${task}${styleGuidance}${providerNuance} 
      Supprime le langage 'corporate' générique et les structures répétitives. 
      Ne réponds QUE par le texte réécrit final. Ne fais pas de commentaires, ne mets pas de guillemets autour du texte sauf si l'original en avait.`;

        // Temperature
        let temperature = 0.7;
        if (quality === 'Qualité') temperature = 0.5;
        if (quality === 'Amélioré') temperature = 0.9;


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
