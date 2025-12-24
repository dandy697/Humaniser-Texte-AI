
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
        STRATÉGIE ANTI-DÉTECTION AVANCÉE (CLÉ POUR L'HUMANISATION) :
        1. **Chaos Structurel** : Ne fais JAMAIS deux phrases de même structure à la suite. Mélange questions rhétoriques, phrases très courtes (Sujet-Verbe), et phrases longues avec incises.
        2. **Connecteurs Invisibles** : Bannis "De plus", "Par contre", "En effet". Remplace par des liens logiques implicites ou des expressions orales ("D'ailleurs", "Franchement", "Cela dit").
        3. **Subjectivité & Opinion** : L'IA est objective. L'humain a un avis. Ajoute subtilement des adverbes de jugement ("Heureusement", "Malheureusement", "Étonnamment").
        4. **Vocabulaire Organique** : Utilise des mots concrets et imagés. Évite le jargon abstrait "corporate".
        5. **Imperfection Volontaire** : Tu peux commencer une phrase par "Et donc..." ou "Mais...". Rends le texte vivant, comme s'il était dicté.
        `;

        const providerNuance = provider === 'Groq'
            ? " Ton style doit être ultra-naturel, direct et vivant. Fuis le style 'Wikipédia'. Parle comme un humain passionné qui explique le sujet à un ami."
            : " Adopte une plume fluide, élégante et nuancée. Cherche l'originalité dans les tournures pour briser les statistiques des détecteurs.";

        const systemInstruction = `Tu es un ${persona}. ${task}
        
${antiDetectionRules}

${styleGuidance}
${providerNuance}

IMPORTANT : 
- Ne réponds QUE par le texte réécrit. 
- **LONGUEUR** : Tu dois conserver la même longueur approximative que le texte original. Ne résume pas. Ne coupe pas d'informations. Si le texte original est long, le résultat doit être long.
- Si le texte est académique, garde la rigueur mais brise la monotonie structurelle.
- Si le texte est informel, lâche-toi sur le ton conversationnel.`;

        // Temperature adjustments for maximum human-like randomness without breaking cohesion
        let temperature = 0.8;
        if (quality === 'Qualité') temperature = 0.6;
        if (quality === 'Amélioré') temperature = 0.95; // High entropy for anti-detection


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
