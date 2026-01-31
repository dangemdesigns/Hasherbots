import Phaser from 'phaser';
import { GameTile, TileType } from '../types';
import { spawnEventNode } from '../services/gameService';

interface Ghost {
  id: string;
  name: string;
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Ellipse;
  nameTag: Phaser.GameObjects.Text;
  x: number; // Grid X
  y: number; // Grid Y
  target?: { x: number, y: number };
  state: 'IDLE' | 'MOVING' | 'MINING' | 'ASSIST' | 'FLEE'; // ASSIST = Co-op, FLEE = Danger
}

interface GameEvent {
    type: 'OBELISK' | 'STORM';
    active: boolean;
    x: number;
    y: number; // Screen coords for Storm
    timer: number;
    radius: number;
}

const GHOST_NAMES = ['Kael', 'Ria', 'Jinx', 'Vex', 'Neo', 'Echo', 'Drift', 'Flux', 'Cipher', 'Nova'];
const GHOST_PHRASES = [
    "Found gold!",
    "Lag?",
    "Anyone got blueprints?",
    "WAGMI",
    "Rich vein here.",
    "Nice skin.",
    "LFG",
    "Sector clear.",
    "Mining...",
    "Inventory full :("
];

export class MainScene extends Phaser.Scene {
  public add!: Phaser.GameObjects.GameObjectFactory;
  public load!: Phaser.Loader.LoaderPlugin;
  public make!: Phaser.GameObjects.GameObjectCreator;
  public textures!: Phaser.Textures.TextureManager;
  public cameras!: Phaser.Cameras.Scene2D.CameraManager;
  public input!: Phaser.Input.InputPlugin;
  public scale!: Phaser.Scale.ScaleManager;
  public tweens!: Phaser.Tweens.TweenManager;
  public time!: Phaser.Time.Clock;
  public sys!: Phaser.Scenes.Systems;
  public physics!: Phaser.Physics.Arcade.ArcadePhysics;
  public game!: Phaser.Game;

  private player!: Phaser.GameObjects.Container;
  private playerSprite!: Phaser.GameObjects.Sprite;
  private playerNameTag!: Phaser.GameObjects.Text;
  
