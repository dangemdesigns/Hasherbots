
-- Profiles table for players linked by Ronin address
CREATE TABLE profiles (
  address TEXT PRIMARY KEY, -- 0x...
  gold BIGINT DEFAULT 0,
  xp INTEGER DEFAULT 0,
  inventory JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tiles table for the persistent 16x16 grid
CREATE TABLE tiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  x INTEGER NOT NULL,
  y INTEGER NOT NULL,
  type TEXT NOT NULL DEFAULT 'empty',
  durability INTEGER DEFAULT 5,
  owner_id TEXT REFERENCES profiles(address),
  UNIQUE(x, y)
);

-- Seed some resources (optional)
-- INSERT INTO tiles (x, y, type, durability) VALUES (5, 5, 'iron', 3);
-- INSERT INTO tiles (x, y, type, durability) VALUES (10, 2, 'gold', 5);
