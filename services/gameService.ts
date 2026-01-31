
import { MiningResponse, TileType, GameTile, Structure } from '../types';

let mockTiles: Map<string, GameTile> = new Map();
const WORLD_SIZE = 200; // Larger world for fog exploration

export const initializeGrid = () => {
  mockTiles.clear();
  for (let x = -WORLD_SIZE/4; x < WORLD_SIZE/4; x++) {
    for (let y = -WORLD_SIZE/4; y < WORLD_SIZE/4; y++) {
      // GUARANTEED STARTER CLUSTER (Radius 4 around spawn)
      if (Math.abs(x) <= 3 && Math.abs(y) <= 3) {
         if (x === 0 && y === 0) {
             mockTiles.set(`${x},${y}`, { x, y, type: TileType.EMPTY, durability: 0 });
         } else if (Math.random() > 0.4) {
             const type = Math.random() > 0.7 ? TileType.GOLD : TileType.AXITE;
             mockTiles.set(`${x},${y}`, { x, y, type, durability: 3 });
         } else {
             mockTiles.set(`${x},${y}`, { x, y, type: TileType.EMPTY, durability: 0 });
         }
         continue;
      }

      mockTiles.set(`${x},${y}`, generateTile(x, y));
    }
  }
};

// Spawn a massive boss node at random location
export const spawnEventNode = (): {x: number, y: number} | null => {
    // Find an empty spot within range
    for(let i=0; i<50; i++) {
        const x = Math.floor(Math.random() * 16) - 8;
        const y = Math.floor(Math.random() * 16) - 8;
        const key = `${x},${y}`;
        const tile = mockTiles.get(key);
        if (tile && (tile.type === TileType.EMPTY || tile.type === TileType.AXITE)) {
            tile.type = TileType.OBELISK;
            tile.durability = 50; // High HP
            return {x, y};
        }
    }
    return null;
};

// Re-rolls the world, effectively migrating resources
export const triggerGenesisShift = () => {
  console.log("Triggering Genesis Shift...");
  initializeGrid();
};

const generateTile = (x: number, y: number): GameTile => {
  const rand = Math.random();
  let type = TileType.EMPTY;
  let dur = 0;
  
  if (rand > 0.98) { type = TileType.CRYSTAL; dur = 12; }
  else if (rand > 0.95) { type = TileType.GOLD; dur = 7; }
  else if (rand > 0.90) { type = TileType.AXITE; dur = 4; } 
  
  return { x, y, type, durability: dur };
};

export const getTiles = (): GameTile[] => Array.from(mockTiles.values());

export const placeStructure = (x: number, y: number, owner: string): boolean => {
  const key = `${x},${y}`;
  const tile = mockTiles.get(key);
  if (tile && tile.type === TileType.EMPTY && !tile.structure) {
    tile.structure = {
      id: Math.random().toString(36).substr(2, 9),
      type: 'extractor',
      level: 1,
      owner
    };
    tile.type = TileType.STRUCTURE;
    return true;
  }
  return false;
};

export const mineResource = async (x: number, y: number, address: string): Promise<MiningResponse> => {
  await new Promise(r => setTimeout(r, 30));
  const key = `${x},${y}`;
  const tile = mockTiles.get(key);
  
  if (!tile || tile.durability <= 0) return { success: false, message: "Sector depleted." };
  
  tile.durability -= 1;
  if (tile.durability <= 0) {
    let amount = 1;
    if (tile.type === TileType.CRYSTAL) amount = 1;
    if (tile.type === TileType.AXITE) amount = 2;
    if (tile.type === TileType.GOLD) amount = 2;
    if (tile.type === TileType.OBELISK) amount = 10; // Jackpot

    const loot = { type: tile.type, amount };
    tile.type = TileType.EMPTY;
    return { success: true, message: "Handshake Complete: Asset Secured.", loot };
  }
  return { success: true, message: `Neural Link Stable. Durability: ${tile.durability}`, newDurability: tile.durability };
};