  // Controls
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };

  // FX Containers
  private auraParticles?: Phaser.GameObjects.Particles.ParticleEmitter;
  
  private tileGroup!: Phaser.GameObjects.Group;
  private decoGroup!: Phaser.GameObjects.Group; 
  private resourceGroup!: Phaser.GameObjects.Group;
  private botGroup!: Phaser.GameObjects.Group;
  private lootGroup!: Phaser.Physics.Arcade.Group; 
  private eventGraphics!: Phaser.GameObjects.Graphics;
  private healthBars!: Phaser.GameObjects.Graphics;

  private tiles: Map<string, GameTile> = new Map();
  private ghosts: Ghost[] = [];
  
  private tileW2: number = 32;
  private tileH2: number = 16;
  private isBuildMode: boolean = false;
  private onTileClick: (x: number, y: number) => void;
  private onLog: (msg: string) => void;
  private onCollect: (type: string, amount: number, x: number, y: number) => void;
  private onEventUpdate: (name: string | null) => void;

  // Movement Tracking
  private moveTween: Phaser.Tweens.Tween | null = null;
  private bobTween: Phaser.Tweens.Tween | null = null;
  private isMoving: boolean = false;
  private currentTint: number = 0xffffff;

  // Optimization: Culling
  private lastRenderedPos: { x: number, y: number } = { x: -999, y: -999 };

  // Event System
  private currentEvent: GameEvent = { type: 'OBELISK', active: false, x: 0, y: 0, timer: 0, radius: 0 };

  constructor(
      onTileClick: (x: number, y: number) => void, 
      onLog: (msg: string) => void,
      onCollect: (type: string, amount: number, x: number, y: number) => void,
      onEventUpdate: (name: string | null) => void
  ) {
    super('MainScene');
    this.onTileClick = onTileClick;
    this.onLog = onLog;
    this.onCollect = onCollect;
    this.onEventUpdate = onEventUpdate;
  }

  preload() {
    // 1. ASSET LOADER
    // If you put images in an 'assets' folder in your public directory, 
    // the game will use them instead of the generated shapes.
    
    this.load.setPath('assets/');

    // Character
    this.load.image('ranger', 'ranger.png');

    // Tiles
    this.load.image('tile_grass', 'tile_grass.png');
    this.load.image('tile_dirt', 'tile_dirt.png');
    this.load.image('tile_stone', 'tile_stone.png');

    // Resources
    this.load.image('loot_gold', 'loot_gold.png');
    this.load.image('loot_axite', 'loot_axite.png');
    this.load.image('loot_crystal', 'loot_crystal.png');
    this.load.image('loot_obelisk', 'loot_obelisk.png');

    // Decor
    this.load.image('deco_tuft', 'deco_tuft.png');
    this.load.image('deco_flower_red', 'deco_flower_red.png');
  }

  create() {
    console.log("MainScene: Creating Living World...");
    
    // 2. Fallback Generation
    // We only generate textures if the external file failed to load (404)
    this.createIsometricTextures();
    this.createRangerTexture();
    this.createMobTextures();
    this.createParticleTextures();
    this.createLootTextures();

    // 3. Groups (Order matters for layering)
    this.tileGroup = this.add.group();
    this.decoGroup = this.add.group(); 
    this.resourceGroup = this.add.group();
    this.eventGraphics = this.add.graphics(); // Events drawn below players
    this.eventGraphics.setDepth(500);
    this.botGroup = this.add.group();
    this.healthBars = this.add.graphics(); // Health bars on top
    this.healthBars.setDepth(2500);

    this.lootGroup = this.physics.add.group({
        dragX: 800, // High drag for "pop and stop" effect
        dragY: 800,
        bounceX: 0.6,
        bounceY: 0.6
    });

    // 4. Player
    // Sprite is now 32x40 (from createRangerTexture). We align feet to 0,0.
    this.playerSprite = this.add.sprite(0, -22, 'ranger', 0).setScale(1.2);
    
    this.playerNameTag = this.add.text(0, -60, 'YOU', { 
        fontSize: '10px', fontStyle: 'bold', fill: '#fbbf24', stroke: '#000', strokeThickness: 3 
    }).setOrigin(0.5);

    this.player = this.add.container(0, 0, [
      this.add.ellipse(0, 0, 24, 12, 0x000000, 0.3), // Shadow
      this.playerSprite,
      this.playerNameTag
    ]);
    this.player.setDepth(1000);
    
    // Enable physics on container for Loot Detection & Knockback
    this.physics.world.enable(this.player);
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    // Set circle relative to container center (feet). 
    body.setCircle(14, -14, -14); 
    body.setDrag(800, 800); // Snappier stop

    // 5. Camera
    const cam = this.cameras.main;
    cam.startFollow(this.player, true, 0.1, 0.1);
    cam.setBackgroundColor('#1e293b'); 
    cam.setZoom(1.8);

    // 6. Input
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const worldPoint = cam.getWorldPoint(pointer.x, pointer.y);
      const tx = Math.round((worldPoint.x / this.tileW2 + worldPoint.y / this.tileH2) / 2);
      const ty = Math.round((worldPoint.y / this.tileH2 - worldPoint.x / this.tileW2) / 2);
      
      // Move to target, THEN callback to mine if close enough
      this.moveTo(tx, ty, () => {
          this.onTileClick(tx, ty);
      });
    });

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = this.input.keyboard!.addKeys({
        W: Phaser.Input.Keyboard.KeyCodes.W,
        A: Phaser.Input.Keyboard.KeyCodes.A,
        S: Phaser.Input.Keyboard.KeyCodes.S,
        D: Phaser.Input.Keyboard.KeyCodes.D
    }) as any;

    // 7. Initial Render
    if (this.tiles.size > 0) {
      this.renderWorld();
      this.spawnGhosts(8);
      this.highlightNearestResource(); 
    }

    // 8. Ghost AI Loop
    this.time.addEvent({ delay: 500, callback: () => this.updateGhostAI(), loop: true });

    // 9. Event Cycle Loop (Every 45 seconds)
    this.time.addEvent({ delay: 45000, callback: () => this.triggerRandomEvent(), loop: true });

    // 10. Idle FX Loop
    this.startIdleLoop();
    this.startIdleAnimation(); // Initial state
  }
  
  // --- EXTERNAL CONTROLS ---

  public setBuildMode(value: boolean) {
    this.isBuildMode = value;
  }

  public updateTiles(newTiles: GameTile[]) {
    this.tiles.clear();
    newTiles.forEach(t => this.tiles.set(`${t.x},${t.y}`, t));
    // When tiles update, we force a render
    if (this.tileGroup) this.renderWorld(true);
  }
  
  // New Feature: Snapshot for sharing
  public makeSnapshot(): Promise<string> {
      return new Promise((resolve) => {
          try {
              this.game.renderer.snapshot((image) => {
                  if (image instanceof HTMLImageElement) {
                      resolve(image.src);
                  } else {
                      resolve(''); // Fallback if snapshot fails
                  }
              });
          } catch (e) {
              console.error("Snapshot failed", e);
              resolve('');
          }
      });
  }

  // --- RENDERING (OPTIMIZED) ---

  private renderWorld(force: boolean = false) {
    if (!this.player) return;

    const cx = Math.round((this.player.x / this.tileW2 + this.player.y / this.tileH2) / 2);
    const cy = Math.round((this.player.y / this.tileH2 - this.player.x / this.tileW2) / 2);
    
    // Optimization: Only render if player moved significantly (chunking)
    if (!force && Math.abs(cx - this.lastRenderedPos.x) < 5 && Math.abs(cy - this.lastRenderedPos.y) < 5) {
        return;
    }
    
    this.lastRenderedPos = { x: cx, y: cy };
    
    this.tileGroup.clear(true, true);
    this.decoGroup.clear(true, true);
    this.resourceGroup.clear(true, true);

    const range = 20; // Visible radius
    
    // Render loop around player
    for (let x = cx - range; x <= cx + range; x++) {
        for (let y = cy - range; y <= cy + range; y++) {
            const pos = this.isoToScreen(x, y);
            const tile = this.tiles.get(`${x},${y}`);
            
            // Generate deterministic "random" for terrain
            const pseudoRand = this.getPseudoRandom(x, y);

            // Base Texture
            let tex = 'tile_grass';
            if (pseudoRand > 0.6) tex = 'tile_dirt';
            if (tile && (tile.type === TileType.STRUCTURE || tile.type === TileType.OBELISK)) tex = 'tile_stone';
            
            const spr = this.add.sprite(pos.x, pos.y, tex);
            spr.setDepth(pos.y);
            spr.setInteractive({ pixelPerfect: true });
            this.tileGroup.add(spr);

            // Decoration (Grass tufts, flowers)
            if ((!tile || tile.type === TileType.EMPTY) && pseudoRand > 0.85) {
                const dKey = pseudoRand > 0.95 ? 'deco_flower_red' : 'deco_tuft';
                const deco = this.add.sprite(pos.x, pos.y - 8, dKey);
                deco.setDepth(pos.y + 1);
                this.decoGroup.add(deco);
            }

            // Resources & Structures
            if (tile && tile.durability > 0 && tile.type !== TileType.EMPTY) {
                if (tile.type === TileType.OBELISK) {
                    const ob = this.add.sprite(pos.x, pos.y - 24, 'loot_obelisk').setScale(2);
                    if (!this.textures.exists('loot_obelisk')) ob.setTint(0x334155); // Tint only if using fallback

                    ob.setDepth(pos.y + 15);
                    this.resourceGroup.add(ob);

                    const glow = this.add.sprite(pos.x, pos.y - 24, 'glow_particle').setScale(3).setTint(0xff0000).setAlpha(0.5);
                    glow.setDepth(pos.y + 16);
                    this.tweens.add({ targets: glow, alpha: 0.2, scaleX: 3.5, scaleY: 3.5, duration: 2000, yoyo: true, repeat: -1 });
                    this.resourceGroup.add(glow);

                } else if (tile.type === TileType.STRUCTURE) {
                    const s = this.add.rectangle(pos.x, pos.y - 12, 12, 24, 0x3b82f6);
                    const top = this.add.rectangle(pos.x, pos.y - 24, 12, 4, 0x60a5fa);
                    s.setDepth(pos.y + 10);
                    top.setDepth(pos.y + 11);
                    this.resourceGroup.add(s);
                    this.resourceGroup.add(top);
                } else if (tile.type === TileType.LORE) {
                    // NEW: Micro Lore Object (A mysterious pulsing monolith fragment)
                    const loreObj = this.add.sprite(pos.x, pos.y - 16, 'loot_crystal').setTint(0x3b82f6).setScale(0.8);
                    loreObj.setDepth(pos.y + 15);
                    this.resourceGroup.add(loreObj);

                    // Pulsing effect
                    this.tweens.add({
                        targets: loreObj,
                        alpha: 0.6,
                        scaleX: 1.0, scaleY: 1.0,
                        duration: 1500,
                        yoyo: true,
                        repeat: -1
                    });
                    
                    // Question mark floating above
                    const q = this.add.text(pos.x, pos.y - 40, '?', { fontSize: '12px', fontStyle: 'bold', color: '#60a5fa' }).setOrigin(0.5);
                    q.setDepth(pos.y + 20);
                    this.resourceGroup.add(q);
                    this.tweens.add({ targets: q, y: '-=5', duration: 1000, yoyo: true, repeat: -1 });

                } else {
                    let k = 'loot_axite';
                    if (tile.type === TileType.GOLD) k = 'loot_gold';
                    if (tile.type === TileType.CRYSTAL) k = 'loot_crystal';
                    
                    const r = this.add.sprite(pos.x, pos.y - 12, k);
                    r.setDepth(pos.y + 5);
                    this.resourceGroup.add(r);
                    
                    this.tweens.add({
                        targets: r, y: pos.y - 16, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
                    });
                }
            }
        }
    }
  }

  // --- GHOSTS ---

  private spawnGhosts(count: number) {
      // Clear existing
      this.ghosts.forEach(g => {
          g.sprite.destroy(); g.shadow.destroy(); g.nameTag.destroy();
      });
      this.ghosts = [];

      for(let i=0; i<count; i++) {
          const gx = Phaser.Math.Between(-8, 8);
          const gy = Phaser.Math.Between(-8, 8);
          const pos = this.isoToScreen(gx, gy);

          const shadow = this.add.ellipse(pos.x, pos.y, 20, 10, 0x000000, 0.4);
          
          const sprite = this.add.sprite(pos.x, pos.y - 22, 'ranger').setScale(1.2);
          // Only tint if we are using the fallback geometric texture
          if (!this.textures.exists('ranger')) {
              sprite.setTint(0x94a3b8);
          }

          const name = GHOST_NAMES[i % GHOST_NAMES.length];
          const tag = this.add.text(pos.x, pos.y - 60, name, {
              fontSize: '10px', fontFamily: 'monospace', color: '#fff', backgroundColor: '#00000088'
          }).setOrigin(0.5).setPadding(2,2,2,2);

          this.botGroup.add(shadow);
          this.botGroup.add(sprite);
          this.botGroup.add(tag);

          this.ghosts.push({
              id: `ghost-${i}`, name, sprite, shadow, nameTag: tag, x: gx, y: gy, state: 'IDLE'
          });
      }
  }

  // Optimized AI with Spatial Check
  private updateGhostAI() {
      this.ghosts.forEach(g => {
          if (g.state === 'MOVING') return;
          
          // Panic logic
          if (this.currentEvent.active && this.currentEvent.type === 'STORM') {
               const dist = Phaser.Math.Distance.Between(g.sprite.x, g.sprite.y, this.currentEvent.x, this.currentEvent.y);
               if (dist < this.currentEvent.radius) {
                   g.state = 'FLEE';
                   const angle = Phaser.Math.Angle.Between(this.currentEvent.x, this.currentEvent.y, g.sprite.x, g.sprite.y);
                   const tx = Math.round(g.x + Math.cos(angle) * 3);
                   const ty = Math.round(g.y + Math.sin(angle) * 3);
                   this.moveGhost(g, tx, ty);
                   return;
               }
          }

          if (this.currentEvent.active && this.currentEvent.type === 'OBELISK' && g.state !== 'ASSIST') {
              if (Math.random() < 0.02) {
                  g.state = 'ASSIST';
                  this.moveGhost(g, this.currentEvent.x, this.currentEvent.y);
                  this.showChatBubble(g.sprite.x, g.sprite.y, "To the Obelisk!");
                  return;
              }
          }

          // Optimized: Only scan local area (7x7 grid)
          let targetResource = null;
          if (Math.random() > 0.7) {
              for(let dx = -3; dx <= 3; dx++) {
                  for(let dy = -3; dy <= 3; dy++) {
                      if (dx===0 && dy===0) continue;
                      const tile = this.tiles.get(`${g.x + dx},${g.y + dy}`);
                      if (tile && tile.durability > 0 && tile.type !== TileType.EMPTY) {
                          targetResource = { x: g.x + dx, y: g.y + dy };
                          break; 
                      }
                  }
                  if (targetResource) break;
              }
          }

          if (targetResource) {
               this.moveGhost(g, targetResource.x, targetResource.y);
          } else if (Math.random() < 0.05) {
              const dx = Phaser.Math.Between(-1, 1);
              const dy = Phaser.Math.Between(-1, 1);
              if (dx !== 0 || dy !== 0) {
                  this.moveGhost(g, g.x + dx, g.y + dy);
              }
          } else if (Math.random() < 0.01) {
              const phrase = GHOST_PHRASES[Phaser.Math.Between(0, GHOST_PHRASES.length - 1)];
              this.showChatBubble(g.sprite.x, g.sprite.y, phrase);
          }
      });
  }

  private moveGhost(g: Ghost, tx: number, ty: number) {
      g.state = 'MOVING';
      const start = this.isoToScreen(g.x, g.y);
      const end = this.isoToScreen(tx, ty);
      
      g.sprite.setFlipX(end.x < start.x);

      this.tweens.add({
          targets: [g.sprite, g.shadow, g.nameTag],
          x: end.x,
          y: (t: any) => t === g.sprite ? end.y - 22 : (t === g.shadow ? end.y : end.y - 60),
          duration: Phaser.Math.Distance.Between(start.x, start.y, end.x, end.y) * 6,
          onComplete: () => {
              g.x = tx; g.y = ty;
              g.state = 'IDLE';
              
              // Simulate mining if landed on resource
              const tile = this.tiles.get(`${tx},${ty}`);
              if (tile && (tile.type === TileType.GOLD || tile.type === TileType.AXITE)) {
                   this.tweens.add({
                       targets: g.sprite,
                       scaleY: 1.1, scaleX: 1.3, yoyo: true, duration: 100, repeat: 2
                   });
              }
          }
      });
      
      this.tweens.add({
          targets: g.sprite, y: '-=4', duration: 150, yoyo: true, repeat: -1
      });
  }

  public showFloatingText(gx: number, gy: number, text: string, color: string = '#ffffff') {
      const pos = this.isoToScreen(gx, gy);
      const t = this.add.text(pos.x, pos.y - 40, text, {
          fontSize: '12px', fontFamily: 'monospace', fontStyle: 'bold',
          color: color, stroke: '#000', strokeThickness: 3
      }).setOrigin(0.5).setDepth(3000);
      
      this.tweens.add({
          targets: t, y: '-=40', alpha: 0, duration: 1000,
          onComplete: () => t.destroy()
      });
  }

  // --- JUICE EFFECTS ---

  public zoomToEvent(zoomLevel: number) {
      this.tweens.add({
          targets: this.cameras.main,
          zoom: zoomLevel,
          duration: 1000,
          ease: 'Sine.easeInOut'
      });
  }

  public playLevelUpEffect() {
      if (!this.player) return;
      const x = this.player.x;
      const y = this.player.y;

      // Ring
      const ring = this.add.ellipse(x, y, 10, 5);
      ring.setStrokeStyle(2, 0xfacc15);
      this.tweens.add({
          targets: ring,
          scaleX: 5, scaleY: 5,
          alpha: 0,
          duration: 800,
          onComplete: () => ring.destroy()
      });

      // Confetti
      for(let i=0; i<15; i++) {
          const p = this.add.rectangle(x, y - 20, 4, 4, Phaser.Display.Color.RandomRGB().color);
          this.tweens.add({
              targets: p,
              x: x + (Math.random() - 0.5) * 60,
              y: y - 80 - Math.random() * 40,
              alpha: 0,
              duration: 1000,
              ease: 'Back.easeOut',
              onComplete: () => p.destroy()
          });
      }

      this.showFloatingText(x/this.tileW2, y/this.tileH2, "LINK ESTABLISHED", '#ffffff');
  }

  // --- EVENT SYSTEM ---
  
  public debugTriggerEvent(type: 'OBELISK' | 'STORM') {
      if (type === 'OBELISK') this.startObeliskEvent();
      else if (type === 'STORM') this.startIonStormEvent();
  }

  private triggerRandomEvent() {
      // 50/50 Chance
      if (Math.random() > 0.5) {
          this.startObeliskEvent();
      } else {
          this.startIonStormEvent();
      }
  }

  private startObeliskEvent() {
      const coord = spawnEventNode();
      if (!coord) return;

      this.currentEvent = {
          type: 'OBELISK',
          active: true,
          x: coord.x,
          y: coord.y,
          timer: 30, // 30 seconds to mine it
          radius: 0
      };

      // Notify App
      this.onEventUpdate('ANCIENT OBELISK');
      this.cameras.main.flash(500, 255, 215, 0);

      // Force update grid to show the new tile
      const t = this.tiles.get(`${coord.x},${coord.y}`);
      if(t) {
          t.type = TileType.OBELISK;
          t.durability = 50;
      }
      this.renderWorld(true); // Redraw to show the Obelisk

      // Command Ghosts to help!
      this.ghosts.forEach(g => {
          if (Math.random() > 0.3) {
             g.state = 'ASSIST';
             this.showChatBubble(g.sprite.x, g.sprite.y, "Moving to Obelisk!");
             this.moveGhost(g, coord.x, coord.y);
          }
      });
  }

  private startIonStormEvent() {
      // Spawn storm centered on player to force movement
      const screenPos = { x: this.player.x, y: this.player.y };
      
      this.currentEvent = {
          type: 'STORM',
          active: true,
          x: screenPos.x,
          y: screenPos.y,
          timer: 20,
          radius: 300 // Starts big, shrinks
      };

      this.onEventUpdate('ION STORM');
      this.cameras.main.shake(1000, 0.02);

      // Ghosts flee!
      this.ghosts.forEach(g => {
          g.state = 'FLEE';
          // Run away from storm center
          const angle = Phaser.Math.Angle.Between(screenPos.x, screenPos.y, g.sprite.x, g.sprite.y);
          const tx = Math.round(g.x + Math.cos(angle) * 10);
          const ty = Math.round(g.y + Math.sin(angle) * 10);
          this.showChatBubble(g.sprite.x, g.sprite.y, "RUN!!");
          this.moveGhost(g, tx, ty);
      });
  }

  private updateEvents() {
      if (!this.currentEvent.active) return;

      this.eventGraphics.clear();

      if (this.currentEvent.type === 'STORM') {
          // Shrink Radius
          this.currentEvent.radius -= 0.5;
          if (this.currentEvent.radius < 50) this.currentEvent.radius = 50;

          // Draw Danger Zone
          this.eventGraphics.lineStyle(4, 0xff0000, 1);
          this.eventGraphics.strokeCircle(this.currentEvent.x, this.currentEvent.y, this.currentEvent.radius);
          this.eventGraphics.fillStyle(0xff0000, 0.2);
          this.eventGraphics.fillCircle(this.currentEvent.x, this.currentEvent.y, this.currentEvent.radius);

          // Physics Check (Player)
          const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.currentEvent.x, this.currentEvent.y);
          if (dist < this.currentEvent.radius) {
              // INSIDE STORM = BAD (Wind Push)
              if (this.player.body) {
                  // Push player OUTWARD based on angle
                  const angle = Phaser.Math.Angle.Between(this.currentEvent.x, this.currentEvent.y, this.player.x, this.player.y);
                  const body = this.player.body as Phaser.Physics.Arcade.Body;
                  // Add wind velocity
                  body.velocity.x += Math.cos(angle) * 10;
                  body.velocity.y += Math.sin(angle) * 10;
                  
                  // Damage/Shake occasionally
                  if (Math.random() > 0.95) {
                      this.cameras.main.shake(100, 0.005);
                      this.playerSprite.setTint(0xff0000);
                      
                      // FIXED: Restore the equipped tint instead of clearing all tint
                      this.time.delayedCall(100, () => {
                          if (this.currentTint !== 0xffffff) {
                              this.playerSprite.setTint(this.currentTint);
                          } else {
                              this.playerSprite.clearTint();
                          }
                      });
                  }
              }
          }
          
      } else if (this.currentEvent.type === 'OBELISK') {
         // Draw Safe/Goal Zone
         const pos = this.isoToScreen(this.currentEvent.x, this.currentEvent.y);
         this.eventGraphics.lineStyle(4, 0xfacc15, 1);
         this.eventGraphics.strokeCircle(pos.x, pos.y, 60);
         this.eventGraphics.fillStyle(0xfacc15, 0.1 + Math.random() * 0.1); // Pulse
         this.eventGraphics.fillCircle(pos.x, pos.y, 60);
      }

      // Timer Tick
      this.currentEvent.timer -= 0.016; // approx 60fps
      if (this.currentEvent.timer <= 0) {
          this.currentEvent.active = false;
          this.eventGraphics.clear();
          this.onEventUpdate(null);
      }
  }

  // --- STANDARD GAME LOOP ---

  private highlightNearestResource() {
    const resources = Array.from(this.tiles.values())
        .filter(t => (t.type === TileType.GOLD || t.type === TileType.AXITE || t.type === TileType.CRYSTAL) && t.durability > 0);
    
    if (resources.length > 0) {
        const closest = resources.sort((a,b) => {
            const da = Math.abs(a.x) + Math.abs(a.y);
            const db = Math.abs(b.x) + Math.abs(b.y);
            return da - db;
        })[0];
        const pos = this.isoToScreen(closest.x, closest.y);
        const ring = this.add.ellipse(pos.x, pos.y, 40, 20);
        ring.setStrokeStyle(2, 0xffffff);
        ring.setDepth(pos.y + 20);
        this.tweens.add({
            targets: ring,
            scaleX: 1.5,
            scaleY: 1.5,
            alpha: 0,
            duration: 1000,
            repeat: 3,
            onComplete: () => ring.destroy()
        });
    }
  }

  update() {
    this.updateEvents();

    // 1. Ghost & Rendering Updates
    this.ghosts.forEach(g => {
        const zIndex = g.shadow.y + 10;
        g.sprite.setDepth(zIndex);
        g.shadow.setDepth(zIndex - 1);
        g.nameTag.setDepth(zIndex + 100);
        g.nameTag.setPosition(g.sprite.x, g.sprite.y - 45);
    });
    this.player.setDepth(this.player.y + 1000);

    // 2. WASD Movement Logic
    if (document.activeElement?.tagName !== 'INPUT') {
        const speed = 200;
        const body = this.player.body as Phaser.Physics.Arcade.Body;
        let vx = 0;
        let vy = 0;

        if (this.wasd.W.isDown || this.cursors.up.isDown) vy = -speed;
        if (this.wasd.S.isDown || this.cursors.down.isDown) vy = speed;
        if (this.wasd.A.isDown || this.cursors.left.isDown) vx = -speed;
        if (this.wasd.D.isDown || this.cursors.right.isDown) vx = speed;

        if (vx !== 0 || vy !== 0) {
            // Movement started
            this.isMoving = true;
            if (this.moveTween && this.moveTween.isPlaying()) this.moveTween.stop();

            if (vx !== 0 && vy !== 0) {
                vx *= 0.707;
                vy *= 0.707;
            }

            body.setVelocity(vx, vy);

            if (vx < 0) this.playerSprite.setFlipX(true);
            else if (vx > 0) this.playerSprite.setFlipX(false);

            // Fast Bob (Running)
            if (!this.bobTween || this.bobTween.duration > 200 || !this.bobTween.isPlaying()) {
                if (this.bobTween) this.bobTween.stop();
                this.bobTween = this.tweens.add({
                    targets: this.playerSprite,
                    y: '-=3', // Relative jump
                    scaleY: 0.95, // Squish
                    duration: 120, 
                    yoyo: true,
                    repeat: -1,
                    ease: 'Sine.easeInOut'
                });
            }
        } else {
            // Movement stopped (Keys released)
            if (!this.moveTween?.isPlaying()) {
                if (Math.abs(body.velocity.x) > 20 || Math.abs(body.velocity.y) > 20) {
                     body.setDrag(800, 800);
                } else {
                     body.setVelocity(0, 0);
                     // Transition to Idle
                     if (this.isMoving) {
                         this.isMoving = false;
                         this.startIdleAnimation();
                     }
                }
            }
        }
    }

    // 3. Loot Magnetism
    if (this.player && this.lootGroup) {
        this.lootGroup.getChildren().forEach((go) => {
            const item = go as Phaser.Physics.Arcade.Sprite;
            item.setDepth(item.y + 5);
            const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, item.x, item.y);
            
            if (dist < 150 && item.getData('readyToCollect')) {
                this.physics.moveToObject(item, this.player, 400); 
            }

            if (dist < 20 && item.getData('readyToCollect')) {
                const type = item.getData('type');
                const amount = item.getData('amount');
                this.onCollect(type, amount, Math.round((this.player.x / this.tileW2 + this.player.y / this.tileH2) / 2), Math.round((this.player.y / this.tileH2 - this.player.x / this.tileW2) / 2));
                item.destroy();
                
                this.tweens.add({
                    targets: this.playerSprite,
                    scaleX: 1.4, scaleY: 0.8,
                    duration: 100, yoyo: true
                });
            }
        });
    }
    
    // 4. Update Aura Depth (Always behind player)
    // CRITICAL FIX: Check if auraParticles exists and is Active before using
    if (this.auraParticles && this.auraParticles.active && this.player) {
        this.auraParticles.setDepth(this.player.depth - 1);
    }

    // 5. Update Render Culling (Chunking)
    this.renderWorld();
  }

  // --- LOOT PHYSICS (POP ROCKS) ---

  public spawnLoot(gx: number, gy: number, type: string, amount: number) {
      const pos = this.isoToScreen(gx, gy);
      
      // Explosion of items
      for (let i=0; i < amount; i++) {
          const loot = this.physics.add.sprite(pos.x, pos.y - 16, 'loot_' + type.toLowerCase());
          this.lootGroup.add(loot);
          
          // Initial Pop State
          loot.setScale(0.5);
          loot.setData('type', type);
          loot.setData('amount', 1); // Each orb is 1 unit
          loot.setData('readyToCollect', false);

          // Explosive Velocity
          const angle = Math.random() * Math.PI * 2;
          const speed = Phaser.Math.Between(250, 450); // Faster initial burst
          loot.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
          
          // "Jump" Tween (Y-axis simulation)
          // Moves sprite UP then DOWN relative to its physics body to simulate gravity arc
          this.tweens.add({
              targets: loot,
              y: '-=40', // Pop up
              scaleX: 1.2, scaleY: 1.2, // Expand
              duration: 300,
              yoyo: true,
              ease: 'Sine.easeOut'
          });

          // Delay magnetization to let them settle
          this.time.delayedCall(700, () => {
              loot.setData('readyToCollect', true);
          });
      }
  }

  // --- SOCIAL FX ---
  
  public playerChat(msg: string) {
      this.showChatBubble(this.player.x, this.player.y, msg);
      
      // Ghosts react
      const nearby = this.ghosts.filter(g => Phaser.Math.Distance.Between(g.sprite.x, g.sprite.y, this.player.x, this.player.y) < 200);
      nearby.forEach(g => {
          this.time.delayedCall(1000 + Math.random() * 1000, () => {
              const replies = ["Nice!", "gm", "lol", "True", "What?", "Invite?"];
              this.showChatBubble(g.sprite.x, g.sprite.y, replies[Math.floor(Math.random() * replies.length)]);
          });
      });
  }

  public playEmote(emoji: string) {
      if (!this.player) return;

      const text = this.add.text(this.player.x, this.player.y - 45, emoji, {
          fontSize: '24px',
          fontFamily: 'Segoe UI Emoji',
          resolution: 2
      }).setOrigin(0.5);
      
      text.setDepth(2000); 

      this.tweens.add({
          targets: text,
          y: '-=40',
          scale: { start: 0.5, end: 1.5 },
          alpha: { start: 1, end: 0 },
          duration: 1500,
          ease: 'Back.easeOut',
          onComplete: () => text.destroy()
      });
  }

  private showChatBubble(x: number, y: number, text: string) {
      const container = this.add.container(x, y - 60);
      container.setDepth(5000); 

      const bubbleText = this.add.text(0, 0, text, {
          fontSize: '10px',
          fontFamily: 'monospace',
          color: '#0f172a',
          align: 'center',
          wordWrap: { width: 120 }
      }).setOrigin(0.5);

      const padding = 8;
      const bounds = bubbleText.getBounds();
      const bg = this.make.graphics({ x: 0, y: 0, add: false });
      bg.fillStyle(0xffffff, 1);
      bg.fillRoundedRect(-bounds.width/2 - padding, -bounds.height/2 - padding, bounds.width + padding*2, bounds.height + padding*2, 8);
      
      bg.beginPath();
      bg.moveTo(0, bounds.height/2 + padding);
      bg.lineTo(-5, bounds.height/2 + padding + 5);
      bg.lineTo(5, bounds.height/2 + padding + 5);
      bg.fillPath();

      container.add([bg, bubbleText]);

      container.setScale(0);
      this.tweens.add({
          targets: container,
          scaleX: 1, scaleY: 1,
          duration: 200,
          ease: 'Back.easeOut'
      });

      this.time.delayedCall(4000, () => {
          this.tweens.add({
              targets: container,
              alpha: 0, y: '-=20',
              duration: 500,
              onComplete: () => container.destroy()
          });
      });
  }

  // --- VISUAL FX ---

  public updateCosmetics(config: { tint?: number, aura?: string }) {
    if (this.playerSprite) {
      if (config.tint) {
        this.currentTint = config.tint;
        this.playerSprite.setTint(config.tint);
      } else {
        this.currentTint = 0xffffff;
        this.playerSprite.clearTint();
      }
    }

    // FIX: Safely destroy old particles
    if (this.auraParticles) {
      this.auraParticles.destroy();
      this.auraParticles = undefined;
    }

    // All auras spawn behind the player via update loop depth management
    if (config.aura === 'cyber_trail') {
      this.auraParticles = this.add.particles(0, 0, 'particle_pixel', {
        speed: { min: 10, max: 40 },
        angle: { min: 0, max: 360 },
        scale: { start: 0.8, end: 0 },
        alpha: { start: 1, end: 0 },
        lifespan: 600,
        tint: 0x00ffff,
        blendMode: 'ADD'
      });
      this.auraParticles.startFollow(this.player, 0, -12);
      this.auraParticles.setDepth(900); // Initial depth, updated in loop
    } else if (config.aura === 'void_smoke') {
      this.auraParticles = this.add.particles(0, 0, 'particle_soft', {
        speedY: { min: -10, max: -30 },
        scale: { start: 1, end: 2 },
        alpha: { start: 0.5, end: 0 },
        lifespan: 1000,
        tint: 0x4c1d95,
        frequency: 100
      });
      this.auraParticles.startFollow(this.player, 0, -12);
    } else if (config.aura === 'binary_code') {
      // UPGRADED: Digital Matrix Field
      this.auraParticles = this.add.particles(0, 0, 'particle_binary', {
        lifespan: 1200,
        scale: { start: 1.2, end: 0.5 },
        alpha: { start: 1, end: 0 },
        speedY: { min: 10, max: 30 }, // Rains down slowly
        tint: 0x00ff00,
        blendMode: 'ADD',
        frequency: 40,
        emitZone: {
            source: new Phaser.Geom.Rectangle(-12, -35, 24, 25), // Surrounds player
            type: 'random'
        }
      });
      this.auraParticles.startFollow(this.player, 0, 0); 
    } else if (config.aura === 'pixel_fire') {
      this.auraParticles = this.add.particles(0, 0, 'particle_fire', {
        speedY: { min: -20, max: -50 },
        speedX: { min: -10, max: 10 },
        scale: { start: 1, end: 0.5 },
        alpha: { start: 1, end: 0 },
        lifespan: 500,
        frequency: 30,
        blendMode: 'ADD'
      });
      this.auraParticles.startFollow(this.player, 0, -12);
    }
  }

  public playGenesisShiftEffect() {
      this.cameras.main.flash(2000, 200, 255, 230);
      this.cameras.main.shake(1000, 0.01);

      if (this.player) {
          for(let i=0; i<30; i++) {
              const x = this.player.x + (Math.random() - 0.5) * 800;
              const y = this.player.y + (Math.random() - 0.5) * 600;
              
              const p = this.add.rectangle(x, y, Math.random() * 4 + 2, Math.random() * 4 + 2, 0xffffff);
              p.setDepth(2000);
              
              this.tweens.add({
                  targets: p,
                  y: y - 150 - Math.random() * 100,
                  alpha: { start: 0.8, end: 0 },
                  scale: { start: 1, end: 0 },
                  duration: 2000 + Math.random() * 1000,
                  ease: 'Sine.easeOut',
                  onComplete: () => p.destroy()
              });
          }
      }
  }

  // --- MINING HARMONY (COMBO SYSTEM) ---

  public onMiningImpact(x: number, y: number, type: TileType, impactStyle: string = 'standard') {
    const cam = this.cameras.main;
    const pos = this.isoToScreen(x, y);

    // 1. Damage Number Popup
    this.showFloatingText(x, y, "-1 HP", '#ef4444');

    // 2. Base Shake
    let shakeIntensity = 0.002;
    if (type === TileType.CRYSTAL) shakeIntensity = 0.01;
    if (type === TileType.OBELISK) shakeIntensity = 0.03; 

    // 3. Check for "Mining Harmony" (Squad Combo)
    // Count ghosts currently mining this tile (distance check)
    let squadCount = 0;
    this.ghosts.forEach(g => {
        // Simple distance check in grid coords
        if (Math.abs(g.x - x) <= 1 && Math.abs(g.y - y) <= 1 && g.state === 'MINING') {
            squadCount++;
        }
    });

    if (squadCount > 0) {
         this.showFloatingText(x, y, `COMBO x${squadCount}!`, '#fcd34d');
    }
  }

  // --- MISSING METHODS IMPLEMENTATION ---

  private createIsometricTextures() {
    // Only generate if we didn't load external assets
    if (this.textures.exists('tile_grass')) return;

    const graphics = this.make.graphics({ x: 0, y: 0, add: false });

    // Grass
    graphics.fillStyle(0x10b981); // Emerald-500
    graphics.beginPath();
    graphics.moveTo(0, 16);
    graphics.lineTo(32, 0);
    graphics.lineTo(64, 16);
    graphics.lineTo(32, 32);
    graphics.closePath();
    graphics.fill();
    graphics.generateTexture('tile_grass', 64, 32);
    graphics.clear();

    // Dirt
    graphics.fillStyle(0x78350f); // Amber-900
    graphics.beginPath();
    graphics.moveTo(0, 16);
    graphics.lineTo(32, 0);
    graphics.lineTo(64, 16);
    graphics.lineTo(32, 32);
    graphics.closePath();
    graphics.fill();
    graphics.generateTexture('tile_dirt', 64, 32);
    graphics.clear();

    // Stone
    graphics.fillStyle(0x475569); // Slate-600
    graphics.beginPath();
    graphics.moveTo(0, 16);
    graphics.lineTo(32, 0);
    graphics.lineTo(64, 16);
    graphics.lineTo(32, 32);
    graphics.closePath();
    graphics.fill();
    graphics.generateTexture('tile_stone', 64, 32);
    graphics.clear();
  }

  private createRangerTexture() {
    // Only generate if we didn't load external assets
    if (this.textures.exists('ranger')) return;

    const graphics = this.make.graphics({ x: 0, y: 0, add: false });

    // --- LEGS (Dark Grey) ---
    graphics.fillStyle(0x1e293b);
    graphics.fillRect(11, 34, 4, 6);
    graphics.fillRect(17, 34, 4, 6);

    // --- ARMS (Background/Behind body parts) ---
    // Red upper arms
    graphics.fillStyle(0xdc2626); // Red-600
    graphics.fillRect(4, 26, 4, 8); // Left
    graphics.fillRect(24, 26, 4, 8); // Right
    
    // Blue Forearms
    graphics.fillStyle(0x1d4ed8); // Blue-700
    graphics.fillRoundedRect(2, 32, 6, 6, 2);
    graphics.fillRoundedRect(24, 32, 6, 6, 2);

    // --- TORSO ---
    // Main Body Blue
    graphics.fillStyle(0x1d4ed8); // Blue-700
    graphics.fillRoundedRect(8, 20, 16, 16, 2);
    
    // Black Chevron
    graphics.fillStyle(0x0f172a); // Slate-900
    graphics.beginPath();
    graphics.moveTo(8, 26);
    graphics.lineTo(16, 32);
    graphics.lineTo(24, 26);
    graphics.lineTo(24, 30);
    graphics.lineTo(16, 36);
    graphics.lineTo(8, 30);
    graphics.closePath();
    graphics.fill();

    // --- HEAD ---
    // Left Red Antenna
    graphics.fillStyle(0xdc2626); // Red
    graphics.fillRect(2, 6, 4, 10);
    graphics.fillRect(0, 8, 2, 3); // Detail

    // Main Head Blue
    graphics.fillStyle(0x1d4ed8); // Blue-700
    graphics.fillRoundedRect(4, 2, 24, 18, 4);

    // Black Cap/Forehead
    graphics.fillStyle(0x0f172a); // Slate-900
    // Replaces the bezier curves
    graphics.fillRoundedRect(4, 2, 24, 9, { tl: 4, tr: 4, bl: 2, br: 2 });
    
    // Shiny Highlight on cap
    graphics.fillStyle(0xffffff);
    graphics.setAlpha(0.6);
    graphics.fillEllipse(20, 4, 6, 2);
    graphics.setAlpha(1.0);

    // Eyes (Big White Circles)
    const eyeY = 11;
    graphics.fillStyle(0xffffff);
    graphics.fillCircle(10, eyeY, 5); // Left
    graphics.fillCircle(22, eyeY, 5); // Right

    // Eye Detail (Fan blades - simplified as black cross/star)
    graphics.fillStyle(0x000000);
    
    // Draw simple cross pupil instead of rotated rects to avoid unsupported transform calls
    // Left Pupil
    graphics.fillRect(8, eyeY - 1, 4, 2); // Horizontal
    graphics.fillRect(9, eyeY - 2, 2, 4); // Vertical
    
    // Right Pupil
    graphics.fillRect(20, eyeY - 1, 4, 2); // Horizontal
    graphics.fillRect(21, eyeY - 2, 2, 4); // Vertical

    // Cyan Center Glow
    graphics.fillStyle(0x06b6d4); // Cyan-500
    graphics.fillCircle(10, eyeY, 1.5);
    graphics.fillCircle(22, eyeY, 1.5);
    
    // Eye Glint (White)
    graphics.fillStyle(0xffffff);
    graphics.fillCircle(11, eyeY-1, 1);
    graphics.fillCircle(23, eyeY-1, 1);

    // Mouth (Digital Strip)
    graphics.fillStyle(0x000000);
    graphics.fillRect(10, 17, 12, 3);
    
    // Teeth/Digital pattern
    graphics.fillStyle(0xffffff);
    for(let i=0; i<6; i++) {
        graphics.fillRect(11 + (i*2), 18, 1, 1);
    }

    graphics.generateTexture('ranger', 32, 40);
  }

  private createMobTextures() {
      // Placeholder: Ghosts reuse ranger texture
  }

  private createParticleTextures() {
      const g = this.make.graphics({ x: 0, y: 0, add: false });
      
      // Pixel
      g.fillStyle(0xffffff);
      g.fillRect(0,0,4,4);
      g.generateTexture('particle_pixel', 4,4);
      g.clear();

      // Soft
      g.fillStyle(0xffffff);
      g.fillCircle(8,8,8);
      g.generateTexture('particle_soft', 16,16);
      g.clear();
      
      // Binary (simulated)
      g.fillStyle(0x00ff00);
      g.fillRect(0,0,2,8);
      g.generateTexture('particle_binary', 2,8);
      g.clear();

      // Fire
      g.fillStyle(0xff4500);
      g.fillCircle(4,4,4);
      g.generateTexture('particle_fire', 8,8);
  }

  private createLootTextures() {
      const g = this.make.graphics({ x: 0, y: 0, add: false });

      // Axite
      if (!this.textures.exists('loot_axite')) {
        g.fillStyle(0x3b82f6);
        g.fillCircle(8,8,6);
        g.generateTexture('loot_axite', 16,16);
        g.clear();
      }

      // Gold
      if (!this.textures.exists('loot_gold')) {
        g.fillStyle(0xfacc15);
        g.fillCircle(8,8,6);
        g.generateTexture('loot_gold', 16,16);
        g.clear();
      }

      // Crystal
      if (!this.textures.exists('loot_crystal')) {
        g.fillStyle(0xa855f7);
        g.beginPath();
        g.moveTo(8,0); g.lineTo(16,8); g.lineTo(8,16); g.lineTo(0,8);
        g.fill();
        g.generateTexture('loot_crystal', 16,16);
        g.clear();
      }
      
      // Obelisk
      if (!this.textures.exists('loot_obelisk')) {
        g.fillStyle(0x1e293b);
        g.fillRect(0,0,16,32);
        g.generateTexture('loot_obelisk', 16,32);
        g.clear();
      }

      // Glow
      g.fillStyle(0xffffff);
      g.fillCircle(16,16,16);
      g.generateTexture('glow_particle', 32,32);
      g.clear();
      
      // Decos
      if (!this.textures.exists('deco_tuft')) {
        g.fillStyle(0x10b981);
        g.fillRect(0,0,2,4);
        g.generateTexture('deco_tuft', 2,4);
        g.clear();
      }
      
      if (!this.textures.exists('deco_flower_red')) {
        g.fillStyle(0xf43f5e);
        g.fillCircle(2,2,2);
        g.generateTexture('deco_flower_red', 4,4);
      }
  }

  private isoToScreen(x: number, y: number) {
      return {
          x: (x - y) * this.tileW2,
          y: (x + y) * this.tileH2
      };
  }

  private getPseudoRandom(x: number, y: number) {
      return Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1;
  }

  private moveTo(tx: number, ty: number, onComplete?: () => void) {
      const tile = this.tiles.get(`${tx},${ty}`);
      let targetX = tx;
      let targetY = ty;

      // Smart Movement Logic (Identify neighbor)
      if (tile && (tile.type === TileType.GOLD || tile.type === TileType.AXITE || tile.type === TileType.CRYSTAL || tile.type === TileType.OBELISK)) {
          const cx = Math.round((this.player.x / this.tileW2 + this.player.y / this.tileH2) / 2);
          const cy = Math.round((this.player.y / this.tileH2 - this.player.x / this.tileW2) / 2);
          
          // CHECK 1: Are we ALREADY adjacent to the target resource?
          // UPDATED: Allow diagonal adjacency (Chebyshev distance <= 1)
          const dx = Math.abs(tx - cx);
          const dy = Math.abs(ty - cy);
          
          if (Math.max(dx, dy) <= 1) { 
              // Already in range. Just face it and execute.
              const pos = this.isoToScreen(tx, ty);
              this.playerSprite.setFlipX(pos.x < this.player.x);
              if (onComplete) onComplete();
              return; 
          }

          // Find closest empty neighbor to move to
          const neighbors = [
              {x: tx+1, y: ty}, {x: tx-1, y: ty}, 
              {x: tx, y: ty+1}, {x: tx, y: ty-1},
              {x: tx+1, y: ty+1}, {x: tx-1, y: ty-1},
              {x: tx+1, y: ty-1}, {x: tx-1, y: ty+1}
          ];
          
          neighbors.sort((a,b) => {
              const da = Math.abs(a.x - cx) + Math.abs(a.y - cy);
              const db = Math.abs(b.x - cx) + Math.abs(b.y - cy);
              return da - db;
          });

          const valid = neighbors.find(n => {
              const t = this.tiles.get(`${n.x},${n.y}`);
              return !t || t.type === TileType.EMPTY;
          });

          if (valid) {
              targetX = valid.x;
              targetY = valid.y;
          }
      }

      const pos = this.isoToScreen(targetX, targetY);
      
      // Stop existing movement
      if (this.moveTween) this.moveTween.stop();
      if (this.bobTween) this.bobTween.stop();
      this.playerSprite.y = -22; 
      this.isMoving = true;
      
      if (this.playerSprite) this.playerSprite.setFlipX(pos.x < this.player.x);
      
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, pos.x, pos.y);
      const speed = 0.25; // Speed up slightly for responsiveness
      const duration = Math.max(dist / speed, 200); 
      
      this.moveTween = this.tweens.add({
          targets: this.player,
          x: pos.x, y: pos.y,
          duration: duration,
          ease: 'Linear', 
          onUpdate: () => { this.player.setDepth(this.player.y + 1000); },
          onComplete: () => { 
              // Re-enable idle bob
              this.isMoving = false;
              this.startIdleAnimation(); 
              
              // Execute action if we are now close enough to the original target (tx, ty)
              const cx = Math.round((this.player.x / this.tileW2 + this.player.y / this.tileH2) / 2);
              const cy = Math.round((this.player.y / this.tileH2 - this.player.x / this.tileW2) / 2);
              
              const finalDx = Math.abs(tx - cx);
              const finalDy = Math.abs(ty - cy);
              
              if (Math.max(finalDx, finalDy) <= 1 && onComplete) {
                  onComplete();
              }
          }
      });
      
      // While moving, small fast bob
      this.bobTween = this.tweens.add({ targets: this.playerSprite, y: -15, duration: 150, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  private startIdleLoop() {
     // Optional idle behaviors
  }

  private startIdleAnimation() {
      if (this.bobTween) this.bobTween.stop();
      this.playerSprite.y = -22;
      this.playerSprite.scaleY = 1.2;
      
      this.bobTween = this.tweens.add({
          targets: this.playerSprite,
          scaleY: 1.25, // Subtle breathe
          y: '-=1',
          duration: 1000,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut'
      });
  }
}