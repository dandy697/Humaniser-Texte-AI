
import React from 'react';

const detectors = [
  { name: 'Turnitin', color: 'text-blue-700', icon: '📝' },
  { name: 'Gptzero', color: 'text-sky-600', icon: '🌀' },
  { name: 'Copyleak', color: 'text-cyan-700', icon: '©️' },
  { name: 'Zerogpt', color: 'text-slate-800', icon: '🧠' },
  { name: 'Quillbot', color: 'text-emerald-700', icon: '🤖' },
  { name: 'Writer', color: 'text-slate-950', icon: '✍️' },
  { name: 'Sapling', color: 'text-indigo-600', icon: '🌱' },
  { name: 'Originality', color: 'text-purple-700', icon: '🔮' },
];

const Header: React.FC = () => {
  return (
    <header className="w-full pt-12 text-center relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-blue-100/30 blur-[120px] rounded-full -z-10"></div>
      
      <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-slate-950 mb-6">
        L'IA qui écrit <br/>
        <span className="text-transparent bg-clip-text bg-gradient-to-br from-blue-700 via-indigo-700 to-purple-700">comme vous.</span>
      </h1>
      
      <p className="text-lg text-slate-700 max-w-2xl mx-auto px-4 font-semibold leading-relaxed mb-10">
        Transforme le contenu IA en écriture naturelle et humaine qui contourne toute détection IA. Notre humanisateur IA avancé garantit une authenticité parfaite tout en préservant votre message. Essayez-le maintenant !
      </p>

      <div className="max-w-4xl mx-auto px-4 mt-12 mb-8">
        <p className="text-[11px] font-black text-slate-600 uppercase tracking-[0.2em] mb-6">
          Notre outil peut contourner ces détecteurs AI
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 opacity-85 grayscale hover:grayscale-0 transition-all duration-500">
          {detectors.map((d) => (
            <div key={d.name} className="flex items-center justify-center md:justify-start gap-2 group">
              <span className="text-xl group-hover:scale-110 transition-transform">{d.icon}</span>
              <span className={`text-sm font-black ${d.color} tracking-tight`}>{d.name}</span>
            </div>
          ))}
        </div>
      </div>
    </header>
  );
};

export default Header;
