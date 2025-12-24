
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

// Fonction pour découper le texte en morceaux (Chunks) intelligents
function splitTextintoChunks(text: string, maxChunkSize: number = 2500): string[] {
    const paragraphs = text.split(/\n\s*\n/);
    const chunks: string[] = [];
    let currentChunk = "";

    for (const paragraph of paragraphs) {
        if ((currentChunk.length + paragraph.length) > maxChunkSize && currentChunk.length > 0) {
            chunks.push(currentChunk.trim());
            currentChunk = "";
        }
        currentChunk += (currentChunk ? "\n\n" : "") + paragraph;
    }
    if (currentChunk) chunks.push(currentChunk.trim());
    return chunks;
}

async function processChunk(text: string, settings: any, isChunked: boolean): Promise<string> {
    const { provider, quality, mode, level } = settings;

    // --- PREPARATION DU PROMPT (SUPER-LOGIQUE ANTI-DÉTECTION) ---

    // COUCHE 3 : LA VOIX UNIQUE (Adaptation selon le Mode)
    let voiceInstruction = "Écris comme un humain spontané, avec de légères imperfections stylistiques volontaires (comme commencer une phrase par 'Et' ou 'Mais').";
    if (mode === 'Académique') voiceInstruction = "Adopte une voix d'expert universitaire, nuancée et analytique, mais évite le jargon générique.";
    if (mode === 'Blog') voiceInstruction = "Adopte un ton personnel, engageant, avec une opinion forte et un style direct.";
    if (mode === 'Formel') voiceInstruction = "Garde une posture professionnelle et directrice, mais utilise un vocabulaire actif et non passif.";

    // Règle de Longueur (Iso-longueur) - MAINTENU
    let lengthRule = "Garde approximativement le même nombre de mots que le texte original (Iso-longueur). Ne résume pas.";
    if (mode === 'Simplifier') lengthRule = "Synthétise (-20%).";
    if (mode === 'Développer') lengthRule = "Développe (+20%).";

    // Instruction de Contexte (Chunking)
    const contextInstruction = isChunked ? "CECI EST UNE PARTIE D'UN TEXTE PLUS LONG. Ne fais pas d'intro/conclusion. Réécris ce segment." : "";

    const systemInstruction = `
Tu es un Ghostwriter expert. Ta mission : Réécrire ce texte pour qu'il soit **INDÉTECTABLE** par les algorithmes (GPTZero/Turnitin), tout en respectant le fond.

${contextInstruction}

### LES 3 PILIERS DE L'INDÉTECTABILITÉ :

1.  **COUCHE 1 : PERPLEXITÉ (Vocabulaire)**
    *   **BANNIS** les répétitions et le vocabulaire "moyen" de l'IA.
    *   **UTILISE** un vocabulaire riche, rare et varié. Remplace les termes génériques par des synonymes précis ou des idiomes.
    *   **INTERDICTION** des mots "ChatGPT" : "En conclusion, En somme, Par ailleurs, De surcroît, Crucial, Paysage, Synergie".
    *   **EXCEPTION CRITIQUE** : Ne touche PAS aux termes techniques/métiers (Noms propres, Jargon Technique). Ils doivent rester intacts.

2.  **COUCHE 2 : ÉCLATEMENT (Burstiness)**
    *   **VARIE RADICALEMENT** la longueur des phrases.
    *   Alterne : Phrase très courte (3-5 mots) -> Phrase longue et complexe -> Phrase moyenne.
    *   Ne produis JAMAIS trois phrases de même longueur à la suite.
    *   Casse le rythme monotone.

3.  **COUCHE 3 : VOIX (Style)**
    *   ${voiceInstruction}
    *   **LONGUEUR** : ${lengthRule}

TA RÉPONSE :
Renvoie UNIQUEMENT le texte réécrit.`;

    // Temperature adjustments (High Entropy as requested)
    let temperature = 0.85; // Minimum requested
    if (quality === 'Qualité') temperature = 0.7; // Slightly safer
    if (quality === 'Amélioré') temperature = 1.0; // Max Burstiness

    // --- EXECUTION ---
    try {
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

            return completion.choices[0]?.message?.content || "";

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
            return resultText || "";
        }
    } catch (error: any) {
        console.error("Erreur Chunk:", error);
        return `[Erreur sur ce segment: ${error.message}]`; // Fail gracefully for chunks
    }
}

export default async function handler(req: Request) {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const { text, settings } = await req.json();
        const { provider } = settings;

        // --- SECURITY CHECK (Serveur) ---
        if (provider === 'Gemini') {
            const adminCode = req.headers.get('X-Admin-Code');
            const secureCode = process.env.VITE_ADMIN_CODE || process.env.ADMIN_CODE;
            if (!secureCode || adminCode !== secureCode) {
                return new Response(JSON.stringify({ error: "🔒 Accès refusé. Code administrateur invalide." }), { status: 403, headers: corsHeaders });
            }
        }

        // --- CHUNKING STRATEGY ---
        // Si le texte est long (> 2500 caractères), on découpe pour éviter l'effet "Résumé"
        // et pour garantir la préservation de la longueur.

        let result = "";

        if (text.length > 2500) {
            const chunks = splitTextintoChunks(text);
            console.log(`Processing ${chunks.length} chunks...`);

            // Process chunks in parallel for speed
            const processedChunks = await Promise.all(
                chunks.map(chunk => processChunk(chunk, settings, true))
            );

            result = processedChunks.join("\n\n");

        } else {
            // Short text, process as one
            result = await processChunk(text, settings, false);
        }

        return new Response(JSON.stringify({ result }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });

    } catch (error: any) {
        console.error("API Error:", error);
        return new Response(JSON.stringify({ error: error.message || "Erreur serveur interne" }), { status: 500, headers: corsHeaders });
    }
}
