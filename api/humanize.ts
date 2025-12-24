
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
        if (mode === 'Académique') persona = "chercheur universitaire";
        if (mode === 'Blog') persona = "rédacteur web senior";
        if (mode === 'Formel') persona = "consultant en communication";
        if (mode === 'Informel') persona = "storyteller passionné";

        const task = level === 'Pilote automatique'
            ? "Réécris COMPLÈTEMENT ce texte. Ton but est de le rendre 100% INDÉTECTABLE par les détecteurs d'IA. Il doit passer pour une production humaine authentique."
            : "Reformule ce texte pour supprimer les marqueurs IA tout en gardant le sens original.";

        let styleGuidance = "";
        if (mode === 'Développer') styleGuidance = " Enrichis le fond avec des nuances humaines, des opinions subtiles ou des illustrations concrètes.";
        if (mode === 'Simplifier') styleGuidance = " Va droit au but, utilise des phrases courtes et percutantes comme un humain pressé.";

        const antiDetectionRules = `
        RÈGLES CRUCIALES POUR ÉVITER LA DÉTECTION IA :
        1. **Perplexité & Burstiness** : Varie radicalement la longueur des phrases. Alterne entre des phrases très courtes (3-5 mots) et des phrases complexes. Brise le rythme monotone.
        2. **Vocabulaire** : Évite absolument les mots de liaison typiques de l'IA (En outre, Par ailleurs, En conclusion, Il est important de noter). Utilise des transitions fluides ou pas de transition du tout.
        3. **Imperfection Humaine** : N'aie pas peur d'utiliser des structures de phrase un peu moins "parfaites" ou scolaires. Utilise le langage actif plutôt que passif.
        4. **Ton** : Sois engagé, subjectif si le contexte le permet. L'IA est neutre, l'humain a une voix.
        `;

        const providerNuance = provider === 'Groq'
            ? " Adopte un style très naturel, presque conversationnel. Ne sois pas robotique ou encyclopédique. Fais comme si tu parlais à quelqu'un."
            : " Privilégie une prose riche, nuancée et élégante, avec une touche d'émotion ou de créativité.";

        const systemInstruction = `Tu es un ${persona}. ${task}
        
${antiDetectionRules}

${styleGuidance}
${providerNuance}

IMPORTANT : Ne réponds QUE par le texte réécrit. Pas de guillemets, pas de "Voici le texte :", juste le résultat.`;

        // Temperature (Higher is better for humanization/randomness)
        let temperature = 0.85; // Default was 0.7
        if (quality === 'Qualité') temperature = 0.7; // More focused but stll human
        if (quality === 'Amélioré') temperature = 1.0; // Max creativity for undetected


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
