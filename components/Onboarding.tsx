
import React from 'react';

interface OnboardingProps {
  onClose: () => void;
}

const Onboarding: React.FC<OnboardingProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-zinc-900 border border-blue-500/30 rounded-3xl p-8 shadow-[0_0_50px_rgba(59,130,246,0.15)]">
        <div className="inline-block px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full text-blue-400 text-[10px] font-bold tracking-widest uppercase mb-4">
          Training Commenced
        </div>
        <h2 className="text-2xl font-bold mb-4">Welcome to the Frontier</h2>
        
        <div className="space-y-6">
          <div className="flex gap-4">
            <div className="w-10 h-10 shrink-0 bg-zinc-800 rounded-lg flex items-center justify-center text-xl">🆔</div>
            <div>
              <h4 className="font-bold text-sm text-zinc-200">Your Ronin Address</h4>
              <p className="text-xs text-zinc-400 leading-relaxed">Think of your "0x..." address as your digital passport. It's how the Ronin Network knows who owns which items.</p>
            </div>
          </div>
          
          <div className="flex gap-4">
            <div className="w-10 h-10 shrink-0 bg-zinc-800 rounded-lg flex items-center justify-center text-xl">⛏️</div>
            <div>
              <h4 className="font-bold text-sm text-zinc-200">Mining Resources</h4>
              <p className="text-xs text-zinc-400 leading-relaxed">Click any colored node to extract materials. These aren't just pixels—they are assets you can eventually trade or craft with.</p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="w-10 h-10 shrink-0 bg-zinc-800 rounded-lg flex items-center justify-center text-xl">🛡️</div>
            <div>
              <h4 className="font-bold text-sm text-zinc-200">Secure Your Loot</h4>
              <p className="text-xs text-zinc-400 leading-relaxed">In "Extraction" games, your progress is only permanent if you survive. Good luck, Ranger.</p>
            </div>
          </div>
        </div>

        <button 
          onClick={onClose}
          className="w-full mt-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-500/20"
        >
          Begin Mission
        </button>
      </div>
    </div>
  );
};

export default Onboarding;
