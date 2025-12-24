
import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import Header from './components/Header';
import { humanizeText } from './services/gemini';
import { GenerationState, HumanizeLevel, HumanizeQuality, HumanizeMode, HumanizeSettings, AIProvider, ModelType, API_LIMITS } from './types';
import mammoth from 'mammoth';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import saveAs from 'file-saver';

const QUOTA_KEY = 'humanizer_quota_v2';

const getModelFromSettings = (provider: AIProvider, quality: HumanizeQuality): ModelType => {
  if (provider === 'Gemini') {
    return quality === 'Amélioré' ? ModelType.GEMINI_PRO : ModelType.GEMINI_FLASH;
  }
  return quality === 'Amélioré' ? ModelType.GROQ_QUALITY : ModelType.GROQ_FAST;
};

const App: React.FC = () => {
  const [inputText, setInputText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);

  // Track usage per model
  const [usageMap, setUsageMap] = useState<Record<string, number>>({});

  const [isCopied, setIsCopied] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  const [level, setLevel] = useState<HumanizeLevel>('Pilote automatique');
  const [quality, setQuality] = useState<HumanizeQuality>('Équilibre');
  const [mode, setMode] = useState<HumanizeMode>('Général');
  const [provider, setProvider] = useState<AIProvider>('Groq');

  const [state, setState] = useState<GenerationState>({
    isLoading: false,
    progress: 0,
    error: null,
    result: null
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const progressIntervalRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const stats = useMemo(() => {
    const words = inputText.trim() ? inputText.trim().split(/\s+/).length : 0;
    return { words };
  }, [inputText]);

  useEffect(() => {
    const stored = localStorage.getItem(QUOTA_KEY);
    if (stored) {
      const { usage, lastUpdate } = JSON.parse(stored);
      const now = new Date().getTime();
      const dayInMs = 24 * 60 * 60 * 1000;

      // Reset if more than 24h passed
      if (now - lastUpdate > dayInMs) {
        setUsageMap({});
        localStorage.setItem(QUOTA_KEY, JSON.stringify({ usage: {}, lastUpdate: now }));
      } else {
        setUsageMap(usage || {});
      }
    }
  }, []);

  const currentModel = getModelFromSettings(provider, quality);
  const dailyLimit = API_LIMITS[currentModel];
  const currentUsage = usageMap[currentModel] || 0;
  const remainingGens = Math.max(0, dailyLimit - currentUsage);
  const quotaPercentage = (remainingGens / dailyLimit) * 100;

  const handleHumanize = async () => {
    if (!inputText.trim()) return;

    if (remainingGens <= 0) {
      setState(prev => ({
        ...prev,
        error: `Quota journalier atteint pour ce modèle (${dailyLimit} req/j). Passez à un autre modèle ou attendez demain.`
      }));
      return;
    }

    const settings: HumanizeSettings = { level, quality, mode, provider };
    setState(prev => ({ ...prev, isLoading: true, error: null, progress: 0 }));

    // Progress simulation
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    progressIntervalRef.current = window.setInterval(() => {
      setState(prev => ({ ...prev, progress: prev.progress >= 92 ? prev.progress : prev.progress + (prev.progress < 50 ? 5 : 1) }));
    }, 200);

    abortControllerRef.current = new AbortController();
    try {
      const humanized = await humanizeText(inputText, settings);

      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      setState({ isLoading: false, progress: 100, error: null, result: humanized });

      const newUsage = { ...usageMap, [currentModel]: currentUsage + 1 };
      setUsageMap(newUsage);
      localStorage.setItem(QUOTA_KEY, JSON.stringify({ usage: newUsage, lastUpdate: new Date().getTime() }));

    } catch (err: any) {
      if (err.name === 'AbortError') return;
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      setState({ isLoading: false, progress: 0, error: err.message, result: null });
    }
  };

  const handleExport = (format: 'docx' | 'txt') => {
    if (!state.result) return;

    if (format === 'txt') {
      const blob = new Blob([state.result], { type: 'text/plain;charset=utf-8' });
      saveAs(blob, `humanised_text_${new Date().getTime()}.txt`);
    } else {
      const doc = new Document({
        sections: [{
          properties: {},
          children: state.result.split('\n').map(line => new Paragraph({
            children: [new TextRun({ text: line, font: "Calibri", size: 24 })],
            spacing: { after: 200 }
          }))
        }]
      });

      Packer.toBlob(doc).then(blob => {
        saveAs(blob, `humanised_text_${new Date().getTime()}.docx`);
      });
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 pb-24">
      <Header />

      {/* Quota Header */}
      <div className="mt-8 mb-12 max-w-md mx-auto">
        <div className="flex justify-between items-end mb-3 px-1">
          <div className="flex items-center gap-2">
            <span className={`flex h-2 w-2 rounded-full animate-pulse ${remainingGens > 5 ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
            <span className="text-[10px] font-black text-slate-700 uppercase tracking-[0.15em]">Quota Gratuit ({currentModel})</span>
          </div>
          <span className={`text-[11px] font-bold font-mono px-3 py-1 rounded-full border shadow-sm ${remainingGens === 0 ? 'text-red-600 bg-red-50 border-red-200' : (provider === 'Gemini' ? 'text-blue-700 bg-blue-50 border-blue-200' : 'text-slate-900 bg-slate-100 border-slate-300')}`}>
            {remainingGens} / {dailyLimit}
          </span>
        </div>
        <div className="h-2.5 w-full bg-slate-200 rounded-full overflow-hidden shadow-inner p-0.5">
          <div className={`h-full transition-all duration-1000 ease-out rounded-full ${provider === 'Gemini' ? 'bg-gradient-to-r from-blue-500 to-indigo-700' : 'bg-slate-800'}`} style={{ width: `${quotaPercentage}%` }} />
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] md:rounded-[3.5rem] shadow-[0_40px_80px_-20px_rgba(0,0,0,0.15)] border border-slate-200 overflow-hidden flex flex-col min-h-[700px] transition-all duration-500">
        <div className="flex flex-col lg:flex-row flex-1">
          {/* Input Panel */}
          <div className="flex-1 flex flex-col relative border-b lg:border-b-0 lg:border-r-2 border-slate-200 bg-white">
            <div className="px-10 pt-8 pb-3 flex items-center justify-between border-b border-slate-100/50">
              <div className="flex flex-col">
                <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-[0.2em]">Entrée IA</h3>
                <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">{stats.words} mots</p>
              </div>
              <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 bg-slate-100 hover:bg-slate-900 hover:text-white rounded-2xl text-[10px] font-black uppercase transition-all text-slate-800">Importer</button>
              <input type="file" ref={fileInputRef} onChange={(e) => e.target.files?.[0] && setInputText(e.target.value)} className="hidden" accept=".docx,.txt" />
            </div>
            <textarea className="flex-1 w-full p-10 focus:outline-none text-slate-900 text-lg leading-relaxed resize-none placeholder:text-slate-400 font-medium no-scrollbar" placeholder="Collez votre contenu IA ici..." value={inputText} onChange={(e) => setInputText(e.target.value)} />
          </div>

          {/* Output Panel */}
          <div className={`flex-1 flex flex-col relative ${provider === 'Gemini' ? 'bg-slate-50' : 'bg-slate-50/80'}`}>
            <div className="px-10 pt-8 pb-3 flex items-center justify-between border-b border-slate-200/50">
              <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-[0.2em]">Optimisé</h3>
              {state.result && (
                <div className="flex gap-2">
                  <button onClick={() => handleExport('docx')} className="px-4 py-2 rounded-2xl text-[10px] font-black uppercase bg-white border border-slate-300 shadow-sm hover:bg-slate-50 text-blue-700">DOCX</button>
                  <button onClick={() => handleExport('txt')} className="px-4 py-2 rounded-2xl text-[10px] font-black uppercase bg-white border border-slate-300 shadow-sm hover:bg-slate-50 text-slate-700">TXT</button>
                  <div className="w-px h-6 bg-slate-300 mx-1"></div>
                  <button onClick={() => { navigator.clipboard.writeText(state.result!); setIsCopied(true); setTimeout(() => setIsCopied(false), 2000); }} className="px-4 py-2 rounded-2xl text-[10px] font-black uppercase bg-indigo-600 text-white shadow-md hover:bg-indigo-700 transition-all">{isCopied ? 'Copié !' : 'Copier'}</button>
                </div>
              )}
            </div>
            <div className="flex-1 w-full p-10 overflow-y-auto max-h-[500px] text-slate-900 text-lg leading-relaxed whitespace-pre-wrap font-medium no-scrollbar">
              {state.isLoading ? (
                <div className="flex flex-col items-center justify-center h-full space-y-4">
                  <div className="w-12 h-12 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin"></div>
                  <p className="text-xs font-black uppercase tracking-widest text-slate-500">Analyse en cours {Math.round(state.progress)}%</p>
                </div>
              ) : state.error ? (
                <div className="text-red-500 text-sm font-bold text-center p-10">{state.error}</div>
              ) : state.result ? (
                <div className="animate-in fade-in duration-700">{state.result}</div>
              ) : (
                <div className="h-full flex items-center justify-center opacity-40 italic text-sm">Prêt pour l'humanisation...</div>
              )}
            </div>
          </div>
        </div>

        {/* Action Center with Guide */}
        <div className="bg-white border-t border-slate-100 overflow-hidden">
          {/* Guide Toggle - Contrast Improved */}
          <button
            onClick={() => setShowGuide(!showGuide)}
            className={`w-full py-5 flex items-center justify-center gap-3 transition-all duration-300 border-b border-slate-100 group ${showGuide ? 'bg-indigo-50/50' : 'bg-slate-50/30 hover:bg-slate-50'}`}
          >
            <div className={`p-1.5 rounded-lg transition-all duration-300 ${showGuide ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600 group-hover:bg-indigo-600 group-hover:text-white'}`}>
              <svg className={`w-3.5 h-3.5 transition-transform duration-500 ${showGuide ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7"></path>
              </svg>
            </div>
            <span className={`text-[11px] font-black uppercase tracking-[0.25em] transition-colors duration-300 ${showGuide ? 'text-indigo-700' : 'text-slate-700 group-hover:text-indigo-700'}`}>
              {showGuide ? "Masquer le guide d'optimisation" : "Comment bien choisir vos réglages ?"}
            </span>
          </button>

          {/* Guide Content */}
          {showGuide && (
            <div className="px-10 py-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 bg-white animate-in slide-in-from-top duration-500">
              <div className="space-y-3 p-5 rounded-3xl bg-slate-50/80 border border-slate-100">
                <div className="flex items-center gap-3">
                  <span className="text-xl">⚙️</span>
                  <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-wider">Moteur</h4>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-600 font-semibold">
                  <strong className="text-blue-700">Gemini:</strong> Fluidité narrative et créativité. Idéal pour les essais.<br />
                  <strong className="text-slate-900">Groq:</strong> Précision chirurgicale et ton direct pour les rapports.
                </p>
              </div>
              <div className="space-y-3 p-5 rounded-3xl bg-slate-50/80 border border-slate-100">
                <div className="flex items-center gap-3">
                  <span className="text-xl">🚀</span>
                  <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-wider">Intensité</h4>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-600 font-semibold">
                  <strong className="text-slate-900">Simple:</strong> Correction des tics de langage IA.<br />
                  <strong className="text-slate-900">Avancé:</strong> Restructuration profonde pour un anonymat total.
                </p>
              </div>
              <div className="space-y-3 p-5 rounded-3xl bg-slate-50/80 border border-slate-100">
                <div className="flex items-center gap-3">
                  <span className="text-xl">✨</span>
                  <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-wider">Qualité</h4>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-600 font-semibold">
                  Plus la qualité est haute, plus l'IA utilise un vocabulaire varié et des figures de style humaines.
                </p>
              </div>
              <div className="space-y-3 p-5 rounded-3xl bg-slate-50/80 border border-slate-100">
                <div className="flex items-center gap-3">
                  <span className="text-xl">✍️</span>
                  <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-wider">Style</h4>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-600 font-semibold">
                  Adapte le ton au support : <strong>Académique</strong> pour les thèses, <strong>Blog</strong> pour l'engagement web.
                </p>
              </div>
            </div>
          )}

          <div className="px-10 py-10 md:px-14 flex flex-col xl:flex-row items-center justify-between gap-10">
            <div className="flex flex-wrap items-center justify-center gap-6">
              {/* Provider */}
              <div className="space-y-3">
                <p className="text-[10px] font-black text-slate-700 uppercase tracking-widest ml-2">Moteur</p>
                <div className="flex bg-slate-100 p-1.5 rounded-3xl border border-slate-200">
                  {['Gemini', 'Groq'].map((p) => (
                    <button
                      key={p}
                      onClick={() => {
                        if (p === 'Gemini' && p !== provider) {
                          const code = prompt("🔒 Accès Restreint\nEntrez le code administrateur pour utiliser Gemini :");
                          if (code !== import.meta.env.VITE_ADMIN_CODE) {
                            alert("Code incorrect.");
                            return;
                          }
                        }
                        setProvider(p as AIProvider);
                      }}
                      className={`px-8 py-3 text-xs font-black rounded-2xl transition-all uppercase flex items-center gap-2 ${provider === p ? (p === 'Gemini' ? 'bg-white shadow-md text-blue-700 border-blue-50' : 'bg-slate-900 shadow-md text-white border-slate-800') : 'text-slate-500 hover:text-slate-800'}`}
                    >
                      <span>{p === 'Gemini' ? '✨' : '⚡'}</span>
                      {p}
                      {p === 'Gemini' && provider !== 'Gemini' && <span className="ml-1 text-[8px] bg-slate-200 px-1 rounded text-slate-500">🔒</span>}
                    </button>
                  ))}
                </div>
              </div>

              {/* Intensity */}
              <div className="space-y-3">
                <p className="text-[10px] font-black text-slate-700 uppercase tracking-widest ml-2">Intensité</p>
                <div className="flex bg-slate-100 p-1.5 rounded-3xl border border-slate-200">
                  {['Basique', 'Pilote automatique'].map((l) => (
                    <button key={l} onClick={() => setLevel(l as HumanizeLevel)} className={`px-6 py-3 text-xs font-black rounded-2xl transition-all ${level === l ? 'bg-white shadow-md text-slate-950 border-slate-200 scale-105' : 'text-slate-500 hover:text-slate-900'}`}>
                      {l === 'Basique' ? '🍃 Simple' : '🚀 Avancé'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-4">
                {/* Quality */}
                <div className="space-y-3">
                  <p className="text-[10px] font-black text-slate-700 uppercase tracking-widest ml-2">Qualité</p>
                  <select value={quality} onChange={(e) => setQuality(e.target.value as HumanizeQuality)} className="appearance-none bg-white border-2 border-slate-200 rounded-[1.25rem] py-3 px-6 pr-10 text-xs font-bold text-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-50 cursor-pointer shadow-sm hover:border-slate-400 transition-all">
                    <option value="Qualité">Haute ✨</option>
                    <option value="Équilibre">Équilibre ⚖️</option>
                    <option value="Amélioré">Optimale 🔥</option>
                  </select>
                </div>
                {/* Mode */}
                <div className="space-y-3">
                  <p className="text-[10px] font-black text-slate-700 uppercase tracking-widest ml-2">Style</p>
                  <select value={mode} onChange={(e) => setMode(e.target.value as HumanizeMode)} className="appearance-none bg-white border-2 border-slate-200 rounded-[1.25rem] py-3 px-6 pr-10 text-xs font-bold text-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-50 cursor-pointer shadow-sm hover:border-slate-400 transition-all">
                    <option value="Général">Général 🌍</option>
                    <option value="Académique">Académique 🎓</option>
                    <option value="Blog">Article ✍️</option>
                    <option value="Formel">Formel 💼</option>
                    <option value="Informel">Relax 💬</option>
                  </select>
                </div>
              </div>
            </div>

            <button
              onClick={handleHumanize}
              disabled={state.isLoading || !inputText.trim() || remainingGens <= 0}
              className={`group relative min-w-[320px] h-[72px] rounded-[2.2rem] font-black text-white transition-all duration-500 overflow-hidden shadow-2xl transform active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed ${state.isLoading || !inputText.trim() || remainingGens <= 0 ? 'bg-slate-300' : (provider === 'Gemini' ? 'bg-slate-950 shadow-blue-400/30' : 'bg-slate-900 shadow-orange-400/30')}`}
            >
              <div className={`absolute inset-0 transition-opacity duration-700 ${provider === 'Gemini' ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 opacity-0 group-hover:opacity-100' : 'bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 opacity-0 group-hover:opacity-100'}`}></div>
              <div className="relative flex items-center justify-center gap-4">
                <div className={`transition-all duration-700 ${state.isLoading ? 'animate-spin' : 'group-hover:rotate-[360deg]'}`}>
                  <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor"><path d="M13 10V3L4 14H11V21L20 10H13Z" /></svg>
                </div>
                <span className="text-base uppercase tracking-wider font-black">{state.isLoading ? "Génération..." : "Humaniser maintenant"}</span>
              </div>
            </button>
          </div>
        </div>
      </div>

      <footer className="mt-24 py-12 border-t border-slate-200 flex flex-col items-center justify-center gap-4">
        <div className="flex gap-4">
          <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
          <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '200ms' }}></div>
          <div className="w-1.5 h-1.5 bg-slate-900 rounded-full animate-bounce" style={{ animationDelay: '400ms' }}></div>
        </div>
        <p className="text-[11px] font-black text-slate-500 uppercase tracking-[0.4em]">© {new Date().getFullYear()} Humaniser Texte AI</p>
      </footer>
    </div>
  );
};

export default App;
