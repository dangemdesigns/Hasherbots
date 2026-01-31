
export enum TileType {
  EMPTY = 'empty',
  AXITE = 'axite',
  GOLD = 'gold',
  CRYSTAL = 'crystal',
  STRUCTURE = 'structure',
  OBELISK = 'obelisk', // New Co-op objective
  LORE = 'lore'
}

export interface Structure {
  id: string;
  type: 'extractor' | 'beacon' | 'turret';
  level: number;
  owner: string;
}

export interface GameTile {
  x: number;
  y: number;
  type: TileType;
  durability: number;
  structure?: Structure;
  owner_id?: string;
}

export type CosmeticType = 'tint' | 'aura' | 'emote' | 'impact';

export interface CosmeticItem {
  id: string;
  name: string;
  type: CosmeticType;
  cost: number;
  value: any; // Hex color for tint, config for aura
  description: string;
}

export interface PlayerProfile {
  address: string;
  gold: number;
  xp: number;
  inventory: Record<string, number>;
  blueprints: string[];
  drillLevel: number;
  ownedCosmetics: string[]; // List of IDs
  equippedCosmetics: {
    tint?: string;
    aura?: string;
    emote?: string;
    impact?: string;
  };
}

export interface MiningResponse {
  success: boolean;
  message: string;
  loot?: {
    type: string;
    amount: number;
  };
  newDurability?: number;
}

export interface User {
  address: string;
  isLoggedIn: boolean;
  isGuest?: boolean;
}

export interface LeaderboardEntry {
  rank: number;
  name: string;
  score: number;
  isUser: boolean;
}

export interface FeedItem {
  id: string;
  text: string;
  type: 'info' | 'loot' | 'event' | 'alert';
  timestamp: number;
}
