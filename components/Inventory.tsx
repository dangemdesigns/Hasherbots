
import React from 'react';

interface InventoryProps {
  inventory: Record<string, number>;
  maxSlots?: number;
}

const ResourceIcon = ({ type }: { type: string }) => {
  switch (type.toLowerCase()) {
    case 'axite': return <span className="text-3xl filter drop-shadow-[0_4px_4px_rgba(0,0,0,0.5)]">⚙️</span>;
    case 'gold': return <span className="text-3xl filter drop-shadow-[0_4px_4px_rgba(0,0,0,0.5)]">🪙</span>;
    case 'crystal': return <span className="text-3xl filter drop-shadow-[0_4px_4px_rgba(0,0,0,0.5)]">🔮</span>;
    default: return <div className="w-8 h-8 bg-slate-700 rounded-full" />;
  }
};

const Inventory: React.FC<InventoryProps> = ({ inventory, maxSlots = 8 }) => {
  const items = Object.entries(inventory);
  const emptySlotsCount = Math.max(0, maxSlots - items.length);

  return (
    <div className="grid grid-cols-4 gap-3 w-full">
      {items.map(([name, count]) => {
        const isRare = name === 'crystal' || name === 'gold';
        return (
          <div 
            key={name} 
            className={`h-20 w-20 relative bg-slate-800/80 border-2 ${isRare ? 'border-yellow-500/50 shadow-[0_0_15px_rgba(234,179,8,0.2)]' : 'border-white/10'} rounded-xl flex items-center justify-center transition-all hover:bg-slate-700 hover:scale-105 active:scale-95 group cursor-pointer`}
            title={name.toUpperCase()}
          >
            <ResourceIcon type={name} />
            
            <div className={`absolute -bottom-2 -right-2 px-2 py-1 rounded-md text-xs font-black text-white shadow-lg leading-none border border-black/20 ${isRare ? 'bg-yellow-600' : 'bg-slate-600'}`}>
              {(count as number) > 999 ? '999+' : count}
            </div>
          </div>
        );
      })}

      {[...Array(emptySlotsCount)].map((_, i) => (
        <div 
          key={`empty-${i}`} 
          className="h-20 w-20 bg-slate-950/30 border-2 border-white/5 rounded-xl flex items-center justify-center"
        >
          <div className="w-2 h-2 bg-slate-800/50 rounded-full" />
        </div>
      ))}
    </div>
  );
};

export default Inventory;
