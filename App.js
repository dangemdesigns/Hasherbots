
import React, { useEffect, useRef, useState, useCallback } from 'react';
import Phaser from 'phaser';
import { MainScene } from './game/MainScene';
import HUD from './components/HUD';
import ShopModal, { COSMETIC_CATALOG } from './components/ShopModal';
import Leaderboard from './components/Leaderboard';
import { roninLogin, guestLogin } from './services/roninService';
import { initializeGrid, getTiles, mineResource, placeStructure, triggerGenesisShift, spawnEventNode } from './services/gameService';
import { audio } from './services/audioService';
import { User, PlayerProfile, GameTile, CosmeticItem, LeaderboardEntry, FeedItem } from './types';

const MOCK_LEADERBOARD: LeaderboardEntry[] = [
  { rank: 1, name: 'CyberSamurai', score: 145000, isUser: false },
  { rank: 2, name: 'GlitchWitch', score: 128000, isUser: false },
  { rank: 3, name: 'NullPointer', score: 112500, isUser: false },
  { rank: 4, name: 'R0nin_User', score: 98000, isUser: false },
  { rank: 5, name: 'Guest_992', score: 85000, isUser: false },
];

const App: React.FC = () => {
  const gameRef = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<MainScene | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [user, setUser] = useState<User>({ address: '', isLoggedIn: false });
  const [hasStarted, setHasStarted] = useState(false);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);

  const [isBuildMode, setIsBuildMode] = useState(false);
  const [showShop, setShowShop] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [activeEventName, setActiveEventName] = useState<string | null>(null);
  
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [profile, setProfile] = useState<PlayerProfile>({
    address: '', 
    gold: 5000, 
    xp: 0, 
    inventory: {}, 
    blueprints: ['extractor'], 
    drillLevel: 1,
    ownedCosmetics: [],
    equippedCosmetics: { 
        emote: 'emote_wave',
        impact: 'impact_standard'
    }
  });

  const isBuildModeRef = useRef(isBuildMode);
  const userRef = useRef(user);

  useEffect(() => { isBuildModeRef.current = isBuildMode; }, [isBuildMode]);
  useEffect(() => { userRef.current = user; }, [user]);

  // --- LOGGING HELPER ---
  const addToFeed = (text: string, type: 'info' | 'loot' | 'event' | 'alert' = 'info') => {
      const newItem: FeedItem = { id: Math.random().toString(36), text, type, timestamp: Date.now() };
      setFeed(prev => [newItem, ...prev].slice(0, 30));
  };

  // --- INITIALIZATION ---
  useEffect(() => {
    const guest = guestLogin();
    setUser(guest);
    
    // Initial feed population
    setTimeout(() => addToFeed("System Online. Connected to Genesis Plains.", 'alert'), 500);
    setTimeout(() => addToFeed("Tip: Look for Obelisks to earn squad bonuses.", 'info'), 2500);
  }, []);

  // --- GENESIS SHIFT LOGIC ---
  const handleGenesisShift = useCallback(() => {
    triggerGenesisShift();
    sceneRef.current?.playGenesisShiftEffect();
    sceneRef.current?.updateTiles(getTiles());
    addToFeed("Genesis Shift triggered. World map re-generated.", 'event');
    audio.playSync(); 
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      if (now.getUTCHours() === 0 && now.getUTCMinutes() === 0 && now.getUTCSeconds() === 0) {
        handleGenesisShift();
      }
    }, 1000);
    
    const handleKeyDown = (e: KeyboardEvent) => {
        // Debug Keybinds
        if (e.key === 'g' || e.key === 'G') handleGenesisShift();
        if ((e.key === 'o' || e.key === 'O') && sceneRef.current) {
             sceneRef.current.debugTriggerEvent('OBELISK');
             addToFeed("DEBUG: Spawning Obelisk...", 'alert');
        }
        if ((e.key === 'i' || e.key === 'I') && sceneRef.current) {
             sceneRef.current.debugTriggerEvent('STORM');
             addToFeed("DEBUG: Spawning Ion Storm...", 'alert');
        }

        if (['1', '2', '3', '4'].includes(e.key) && document.activeElement?.tagName !== 'INPUT') {
            const emoteMap: Record<string, string> = { '1': '👋', '2': '⚔️', '3': '💰', '4': '🛑' };
            if (profile.equippedCosmetics.emote) {
                const item = COSMETIC_CATALOG.find(c => c.id === profile.equippedCosmetics.emote);
                if (item && e.key === '5') {
                    sceneRef.current?.playEmote(item.value);
                    return;
                }
            }
            sceneRef.current?.playEmote(emoteMap[e.key]);
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
        clearInterval(interval);
        window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleGenesisShift, profile.equippedCosmetics]);

  // --- SHOP LOGIC ---
  const handlePurchase = (item: CosmeticItem) => {
    if (profile.gold >= item.cost) {
      setProfile(p => ({
        ...p,
        gold: p.gold - item.cost,
        ownedCosmetics: [...p.ownedCosmetics, item.id]
      }));
      audio.playUpgrade();
      addToFeed(`Purchased: ${item.name}`, 'info');
    }
  };

  const handleEquip = (item: CosmeticItem) => {
    setProfile(p => {
        const newEquipped = { ...p.equippedCosmetics, [item.type]: item.id };
        const tintItem = COSMETIC_CATALOG.find(c => c.id === newEquipped.tint);
        const auraItem = COSMETIC_CATALOG.find(c => c.id === newEquipped.aura);
        
        sceneRef.current?.updateCosmetics({
            tint: tintItem ? tintItem.value : undefined,
            aura: auraItem ? auraItem.value : undefined
        });
        return { ...p, equippedCosmetics: newEquipped };
    });
    addToFeed(`Equipped: ${item.name}`, 'info');
  };

  // --- GAME ACTIONS ---
  const handleCollectLoot = useCallback((type: string, amount: number, x: number, y: number) => {
      audio.playLoot();
      setProfile(p => ({
          ...p,
          inventory: { ...p.inventory, [type]: (p.inventory[type] || 0) + amount },
          xp: p.xp + 5
      }));
      sceneRef.current?.showFloatingText(x, y, `+${amount} ${type.toUpperCase()}`);
      
      if (type === 'gold' || type === 'obelisk') {
          addToFeed(`You found rare ${type.toUpperCase()}!`, 'loot');
      }
  }, []);

  const handleTileAction = useCallback(async (x: number, y: number) => {
    const currentUser = userRef.current;
    if (!currentUser.isLoggedIn) return;

    if (isBuildModeRef.current) {
      const success = placeStructure(x, y, currentUser.address);
      if (success) {
        audio.playSync();
        addToFeed(`Structure deployed at [${x},${y}]`, 'info');
        sceneRef.current?.updateTiles(getTiles());
      }
      return;
    }

    const res = await mineResource(x, y, currentUser.address);
    if (res.success) {
      audio.playMining();
      
      // PASS THE EQUIPPED IMPACT VALUE
      const impactId = profile.equippedCosmetics.impact;
      const impactItem = COSMETIC_CATALOG.find(c => c.id === impactId);
      const impactStyle = impactItem ? impactItem.value : 'standard';

      sceneRef.current?.onMiningImpact(x, y, (res as any).type, impactStyle);
      
      if (res.loot) {
        sceneRef.current?.spawnLoot(x, y, res.loot.type, res.loot.amount);
        if (res.loot.type === 'obelisk') {
             addToFeed(`SECTOR ${x},${y}: OBELISK DESTROYED`, 'event');
             audio.playUpgrade();
        }
      }
      sceneRef.current?.updateTiles(getTiles());
    }
  }, [profile.equippedCosmetics.impact]);

  const handleEventUpdate = (eventName: string | null) => {
      setActiveEventName(eventName);
      if (eventName) {
          audio.playSync();
          addToFeed(`EVENT TRIGGERED: ${eventName}`, 'event');
          sceneRef.current?.zoomToEvent(1.4);
      } else {
          sceneRef.current?.zoomToEvent(1.8); // Reset zoom
      }
  };

  useEffect(() => { if (sceneRef.current) sceneRef.current.setBuildMode(isBuildMode); }, [isBuildMode]);

  // --- PHASER BOOT ---
  useEffect(() => {
    if (!hasStarted) return;
    initializeGrid();
    const container = containerRef.current;
    if (!container) return;

    let initialized = false;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = Math.floor(entry.contentRect.width);
        const height = Math.floor(entry.contentRect.height);
        if (width > 10 && height > 10 && !initialized) {
          initialized = true;
          setTimeout(() => {
            if (gameRef.current) return;
            const config: Phaser.Types.Core.GameConfig = {
              type: Phaser.AUTO,
              parent: container,
              width: width, height: height,
              physics: { default: 'arcade', arcade: { gravity: { y: 0, x: 0 } } },
              scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH },
              scene: [new MainScene(handleTileAction, (msg) => addToFeed(msg, 'info'), handleCollectLoot, handleEventUpdate)],
              pixelArt: true, backgroundColor: '#000000', antialias: false,
            };
            try {
              const game = new Phaser.Game(config);
              gameRef.current = game;
              game.events.once('ready', () => {
                const scene = game.scene.getScene('MainScene') as MainScene;
                sceneRef.current = scene;
                scene.updateTiles(getTiles());
                scene.setBuildMode(isBuildModeRef.current);
                
                // --- APPLY COSMETICS ON START ---
                const tintItem = COSMETIC_CATALOG.find(c => c.id === profile.equippedCosmetics.tint);
                const auraItem = COSMETIC_CATALOG.find(c => c.id === profile.equippedCosmetics.aura);
                scene.updateCosmetics({
                    tint: tintItem ? tintItem.value : undefined,
                    aura: auraItem ? auraItem.value : undefined
                });

                scene.playLevelUpEffect();
              });
            } catch (e) { console.error("Phaser Init Error", e); initialized = false; }
          }, 100);
        }
      }
    });
    observer.observe(container);
    return () => { observer.disconnect(); if (gameRef.current) { gameRef.current.destroy(true); gameRef.current = null; sceneRef.current = null; } };
  }, [hasStarted, handleTileAction, handleCollectLoot]);

  const onConnectWallet = async () => {
    setShowAuthPrompt(false);
    const roninUser = await roninLogin();
    setUser({ ...roninUser, isGuest: false });
    addToFeed("Neural Link Established. Identity Verified.", 'alert');
    audio.playUpgrade();
  };

  const onStart = () => {
      setHasStarted(true);
      audio.playSync();
  };

  return (
    <div className="w-screen h-screen bg-black text-white overflow-hidden touch-none font-mono">
      <div id="phaser-container" ref={containerRef} className="absolute inset-0 w-full h-full min-w-[100px] min-h-[100px]" />
      
      {!hasStarted && (
        <div onClick={onStart} className="absolute inset-0 bg-black flex flex-col items-center justify-center z-[200] cursor-pointer hover:bg-zinc-950 transition-colors">
           <div className="flex flex-col items-center space-y-10 animate-fade-in">
             <div className="w-24 h-24 border-2 border-white/20 flex items-center justify-center rounded-full hover:border-white hover:scale-110 transition-all duration-300 group shadow-[0_0_50px_rgba(255,255,255,0.1)]">
                <span className="text-4xl ml-2 group-hover:text-white text-zinc-400 transition-colors">▶</span>
             </div>
             <div className="text-center space-y-4">
                 <h1 className="text-6xl font-black tracking-tighter text-white drop-shadow-2xl">RONIN REALMS</h1>
                 <p className="text-lg text-zinc-500 tracking-[0.3em] uppercase font-bold">Initialize Neural Link</p>
             </div>
           </div>
        </div>
      )}

      {hasStarted && (
        <HUD 
          user={user} profile={profile} feed={feed} 
          isBuildMode={isBuildMode} onToggleBuild={() => setIsBuildMode(!isBuildMode)}
          onSync={() => addToFeed("Data synced to chain.", 'info')} 
          onConnectWallet={() => setShowAuthPrompt(true)}
          onOpenShop={() => setShowShop(true)}
          onOpenLeaderboard={() => setShowLeaderboard(true)}
          onEmote={(emoji) => sceneRef.current?.playEmote(emoji)}
          onChat={(msg) => sceneRef.current?.playerChat(msg)}
          activeEvent={activeEventName}
        />
      )}

      {showAuthPrompt && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[150] flex items-center justify-center p-6">
           <div className="bg-zinc-900 border border-zinc-800 p-10 rounded-3xl max-w-md w-full text-center shadow-2xl">
                <h3 className="text-2xl font-black text-white mb-2 uppercase tracking-wide">Identify</h3>
                <p className="text-zinc-500 text-sm mb-8 leading-relaxed">Connect your Ronin Wallet to persist your extraction data and cosmetic upgrades.</p>
                <div className="flex flex-col gap-4">
                    <button onClick={onConnectWallet} className="w-full py-4 bg-white text-black font-black text-sm rounded-xl hover:bg-zinc-200 transition-colors tracking-widest uppercase">CONNECT RONIN</button>
                    <button onClick={() => setShowAuthPrompt(false)} className="text-xs text-zinc-600 hover:text-white uppercase tracking-widest transition-colors py-2">Cancel Sequence</button>
                </div>
           </div>
        </div>
      )}

      {showShop && <ShopModal profile={profile} onClose={() => setShowShop(false)} onPurchase={handlePurchase} onEquip={handleEquip} />}
      
      {showLeaderboard && (
        <Leaderboard 
            entries={[
                ...MOCK_LEADERBOARD, 
                { rank: 142, name: user.address.slice(0,8) || 'You', score: profile.xp, isUser: true }
            ].sort((a,b) => b.score - a.score)}
            onClose={() => setShowLeaderboard(false)} 
        />
      )}
    </div>
  );
};

export default App;
