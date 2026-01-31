
import React from 'react';
import { LeaderboardEntry } from '../types';

interface LeaderboardProps {
  entries: LeaderboardEntry[];
  onClose: () => void;
}

const Leaderboard: React.FC<LeaderboardProps> = ({ entries, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[130] flex items-center justify-center p-6 font-sans">
      <div className="bg-slate-900 border border-amber-500/30 w-full max-w-lg rounded-3xl shadow-[0_0_50px_rgba(245,158,11,0.15)] overflow-hidden flex flex-col">
        <div className="p-8 border-b border-slate-800 bg-slate-950 flex justify-between items-center relative overflow-hidden">
          <div className="absolute inset-0 bg-amber-500/5" />
          <div className="relative">
            <h2 className="text-2xl font-black text-white uppercase tracking-widest italic">Top Extractors</h2>
            <p className="text-xs text-amber-500 font-mono mt-2 font-bold tracking-wide">CYCLE 4492-B</p>
          </div>
          <div className="text-4xl">🏆</div>
        </div>

        <div className="p-6 space-y-3 max-h-[60vh] overflow-y-auto">
          {entries.map((entry) => (
            <div 
              key={entry.rank} 
              className={`flex items-center justify-between p-4 rounded-2xl border ${entry.isUser ? 'bg-amber-900/20 border-amber-500/50 shadow-inner' : 'bg-slate-800/50 border-white/5'}`}
            >
              <div className="flex items-center gap-5">
                <div className={`w-10 h-10 flex items-center justify-center rounded-xl font-black text-base ${entry.rank === 1 ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/20' : 'bg-slate-700 text-slate-400'}`}>
                  {entry.rank}
                </div>
                <div>
                    <div className={`text-base font-bold ${entry.isUser ? 'text-amber-400' : 'text-slate-200'}`}>
                        {entry.name}
                    </div>
                    {entry.isUser && <span className="text-[10px] text-amber-600 uppercase tracking-widest font-black">You</span>}
                </div>
              </div>
              <div className="font-mono text-base text-slate-200 font-medium">
                {entry.score.toLocaleString()} <span className="text-xs text-slate-500 font-bold">XP</span>
              </div>
            </div>
          ))}
        </div>

        <div className="p-6 border-t border-slate-800 bg-slate-950">
           <p className="text-xs text-center text-slate-500 mb-4 font-medium">Leaderboards reset every Genesis Shift (24h).</p>
           <button onClick={onClose} className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-white font-black rounded-2xl text-sm uppercase tracking-[0.2em] transition-all hover:shadow-xl">
             Close Uplink
           </button>
        </div>
      </div>
    </div>
  );
};

export default Leaderboard;
