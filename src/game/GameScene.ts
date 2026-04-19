import Phaser from "phaser";
import { RESOURCES } from "./data";
import {
  DUNGEON_TILE_EXIT,
  DUNGEON_TILE_FLOOR,
  DUNGEON_TILE_PILLAR,
  DUNGEON_TILE_WALL
} from "./types";
import { inputController } from "./inputController";
import { gameStore } from "./state";
import {
  BUILDINGS,
  type BuildingKind,
  MAP_H,
  MAP_W,
  TILE,
  dispatchZonesAndEncounter,
  isBlocked,
  isForestTile,
  isRoadTile,
  isTownTile,
  isWaterTile
} from "./worldMap";

const CAMERA_ZOOM = 1.8;

export class GameScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: { [key: string]: Phaser.Input.Keyboard.Key };
  private lastTile = { x: -1, y: -1 };
  private roamerGfx: Phaser.GameObjects.Graphics | null = null;
  private resourceGfx: Phaser.GameObjects.Graphics | null = null;
  private dungeonGfx: Phaser.GameObjects.Graphics | null = null;
  private dungeonChestGfx: Phaser.GameObjects.Graphics | null = null;
  private dungeonRoamerGfx: Phaser.GameObjects.Graphics | null = null;
  private lastInDungeon = false;
  private unsubscribeStore: (() => void) | null = null;

  constructor() {
    super("GameScene");
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#22303a");
    this.createSpriteTextures();
    this.makeBossArenaTexture();
    const snap = gameStore.getSnapshot();
    this.lastInDungeon = snap.world.inDungeon;
    if (snap.world.inDungeon && snap.world.dungeon) {
      this.cameras.main.setBackgroundColor("#06040a");
      this.drawDungeonMap();
    } else {
      this.drawMap();
    }
    const { x, y } = snap.player;
    this.player = this.add.sprite(x, y, "playerSprite");
    this.player.setScale(2);
    this.player.setDepth(25);
    this.cameras.main.setBounds(0, 0, MAP_W * TILE, MAP_H * TILE);
    this.cameras.main.setZoom(CAMERA_ZOOM);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.cameras.main.roundPixels = true;
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keys = this.input.keyboard!.addKeys("W,A,S,D") as Record<string, Phaser.Input.Keyboard.Key>;
    this.resourceGfx = this.add.graphics();
    this.resourceGfx.setDepth(17);
    this.roamerGfx = this.add.graphics();
    this.roamerGfx.setDepth(18);
    this.dungeonChestGfx = this.add.graphics();
    this.dungeonChestGfx.setDepth(19);
    this.dungeonRoamerGfx = this.add.graphics();
    this.dungeonRoamerGfx.setDepth(20);

    // Restart the scene whenever we enter/leave the dungeon so the static
    // map + sprites are rebuilt. Cheap since the scene is small.
    this.unsubscribeStore = gameStore.subscribe(() => {
      const inDungeon = gameStore.getSnapshot().world.inDungeon;
      if (inDungeon !== this.lastInDungeon) {
        this.lastInDungeon = inDungeon;
        this.scene.restart();
      }
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubscribeStore?.();
      this.unsubscribeStore = null;
    });
  }

  update(_: number, delta: number): void {
    this.syncFromStore();
    if (this.lastInDungeon) {
      this.drawDungeonChests();
      this.drawDungeonRoamers();
    } else {
      this.drawResourceNodes();
      this.drawRoamers();
    }
    if (gameStore.getSnapshot().battle.inBattle) {
      return;
    }
    const speed = 140 * (delta / 1000);
    let vx = 0;
    let vy = 0;
    if (this.isLeft()) vx -= speed;
    if (this.isRight()) vx += speed;
    if (this.isUp()) vy -= speed;
    if (this.isDown()) vy += speed;
    const nextX = Phaser.Math.Clamp(this.player.x + vx, TILE / 2, MAP_W * TILE - TILE / 2);
    const nextY = Phaser.Math.Clamp(this.player.y + vy, TILE / 2, MAP_H * TILE - TILE / 2);
    if (!isBlocked(nextX, nextY)) {
      this.player.setPosition(nextX, nextY);
      gameStore.setPosition(nextX, nextY);
      this.checkZonesAndEncounter();
    }
  }

  private drawMap(): void {
    const g = this.add.graphics();
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const px = x * TILE;
        const py = y * TILE;
        this.drawTerrainTile(g, x, y, px, py);
      }
    }
    this.drawHardBorders(g);
    this.drawLandmarks();

    const SPRITE_BY_KIND: Record<BuildingKind, { sprite: string; tint?: number }> = {
      inn: { sprite: "innSprite" },
      shop: { sprite: "shopSprite" },
      train: { sprite: "shopSprite", tint: 0x8a6bbd },
      guild: { sprite: "innSprite", tint: 0x6b8861 },
      petShop: { sprite: "shopSprite", tint: 0x4a9e86 },
      boss: { sprite: "bossArenaSprite" },
      voidPortal: { sprite: "bossArenaSprite", tint: 0x44ddff },
      returnPortal: { sprite: "bossArenaSprite", tint: 0x6ed8a0 },
      dungeon: { sprite: "bossArenaSprite", tint: 0x6a1c1c },
      library: { sprite: "shopSprite", tint: 0x5a7090 },
      forge: { sprite: "shopSprite", tint: 0x704040 },
      chapel: { sprite: "innSprite", tint: 0xc8c0b0 },
      stables: { sprite: "innSprite", tint: 0x8b5a32 },
      market: { sprite: "shopSprite", tint: 0xc49a48 },
      restoreSpring: { sprite: "springSprite" }
    };

    for (const b of BUILDINGS) {
      const info = SPRITE_BY_KIND[b.kind];
      const scale = b.kind === "restoreSpring" ? 2.4 : 2;
      const s = this.add
        .sprite(b.pos.x * TILE + TILE / 2, b.pos.y * TILE + TILE / 2, info.sprite)
        .setScale(scale);
      if (info.tint !== undefined) s.setTint(info.tint);
      this.addBuildingMarquee(b.pos.x, b.pos.y, b.label, b.color);
    }
  }

  private addBuildingMarquee(tileX: number, tileY: number, label: string, color: number): void {
    const worldX = tileX * TILE + TILE / 2;
    const worldY = tileY * TILE + 3;
    const text = this.add.text(worldX, worldY, label, {
      fontFamily: "Arial",
      fontSize: "8px",
      color: "#ffffff",
      fontStyle: "bold"
    });
    text.setOrigin(0.5, 0);
    text.setBackgroundColor(Phaser.Display.Color.IntegerToColor(color).rgba);
    text.setPadding(3, 1, 3, 1);
    text.setStroke("#101010", 2);
    text.setDepth(20);
  }

  private drawHardBorders(g: Phaser.GameObjects.Graphics): void {
    // Non-walkable water borders.
    g.lineStyle(4, 0x163958, 0.95);
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        if (!isWaterTile(x, y)) {
          continue;
        }
        const px = x * TILE;
        const py = y * TILE;
        if (!isWaterTile(x, y - 1)) g.lineBetween(px, py, px + TILE, py);
        if (!isWaterTile(x + 1, y)) g.lineBetween(px + TILE, py, px + TILE, py + TILE);
        if (!isWaterTile(x, y + 1)) g.lineBetween(px, py + TILE, px + TILE, py + TILE);
        if (!isWaterTile(x - 1, y)) g.lineBetween(px, py, px, py + TILE);
      }
    }
  }

  private drawTerrainTile(g: Phaser.GameObjects.Graphics, x: number, y: number, px: number, py: number): void {
    if (isTownTile(x, y)) {
      g.fillStyle(0xa88960, 1);
      g.fillRect(px, py, TILE - 1, TILE - 1);
      g.fillStyle(0xc9b08d, 1);
      g.fillRect(px + 4, py + 4, 4, 4);
      g.fillRect(px + 20, py + 18, 4, 4);
      return;
    }
    if (isRoadTile(x, y)) {
      g.fillStyle(0x8d7a5e, 1);
      g.fillRect(px, py, TILE - 1, TILE - 1);
      g.fillStyle(0xa58e6e, 1);
      g.fillRect(px + 6, py + 8, 5, 3);
      g.fillRect(px + 18, py + 20, 5, 3);
      return;
    }
    if (isWaterTile(x, y)) {
      g.fillStyle(0x2f5f9a, 1);
      g.fillRect(px, py, TILE - 1, TILE - 1);
      g.fillStyle(0x4c82c5, 1);
      g.fillRect(px + 4, py + 6, 6, 2);
      g.fillRect(px + 16, py + 18, 8, 2);
      return;
    }
    if (isForestTile(x, y)) {
      g.fillStyle(0x2f4a2a, 1);
      g.fillRect(px, py, TILE - 1, TILE - 1);
      g.fillStyle(0x3d6235, 1);
      g.fillRect(px + 4, py + 6, 5, 5);
      g.fillRect(px + 18, py + 18, 5, 5);
      return;
    }
    g.fillStyle(0x4f7b45, 1);
    g.fillRect(px, py, TILE - 1, TILE - 1);
    g.fillStyle(0x5f9054, 1);
    g.fillRect(px + 3, py + 5, 3, 3);
    g.fillRect(px + 20, py + 13, 3, 3);
    g.fillStyle(0x3e6a37, 1);
    g.fillRect(px + 14, py + 24, 3, 3);
  }

  private drawLandmarks(): void {
    for (let y = 2; y < MAP_H - 2; y++) {
      for (let x = 2; x < MAP_W - 2; x++) {
        if (isTownTile(x, y) || isRoadTile(x, y) || isWaterTile(x, y)) {
          continue;
        }
        if (isForestTile(x, y)) {
          this.add.sprite(x * TILE + TILE / 2, y * TILE + TILE / 2, "treeSprite").setScale(2);
          continue;
        }
        const hash = (x * 73 + y * 97) % 100;
        if (hash < 3) {
          this.add.sprite(x * TILE + TILE / 2, y * TILE + TILE / 2, "rockSprite").setScale(2);
        } else if (hash < 7) {
          this.add.sprite(x * TILE + TILE / 2, y * TILE + TILE / 2, "flowerSprite").setScale(2);
        }
      }
    }
  }

  private createSpriteTextures(): void {
    this.makePlayerTexture();
    this.makeInnTexture();
    this.makeShopTexture();
    this.makeSpringTexture();
    this.makeTreeTexture();
    this.makeRockTexture();
    this.makeFlowerTexture();
  }

  /** Draw the static dungeon map (walls, floor, pillars, exit, sign). */
  private drawDungeonMap(): void {
    const dungeon = gameStore.getSnapshot().world.dungeon;
    if (!dungeon) return;
    const g = this.add.graphics();
    for (let y = 0; y < dungeon.height; y++) {
      for (let x = 0; x < dungeon.width; x++) {
        const px = x * TILE;
        const py = y * TILE;
        const code = dungeon.tiles[y * dungeon.width + x] ?? DUNGEON_TILE_WALL;
        if (code === DUNGEON_TILE_WALL) {
          g.fillStyle(0x120d12, 1);
          g.fillRect(px, py, TILE, TILE);
          g.fillStyle(0x1f181d, 1);
          g.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
          g.lineStyle(1, 0x2a1f24, 1);
          g.strokeRect(px + 4, py + 4, TILE - 8, TILE - 8);
        } else if (code === DUNGEON_TILE_FLOOR) {
          g.fillStyle(0x2a2228, 1);
          g.fillRect(px, py, TILE - 1, TILE - 1);
          g.fillStyle(0x362a31, 1);
          g.fillRect(px + 4, py + 4, 6, 6);
          g.fillRect(px + 18, py + 18, 6, 6);
        } else if (code === DUNGEON_TILE_PILLAR) {
          g.fillStyle(0x2a2228, 1);
          g.fillRect(px, py, TILE - 1, TILE - 1);
          g.fillStyle(0x1a1418, 1);
          g.fillCircle(px + TILE / 2, py + TILE / 2, 10);
          g.fillStyle(0x2a1f24, 1);
          g.fillCircle(px + TILE / 2, py + TILE / 2, 7);
        } else if (code === DUNGEON_TILE_EXIT) {
          g.fillStyle(0x5a4028, 1);
          g.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
          g.fillStyle(0xb08850, 1);
          g.fillRect(px + 8, py + 8, TILE - 16, TILE - 16);
          g.fillStyle(0xffb266, 1);
          g.fillCircle(px + TILE / 2, py + TILE / 2, 3);
          const label = this.add.text(px + TILE / 2, py - 6, "EXIT", {
            fontFamily: "Arial",
            fontSize: "8px",
            color: "#ffe8c8",
            fontStyle: "bold"
          });
          label.setOrigin(0.5, 0.5);
          label.setBackgroundColor("#5a2a1a");
          label.setPadding(3, 1, 3, 1);
          label.setStroke("#120808", 2);
          label.setDepth(22);
        }
      }
    }
    this.dungeonGfx = g;
  }

  /** Every frame: redraw treasure chests (closed = bright; opened = faded). */
  private drawDungeonChests(): void {
    const g = this.dungeonChestGfx;
    if (!g) return;
    g.clear();
    const dungeon = gameStore.getSnapshot().world.dungeon;
    if (!dungeon) return;
    for (const c of dungeon.chests) {
      const cx = c.tx * TILE + TILE / 2;
      const cy = c.ty * TILE + TILE / 2;
      if (c.opened) {
        g.fillStyle(0x3a2618, 1);
        g.fillRect(cx - 10, cy - 6, 20, 12);
        g.fillStyle(0x1e1410, 1);
        g.fillRect(cx - 10, cy - 10, 20, 4);
      } else {
        g.fillStyle(0x6a4028, 1);
        g.fillRect(cx - 10, cy - 6, 20, 12);
        g.fillStyle(0x8a5838, 1);
        g.fillRect(cx - 10, cy - 10, 20, 4);
        g.fillStyle(0xd8b048, 1);
        g.fillRect(cx - 2, cy - 3, 4, 6);
      }
    }
  }

  /** Every frame: redraw visible dungeon monsters so kills disappear instantly. */
  private drawDungeonRoamers(): void {
    const g = this.dungeonRoamerGfx;
    if (!g) return;
    g.clear();
    const dungeon = gameStore.getSnapshot().world.dungeon;
    if (!dungeon) return;
    for (const r of dungeon.roamers) {
      const cx = r.tx * TILE + TILE / 2;
      const cy = r.ty * TILE + TILE / 2;
      g.fillStyle(0xbfc0a0, 1);
      g.fillCircle(cx, cy, 7);
      g.fillStyle(0x1a1a1a, 1);
      g.fillCircle(cx - 2, cy - 1, 1);
      g.fillCircle(cx + 2, cy - 1, 1);
      g.fillStyle(0x6a0c0c, 1);
      g.fillRect(cx - 3, cy + 2, 6, 1);
    }
  }

  private makeBossArenaTexture(): void {
    if (this.textures.exists("bossArenaSprite")) return;
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0x2a0d3d, 1);
    g.fillRect(2, 1, 12, 14);
    g.fillStyle(0x5a2d7a, 1);
    g.fillRect(4, 2, 8, 4);
    g.fillStyle(0x1f5a9c, 1);
    g.fillRect(5, 6, 6, 3);
    g.fillStyle(0x8b7a2b, 1);
    g.fillRect(6, 9, 4, 6);
    g.fillStyle(0xc4b87c, 1);
    g.fillRect(7, 4, 2, 1);
    g.fillStyle(0x6f1515, 1);
    g.fillRect(6, 0, 4, 3);
    g.generateTexture("bossArenaSprite", 16, 16);
    g.destroy();
  }

  private makePlayerTexture(): void {
    if (this.textures.exists("playerSprite")) return;
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0x2b2b2b, 1);
    g.fillRect(3, 0, 2, 2);
    g.fillStyle(0xf6d2b0, 1);
    g.fillRect(2, 2, 4, 3);
    g.fillStyle(0x3564c3, 1);
    g.fillRect(1, 5, 6, 3);
    g.fillStyle(0xffffff, 1);
    g.fillRect(2, 6, 1, 1);
    g.fillRect(5, 6, 1, 1);
    g.fillStyle(0x6b4b2a, 1);
    g.fillRect(1, 0, 2, 2);
    g.fillRect(5, 0, 2, 2);
    g.generateTexture("playerSprite", 8, 8);
    g.destroy();
  }

  private makeInnTexture(): void {
    if (this.textures.exists("innSprite")) return;
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0x8b2e2e, 1);
    g.fillRect(0, 0, 16, 6);
    g.fillStyle(0xd8c79e, 1);
    g.fillRect(1, 6, 14, 10);
    g.fillStyle(0x6f4a2c, 1);
    g.fillRect(6, 10, 4, 6);
    g.fillStyle(0x4a89c7, 1);
    g.fillRect(2, 8, 3, 3);
    g.fillRect(11, 8, 3, 3);
    // Signboard
    g.fillStyle(0xefe2c1, 1);
    g.fillRect(3, 6, 10, 2);
    g.fillStyle(0x4b2f1e, 1);
    g.fillRect(4, 7, 1, 1);
    g.fillRect(6, 7, 1, 1);
    g.fillRect(8, 7, 1, 1);
    g.fillRect(10, 7, 1, 1);
    g.generateTexture("innSprite", 16, 16);
    g.destroy();
  }

  private makeShopTexture(): void {
    if (this.textures.exists("shopSprite")) return;
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0x3b5c7e, 1);
    g.fillRect(0, 0, 16, 5);
    g.fillStyle(0xc8b38a, 1);
    g.fillRect(1, 5, 14, 11);
    g.fillStyle(0x7d5433, 1);
    g.fillRect(6, 10, 4, 6);
    g.fillStyle(0x5aa84f, 1);
    g.fillRect(2, 8, 3, 3);
    g.fillRect(11, 8, 3, 3);
    g.fillStyle(0xf2e46f, 1);
    g.fillRect(6, 2, 4, 1);
    // Signboard
    g.fillStyle(0xf1e4c4, 1);
    g.fillRect(2, 6, 12, 2);
    g.fillStyle(0x2e4f72, 1);
    g.fillRect(3, 7, 1, 1);
    g.fillRect(5, 7, 1, 1);
    g.fillRect(7, 7, 1, 1);
    g.fillRect(9, 7, 1, 1);
    g.fillRect(11, 7, 1, 1);
    g.generateTexture("shopSprite", 16, 16);
    g.destroy();
  }

  private makeSpringTexture(): void {
    if (this.textures.exists("springSprite")) return;
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0x4a7068, 1);
    g.fillEllipse(8, 10, 12, 5);
    g.fillStyle(0x3a9ea8, 1);
    g.fillEllipse(8, 9, 9, 4);
    g.fillStyle(0x7af0e8, 0.85);
    g.fillEllipse(8, 8, 6, 3);
    g.fillStyle(0xc8ffff, 1);
    g.fillCircle(6, 7, 1);
    g.fillCircle(10, 8, 1);
    g.fillStyle(0x5a5850, 1);
    g.fillRect(2, 6, 2, 2);
    g.fillRect(12, 7, 2, 2);
    g.generateTexture("springSprite", 16, 16);
    g.destroy();
  }

  private makeTreeTexture(): void {
    if (this.textures.exists("treeSprite")) return;
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0x2e6d2f, 1);
    g.fillRect(3, 0, 10, 6);
    g.fillRect(1, 4, 14, 7);
    g.fillStyle(0x3a833c, 1);
    g.fillRect(4, 2, 3, 2);
    g.fillRect(10, 7, 3, 2);
    g.fillStyle(0x694422, 1);
    g.fillRect(6, 11, 4, 5);
    g.generateTexture("treeSprite", 16, 16);
    g.destroy();
  }

  private makeRockTexture(): void {
    if (this.textures.exists("rockSprite")) return;
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0x7d8289, 1);
    g.fillRect(2, 6, 12, 8);
    g.fillStyle(0xa1a7b0, 1);
    g.fillRect(4, 7, 4, 2);
    g.fillRect(9, 10, 3, 2);
    g.generateTexture("rockSprite", 16, 16);
    g.destroy();
  }

  private makeFlowerTexture(): void {
    if (this.textures.exists("flowerSprite")) return;
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0x2d7c2d, 1);
    g.fillRect(7, 8, 2, 7);
    g.fillStyle(0xd85ba9, 1);
    g.fillRect(5, 4, 2, 2);
    g.fillRect(9, 4, 2, 2);
    g.fillRect(7, 2, 2, 2);
    g.fillRect(7, 6, 2, 2);
    g.fillStyle(0xffe57a, 1);
    g.fillRect(7, 4, 2, 2);
    g.generateTexture("flowerSprite", 16, 16);
    g.destroy();
  }

  private drawResourceNodes(): void {
    const g = this.resourceGfx;
    if (!g) return;
    g.clear();
    if (gameStore.getSnapshot().battle.inBattle) return;
    for (const n of gameStore.getSnapshot().world.resourceNodes ?? []) {
      const def = RESOURCES[n.resourceKey];
      if (!def) continue;
      const cx = n.tx * TILE + TILE / 2;
      const cy = n.ty * TILE + TILE / 2;
      const primary = Phaser.Display.Color.HexStringToColor(def.colorPrimary).color;
      const accent = Phaser.Display.Color.HexStringToColor(def.colorAccent).color;
      if (def.shape === "mushroom") {
        g.fillStyle(0xf4ead5);
        g.fillRect(cx - 2, cy - 1, 4, 5);
        g.fillStyle(primary, 1);
        g.fillCircle(cx, cy - 2, 5);
        g.fillStyle(accent, 0.85);
        g.fillCircle(cx - 2, cy - 3, 1);
        g.fillCircle(cx + 2, cy - 2, 1);
      } else if (def.shape === "herb") {
        g.fillStyle(accent, 1);
        g.fillRect(cx - 3, cy + 2, 6, 2);
        g.fillStyle(primary, 1);
        for (let i = 0; i < 4; i++) {
          const ang = (i / 4) * Math.PI - Math.PI / 2;
          g.fillTriangle(
            cx + Math.cos(ang) * 4,
            cy - 4 + Math.sin(ang) * 2,
            cx + Math.cos(ang) * 2 - 1,
            cy + 1,
            cx + Math.cos(ang) * 2 + 1,
            cy + 1
          );
        }
      } else {
        // flower / crystalBloom — small blossom glyph
        g.fillStyle(0x3b8a44, 1);
        g.fillRect(cx - 1, cy - 1, 2, 5);
        g.fillStyle(primary, 1);
        const petals = 5;
        for (let i = 0; i < petals; i++) {
          const ang = (i / petals) * Math.PI * 2;
          g.fillCircle(cx + Math.cos(ang) * 3.2, cy - 2 + Math.sin(ang) * 3.2, 2);
        }
        g.fillStyle(accent, 1);
        g.fillCircle(cx, cy - 2, 1.6);
      }
    }
  }

  private drawRoamers(): void {
    const g = this.roamerGfx;
    if (!g) return;
    g.clear();
    if (gameStore.getSnapshot().battle.inBattle) return;
    for (const r of gameStore.getSnapshot().world.roamingMonsters ?? []) {
      const cx = r.tx * TILE + TILE / 2;
      const cy = r.ty * TILE + TILE / 2;
      g.fillStyle(0xd94a3d, 0.92);
      g.fillCircle(cx, cy, 12);
      g.lineStyle(2, 0x1a0a0a, 0.88);
      g.strokeCircle(cx, cy, 12);
    }
  }

  private checkZonesAndEncounter(): void {
    const tx = Math.floor(this.player.x / TILE);
    const ty = Math.floor(this.player.y / TILE);
    if (tx === this.lastTile.x && ty === this.lastTile.y) {
      return;
    }
    this.lastTile = { x: tx, y: ty };
    dispatchZonesAndEncounter(tx, ty);
  }

  private syncFromStore(): void {
    const { x, y } = gameStore.getSnapshot().player;
    const dx = Math.abs(this.player.x - x);
    const dy = Math.abs(this.player.y - y);
    if (dx > 1 || dy > 1) {
      this.player.setPosition(x, y);
    }
  }

  private isUp(): boolean {
    return this.cursors.up.isDown || this.keys.W.isDown || inputController.isPressed("up");
  }
  private isDown(): boolean {
    return this.cursors.down.isDown || this.keys.S.isDown || inputController.isPressed("down");
  }
  private isLeft(): boolean {
    return this.cursors.left.isDown || this.keys.A.isDown || inputController.isPressed("left");
  }
  private isRight(): boolean {
    return this.cursors.right.isDown || this.keys.D.isDown || inputController.isPressed("right");
  }
}
