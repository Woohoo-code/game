import Phaser from "phaser";
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

  constructor() {
    super("GameScene");
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#22303a");
    this.createSpriteTextures();
    this.makeBossArenaTexture();
    this.drawMap();
    const { x, y } = gameStore.getSnapshot().player;
    this.player = this.add.sprite(x, y, "playerSprite");
    this.player.setScale(2);
    this.cameras.main.setBounds(0, 0, MAP_W * TILE, MAP_H * TILE);
    this.cameras.main.setZoom(CAMERA_ZOOM);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.cameras.main.roundPixels = true;
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keys = this.input.keyboard!.addKeys("W,A,S,D") as Record<string, Phaser.Input.Keyboard.Key>;
  }

  update(_: number, delta: number): void {
    this.syncFromStore();
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
      boss: { sprite: "bossArenaSprite" }
    };

    for (const b of BUILDINGS) {
      const info = SPRITE_BY_KIND[b.kind];
      const s = this.add
        .sprite(b.pos.x * TILE + TILE / 2, b.pos.y * TILE + TILE / 2, info.sprite)
        .setScale(2);
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
    const worldW = MAP_W * TILE;
    const worldH = MAP_H * TILE;

    // World edge boundary.
    g.lineStyle(6, 0x1a1410, 1);
    g.strokeRect(1, 1, worldW - 2, worldH - 2);

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
    this.makeTreeTexture();
    this.makeRockTexture();
    this.makeFlowerTexture();
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
