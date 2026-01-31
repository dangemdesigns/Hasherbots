
import React, { useState, useEffect, useRef } from 'react';
import { PlayerProfile, User, FeedItem } from '../types';
import Inventory from './Inventory';
import { COSMETIC_CATALOG } from './ShopModal';

interface HUDProps {
  user: User;
  profile: PlayerProfile;
  feed: FeedItem[];
  isBuildMode: boolean;
  onToggleBuild: () => void;
  onSync: () => void;
  onConnectWallet: () => void;
  onOpenShop: () => void;
  onOpenLeaderboard: () => void;
  onEmote: (emoji: string) => void;
  onChat: (msg: string) => void;
  activeEvent: string | null;
}

const HUD: React.FC<HUDProps> = ({ 
  user, 
  profile, 
  feed, 
  isBuildMode, 
  onToggleBuild, 
  onSync,
  onConnectWallet,
  onOpenShop,
  onOpenLeaderboard,
  onEmote,
  onChat,
  activeEvent
}) => {
  const [timeLeft, setTimeLeft] = useState(600);
  const [chatInput, setChatInput] = useState('');
  const [isChatFocused, setIsChatFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setInterval(() => setTimeLeft(prev => (prev <= 0 ? 600 : prev - 1)), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
      if (feedRef.current) {
          feedRef.current.scrollTop = 0;
      }
  }, [feed]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Enter' && !isChatFocused) {
            e.preventDefault();
            inputRef.current?.focus();
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isChatFocused]);

  const handleChatSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (chatInput.trim()) {
          onChat(chatInput.trim());
          setChatInput('');
          inputRef.current?.blur();
      }
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="absolute inset-0 pointer-events-none p-6 md:p-8 flex flex-col justify-between font-mono text-white overflow-hidden">
      
      {/* TOP HUD: Minimalist Floating Pills */}
      <div className="flex justify-between items-start pointer-events-auto">
        
        {/* Left: Player Status */}
        <div className="flex flex-col gap-3">
            <div className="flex items-center gap-4 bg-black/80 backdrop-blur-xl border border-white/20 rounded-full px-6 py-3 shadow-2xl hover:border-white/40 transition-all group">
                <div className={`w-3 h-3 rounded-full ${user.isGuest ? 'bg-amber-500' : 'bg-emerald-500'} animate-pulse shadow-[0_0_10px_currentColor]`}></div>
                <span className="text-sm font-bold tracking-widest group-hover:text-white text-zinc-300 transition-colors">
                    {user.isGuest ? 'GUEST_MODE' : 'RONIN_LINKED'}
                </span>
                <div className="w-px h-4 bg-white/20"></div>
                <span className="text-sm text-zinc-400 font-medium">CR <span className="text-white text-base font-bold ml-1">{profile.gold.toLocaleString()}</span></span>
            </div>

            {activeEvent && (
                <div className="bg-red-500/20 border border-red-500/50 backdrop-blur-md px-6 py-3 rounded-xl self-start animate-pulse shadow-[0_0_20px_rgba(239,68,68,0.3)]">
                     <span className="text-sm font-bold text-red-400 tracking-[0.2em] uppercase">⚠ {activeEvent}</span>
                </div>
            )}
        </div>

        {/* Right: System & Tools */}
        <div className="flex items-center gap-3">
            <div className="bg-black/80 backdrop-blur-xl border border-white/20 rounded-full px-6 py-3 text-base font-bold text-zinc-300 font-variant-numeric tabular-nums tracking-wider shadow-xl">
                T-{formatTime(timeLeft)}
            </div>
            
            <button 
                onClick={onOpenLeaderboard} 
                className="w-12 h-12 flex items-center justify-center bg-black/80 backdrop-blur-xl border border-white/20 rounded-full hover:bg-white/10 hover:border-white/50 hover:scale-105 transition-all text-xl shadow-xl"
                title="Leaderboard"
            >
                🏆
            </button>
            <button 
                onClick={onOpenShop} 
                className="px-6 py-3 bg-black/80 backdrop-blur-xl border border-white/20 rounded-full hover:bg-white/10 hover:border-white/50 hover:scale-105 transition-all text-sm font-bold tracking-widest shadow-xl"
            >
                SHOP
            </button>
            
            {user.isGuest && (
                <button onClick={onConnectWallet} className="px-6 py-3 bg-blue-600/90 backdrop-blur-xl border border-blue-400 rounded-full hover:bg-blue-500 hover:scale-105 transition-all text-sm font-bold tracking-widest shadow-[0_0_20px_rgba(37,99,235,0.4)]">
                    SAVE
                </button>
            )}
        </div>
      </div>

      {/* BOTTOM HUD */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-6 pointer-events-auto">
        
        {/* Chat / Feed: Raw Terminal Style - Bigger text */}
        <div className="w-full md:w-[32rem] flex flex-col gap-3">
            <div ref={feedRef} className="flex flex-col-reverse h-48 overflow-hidden mask-gradient-b pb-2">
                 {feed.map((item) => (
                    <div key={item.id} className="text-sm leading-relaxed font-medium drop-shadow-md py-0.5">
                        <span className="text-zinc-500 mr-3 opacity-70">[{formatTime((Date.now() - item.timestamp)/1000 | 0)}]</span>
                        <span className={`${
                            item.type === 'loot' ? 'text-amber-300' : 
                            item.type === 'event' ? 'text-red-400 font-bold tracking-wide' : 
                            item.type === 'alert' ? 'text-cyan-400' : 
                            'text-zinc-200'
                        }`}>
                            {item.type === 'info' ? '> ' : ''}{item.text}
                        </span>
                    </div>
                 ))}
            </div>

            <form onSubmit={handleChatSubmit} className="relative group">
                <div className="absolute left-0 bottom-0 w-2 h-full border-l-2 border-white/30 group-focus-within:border-white/80 transition-colors"></div>
                <input 
                    ref={inputRef}
                    type="text" 
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Input command..."
                    className="w-full bg-black/40 backdrop-blur-sm border-b-2 border-white/20 py-3 pl-4 text-base focus:border-white/80 outline-none placeholder:text-zinc-600 text-white transition-colors"
                    onFocus={() => setIsChatFocused(true)}
                    onBlur={() => setIsChatFocused(false)}
                />
            </form>
        </div>

        {/* Action Bar & Inventory */}
        <div className="flex flex-col items-end gap-4 w-full md:w-auto">
             <div className="flex gap-3">
                 <button 
                    onClick={onToggleBuild}
                    className={`px-8 py-3 rounded-full text-xs font-black uppercase tracking-[0.2em] border-2 transition-all shadow-xl hover:scale-105 ${isBuildMode ? 'bg-cyan-500 text-black border-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.5)]' : 'bg-black/80 text-zinc-400 border-white/20 hover:border-white/50 hover:text-white'}`}
                 >
                    {isBuildMode ? 'Deploying...' : 'Deploy'}
                 </button>
                 <button onClick={onSync} className="px-6 py-3 rounded-full bg-black/40 border border-white/10 text-xs text-zinc-500 hover:text-white hover:bg-black/60 hover:border-white/30 uppercase tracking-[0.2em] transition-all">
                     SYNC
                 </button>
             </div>

             <div className="bg-black/80 backdrop-blur-xl border border-white/10 p-3 rounded-2xl shadow-2xl">
                 <Inventory inventory={profile.inventory} maxSlots={4} />
             </div>
        </div>

      </div>
    </div>
  );
};

export default HUD;
