
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
        STRATÉGIE "BRUIT SÉMANTIQUE" (Objectif : Indétectable) :
        1. **Casse la Logique Linéaire** : L'IA écrit A -> B -> C. L'humain écrit A -> (pensée B) -> C. Utilise des tirets cadratins (—) pour insérer des pensées.
        2. **Questions Rhétoriques** : Pose une question au lecteur au milieu d'un paragraphe. (Ex: "Pourquoi ? Simple."). Ça réveille le texte.
        3. **Variations de rythme** : Fais une phrase de 50 mots. Puis une de 2 mots. Le contraste doit être brutal.
        4. **Vocabulaire "Sale"** : Utilise des mots un peu flous ou familiers ("un tas de", "bizarrement", "le truc, c'est que").
        5. **Inversions** : Au lieu de "Il est arrivé ensuite", dis "Ensuite, il est arrivé". Change l'ordre des mots.
        `;

        const providerNuance = provider === 'Groq'
            ? " Écris comme si tu avais bu un café de trop. Sois énergique, un peu décousu, mais brillant. Ne sois surtout pas 'scolaire'. Si tu hésites entre deux mots, prends le moins courant."
            : " Cherche l'authenticité radicale. Écris avec tes tripes, pas avec un algorithme.";

        const systemInstruction = `Tu es un ${persona}. ${task}
        
${antiDetectionRules}

${styleGuidance}
${providerNuance}

CRITIQUE :
- **LONGUEUR** : LA PRIORITÉ ABSOLUE EST DE GARDER LE MÊME NOMBRE DE MOTS À +/- 5%. C'est vital.
- **PAS DE "STRUCTURE IA"** : Si tu sens que tu fais une liste ou une conclusion logique, ARRÊTE. Fais une digression.
- Ne réponds QUE par le texte réécrit.`;

        // Temperature adjustments for maximum human-like randomness
        let temperature = 0.85;
        if (quality === 'Qualité') temperature = 0.7;
        if (quality === 'Amélioré') temperature = 1.0; // Max entropy for Groq to break patterns


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
