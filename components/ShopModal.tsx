
import React from 'react';
import { CosmeticItem, PlayerProfile } from '../types';

export const COSMETIC_CATALOG: CosmeticItem[] = [
  // Tints (Chromas)
  { id: 'tint_crimson', name: 'Crimson Ops', type: 'tint', cost: 150, value: 0xef4444, description: 'Standard issue combat red.' },
  { id: 'tint_neon', name: 'Neon Cyber', type: 'tint', cost: 300, value: 0x22d3ee, description: 'High-visibility cyan.' },
  { id: 'tint_void', name: 'Void Walker', type: 'tint', cost: 500, value: 0x8b5cf6, description: 'Stealth purple coating.' },
  { id: 'tint_gold', name: 'Midas Touch', type: 'tint', cost: 1000, value: 0xfacc15, description: 'Gold plated armor.' },

  // Auras (Trails)
  { id: 'aura_trail', name: 'Bitstream Trail', type: 'aura', cost: 800, value: 'cyber_trail', description: 'Leaves a trail of data packets.' },
  { id: 'aura_smoke', name: 'Shadow Protocol', type: 'aura', cost: 1200, value: 'void_smoke', description: 'Emits dark energy smoke.' },
  { id: 'aura_binary', name: 'Source Code', type: 'aura', cost: 2000, value: 'binary_code', description: 'Leak raw data as you move.' },
  { id: 'aura_fire', name: 'Pixel Inferno', type: 'aura', cost: 2500, value: 'pixel_fire', description: 'Blaze a path of destruction.' },

  // Impact FX (Mining Skins)
  { id: 'impact_standard', name: 'Standard Drill', type: 'impact', cost: 0, value: 'standard', description: 'Standard pneumatic impact.' },
  { id: 'impact_void', name: 'Abyssal Ink', type: 'impact', cost: 1500, value: 'void', description: 'Splashes purple void matter on impact.' },
  { id: 'impact_gold', name: 'Zeus Arc', type: 'impact', cost: 1800, value: 'lightning', description: 'Strikes resource nodes with lightning.' },

  // Emotes (Social Flex)
  { id: 'emote_skull', name: 'Skull Sign', type: 'emote', cost: 200, value: '💀', description: 'Intimidate rivals.' },
  { id: 'emote_diamond', name: 'Diamond Hands', type: 'emote', cost: 600, value: '💎', description: 'Show your holding power.' },
  { id: 'emote_crown', name: 'Kingslayer', type: 'emote', cost: 1500, value: '👑', description: 'The ultimate status symbol.' },
];

interface ShopModalProps {
  profile: PlayerProfile;
  onClose: () => void;
  onPurchase: (item: CosmeticItem) => void;
  onEquip: (item: CosmeticItem) => void;
}

const ShopModal: React.FC<ShopModalProps> = ({ profile, onClose, onPurchase, onEquip }) => {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[120] flex items-center justify-center p-6 font-sans">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-8 border-b border-slate-800 flex justify-between items-center bg-slate-950">
          <div>
            <h2 className="text-3xl font-black text-white uppercase tracking-widest">Black Market</h2>
            <p className="text-sm text-slate-400 mt-1">Authorized Cosmetic Modifications</p>
          </div>
          <div className="text-right">
             <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">Balance</div>
             <div className="text-3xl font-mono text-yellow-400">{profile.gold.toLocaleString()} CR</div>
          </div>
        </div>

        {/* Content */}
        <div className="p-8 overflow-y-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {COSMETIC_CATALOG.map(item => {
            const isOwned = profile.ownedCosmetics.includes(item.id) || item.cost === 0;
            const isEquipped = profile.equippedCosmetics[item.type] === item.id;
            const canAfford = profile.gold >= item.cost;

            return (
              <div key={item.id} className={`relative p-6 rounded-2xl border flex flex-col justify-between group transition-all hover:scale-[1.02] ${isOwned ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-900 border-slate-800'}`}>
                
                {/* Visual Preview Stub */}
                <div className="absolute top-6 right-6 w-12 h-12 rounded-full border border-white/10 flex items-center justify-center bg-black/50 text-2xl shadow-inner">
                    {item.type === 'tint' && <div className="w-6 h-6 rounded-full shadow-[0_0_10px_currentColor]" style={{ backgroundColor: '#' + item.value.toString(16).padStart(6, '0'), color: '#' + item.value.toString(16).padStart(6, '0') }} />}
                    {item.type === 'aura' && <div className="text-xl animate-pulse">✨</div>}
                    {item.type === 'impact' && <div className="text-xl animate-ping">💥</div>}
                    {item.type === 'emote' && <div>{item.value}</div>}
                </div>

                <div className="mb-6">
                  <h3 className="font-black text-white text-lg uppercase tracking-tight">{item.name}</h3>
                  <div className="mt-2">
                    <span className={`text-[10px] px-2 py-1 rounded-md uppercase font-bold tracking-wider ${
                        item.type === 'emote' ? 'bg-indigo-950 text-indigo-300 border border-indigo-900' : 
                        item.type === 'impact' ? 'bg-red-950 text-red-300 border border-red-900' : 
                        'bg-slate-950 text-slate-400 border border-slate-800'
                    }`}>
                        {item.type}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 mt-4 leading-relaxed font-medium">{item.description}</p>
                </div>

                <div className="mt-auto pt-4">
                  {isOwned ? (
                    <button 
                      onClick={() => onEquip(item)}
                      disabled={isEquipped}
                      className={`w-full py-3 rounded-xl font-black text-xs uppercase tracking-[0.15em] transition-all ${isEquipped ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/50 cursor-default' : 'bg-slate-700 hover:bg-slate-600 text-white hover:shadow-lg'}`}
                    >
                      {item.type === 'emote' ? (isEquipped ? 'SLOTTED' : 'SLOT TO BAR') : (isEquipped ? 'EQUIPPED' : 'EQUIP')}
                    </button>
                  ) : (
                    <button 
                      onClick={() => onPurchase(item)}
                      disabled={!canAfford}
                      className={`w-full py-3 rounded-xl font-black text-xs uppercase tracking-[0.15em] transition-all ${canAfford ? 'bg-yellow-600 hover:bg-yellow-500 text-white shadow-lg' : 'bg-slate-800 text-slate-600 cursor-not-allowed'}`}
                    >
                      BUY {item.cost} CR
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-800 bg-slate-950 flex justify-center">
            <button onClick={onClose} className="text-slate-500 hover:text-white text-sm uppercase tracking-[0.2em] font-bold transition-colors">Close Uplink</button>
        </div>
      </div>
    </div>
  );
};

export default ShopModal;
