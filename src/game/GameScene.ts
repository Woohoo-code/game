import Phaser from "phaser";
import { inputController } from "./inputController";
import { gameStore } from "./state";

const TILE = 32;
const MAP_W = 60;
const MAP_H = 40;
const ROAD_ENCOUNTER_RATE = 0.02;
const GRASS_ENCOUNTER_RATE = 0.12;
const CAMERA_ZOOM = 1.8;
const TOWN_A = { minX: 0, maxX: 7, minY: 0, maxY: 5 };
const TOWN_B = { minX: MAP_W - 8, maxX: MAP_W - 1, minY: MAP_H - 6, maxY: MAP_H - 1 };
const INN_A = { x: 5, y: 3 };
const SHOP_A = { x: 2, y: 3 };
const INN_B = { x: MAP_W - 4, y: MAP_H - 3 };
const SHOP_B = { x: MAP_W - 2, y: MAP_H - 3 };
const TRAIN_A = { x: 6, y: 3 };
const GUILD_A = { x: 1, y: 3 };
const TRAIN_B = { x: MAP_W - 5, y: MAP_H - 3 };
const GUILD_B = { x: MAP_W - 7, y: MAP_H - 3 };
/** Southeast town — Void Titan arena (stand on tile to unlock UI). */
const BOSS_B = { x: MAP_W - 6, y: MAP_H - 4 };

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
    if (!this.blocked(nextX, nextY)) {
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
    this.add.sprite(INN_A.x * TILE + TILE / 2, INN_A.y * TILE + TILE / 2, "innSprite").setScale(2);
    this.add.sprite(SHOP_A.x * TILE + TILE / 2, SHOP_A.y * TILE + TILE / 2, "shopSprite").setScale(2);
    this.add.sprite(TRAIN_A.x * TILE + TILE / 2, TRAIN_A.y * TILE + TILE / 2, "shopSprite").setScale(2).setTint(0x8a6bbd);
    this.add.sprite(GUILD_A.x * TILE + TILE / 2, GUILD_A.y * TILE + TILE / 2, "innSprite").setScale(2).setTint(0x6b8861);
    this.add.sprite(INN_B.x * TILE + TILE / 2, INN_B.y * TILE + TILE / 2, "innSprite").setScale(2);
    this.add.sprite(SHOP_B.x * TILE + TILE / 2, SHOP_B.y * TILE + TILE / 2, "shopSprite").setScale(2);
    this.add.sprite(TRAIN_B.x * TILE + TILE / 2, TRAIN_B.y * TILE + TILE / 2, "shopSprite").setScale(2).setTint(0x8a6bbd);
    this.add.sprite(GUILD_B.x * TILE + TILE / 2, GUILD_B.y * TILE + TILE / 2, "innSprite").setScale(2).setTint(0x6b8861);
    this.add.sprite(BOSS_B.x * TILE + TILE / 2, BOSS_B.y * TILE + TILE / 2, "bossArenaSprite").setScale(2);
    this.addBuildingMarquee(INN_A.x, INN_A.y, "INN", 0x7b2f2f);
    this.addBuildingMarquee(SHOP_A.x, SHOP_A.y, "SHOP", 0x2e4f72);
    this.addBuildingMarquee(TRAIN_A.x, TRAIN_A.y, "TRAIN", 0x6b4f8f);
    this.addBuildingMarquee(GUILD_A.x, GUILD_A.y, "GUILD", 0x486d42);
    this.addBuildingMarquee(INN_B.x, INN_B.y, "INN", 0x7b2f2f);
    this.addBuildingMarquee(SHOP_B.x, SHOP_B.y, "SHOP", 0x2e4f72);
    this.addBuildingMarquee(TRAIN_B.x, TRAIN_B.y, "TRAIN", 0x6b4f8f);
    this.addBuildingMarquee(GUILD_B.x, GUILD_B.y, "GUILD", 0x486d42);
    this.addBuildingMarquee(BOSS_B.x, BOSS_B.y, "BOSS", 0x3d1054);
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
        if (!this.isWaterTile(x, y)) {
          continue;
        }
        const px = x * TILE;
        const py = y * TILE;
        if (!this.isWaterTile(x, y - 1)) g.lineBetween(px, py, px + TILE, py);
        if (!this.isWaterTile(x + 1, y)) g.lineBetween(px + TILE, py, px + TILE, py + TILE);
        if (!this.isWaterTile(x, y + 1)) g.lineBetween(px, py + TILE, px + TILE, py + TILE);
        if (!this.isWaterTile(x - 1, y)) g.lineBetween(px, py, px, py + TILE);
      }
    }
  }

  private drawTerrainTile(g: Phaser.GameObjects.Graphics, x: number, y: number, px: number, py: number): void {
    if (this.isTownTile(x, y)) {
      g.fillStyle(0xa88960, 1);
      g.fillRect(px, py, TILE - 1, TILE - 1);
      g.fillStyle(0xc9b08d, 1);
      g.fillRect(px + 4, py + 4, 4, 4);
      g.fillRect(px + 20, py + 18, 4, 4);
      return;
    }
    if (this.isRoadTile(x, y)) {
      g.fillStyle(0x8d7a5e, 1);
      g.fillRect(px, py, TILE - 1, TILE - 1);
      g.fillStyle(0xa58e6e, 1);
      g.fillRect(px + 6, py + 8, 5, 3);
      g.fillRect(px + 18, py + 20, 5, 3);
      return;
    }
    if (this.isWaterTile(x, y)) {
      g.fillStyle(0x2f5f9a, 1);
      g.fillRect(px, py, TILE - 1, TILE - 1);
      g.fillStyle(0x4c82c5, 1);
      g.fillRect(px + 4, py + 6, 6, 2);
      g.fillRect(px + 16, py + 18, 8, 2);
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
        if (this.isTownTile(x, y) || this.isRoadTile(x, y) || this.isWaterTile(x, y)) {
          continue;
        }
        const hash = (x * 73 + y * 97) % 100;
        if (hash < 4) {
          this.add.sprite(x * TILE + TILE / 2, y * TILE + TILE / 2, "treeSprite").setScale(2);
        } else if (hash >= 4 && hash < 6) {
          this.add.sprite(x * TILE + TILE / 2, y * TILE + TILE / 2, "rockSprite").setScale(2);
        } else if (hash >= 6 && hash < 10) {
          this.add.sprite(x * TILE + TILE / 2, y * TILE + TILE / 2, "flowerSprite").setScale(2);
        }
      }
    }

    // Landmarks near roads to make navigation clearer.
    const landmarkTrees = [
      [14, 8], [26, 8], [38, 8], [50, 8],
      [14, 28], [26, 28], [38, 28], [50, 28]
    ];
    for (const [x, y] of landmarkTrees) {
      if (this.isTownTile(x, y) || this.isRoadTile(x, y) || this.isWaterTile(x, y)) {
        continue;
      }
      this.add.sprite(x * TILE + TILE / 2, y * TILE + TILE / 2, "treeSprite").setScale(2);
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
    const g = this.make.graphics({ x: 0, y: 0, add: false });
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
    const g = this.make.graphics({ x: 0, y: 0, add: false });
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
    const g = this.make.graphics({ x: 0, y: 0, add: false });
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
    const g = this.make.graphics({ x: 0, y: 0, add: false });
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
    const g = this.make.graphics({ x: 0, y: 0, add: false });
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
    const g = this.make.graphics({ x: 0, y: 0, add: false });
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
    const g = this.make.graphics({ x: 0, y: 0, add: false });
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

  private blocked(worldX: number, worldY: number): boolean {
    const tx = Math.floor(worldX / TILE);
    const ty = Math.floor(worldY / TILE);
    return this.isWaterTile(tx, ty) && !this.isRoadTile(tx, ty);
  }

  private checkZonesAndEncounter(): void {
    const tx = Math.floor(this.player.x / TILE);
    const ty = Math.floor(this.player.y / TILE);
    if (tx === this.lastTile.x && ty === this.lastTile.y) {
      return;
    }
    this.lastTile = { x: tx, y: ty };
    const inTown = this.isTownTile(tx, ty);
    const canHeal = (tx === INN_A.x && ty === INN_A.y) || (tx === INN_B.x && ty === INN_B.y);
    const canShop = (tx === SHOP_A.x && ty === SHOP_A.y) || (tx === SHOP_B.x && ty === SHOP_B.y);
    const canTrain = (tx === TRAIN_A.x && ty === TRAIN_A.y) || (tx === TRAIN_B.x && ty === TRAIN_B.y);
    const canGuild = (tx === GUILD_A.x && ty === GUILD_A.y) || (tx === GUILD_B.x && ty === GUILD_B.y);
    const canBoss = tx === BOSS_B.x && ty === BOSS_B.y;
    gameStore.updateWorldZones(inTown, canHeal, canShop, canTrain, canGuild, canBoss);
    if (inTown || this.isWaterTile(tx, ty)) {
      gameStore.setEncounterRate(0);
      return;
    }
    const encounterRate = this.isRoadTile(tx, ty) ? ROAD_ENCOUNTER_RATE : GRASS_ENCOUNTER_RATE;
    if (gameStore.wildernessEncounterStep(encounterRate)) {
      return;
    }
    if (Math.random() < encounterRate) {
      gameStore.startEncounter();
    }
  }

  private isTownTile(x: number, y: number): boolean {
    const mainTown = x >= TOWN_A.minX && x <= TOWN_A.maxX && y >= TOWN_A.minY && y <= TOWN_A.maxY;
    const southEastTown = x >= TOWN_B.minX && x <= TOWN_B.maxX && y >= TOWN_B.minY && y <= TOWN_B.maxY;
    return mainTown || southEastTown;
  }

  private isRoadTile(x: number, y: number): boolean {
    if (this.isTownTile(x, y)) return false;
    const northRoad = y >= TOWN_A.maxY && y <= TOWN_A.maxY + 1 && x >= TOWN_A.maxX;
    const southRoad = y >= TOWN_B.minY - 2 && y <= TOWN_B.minY - 1 && x <= TOWN_B.minX;
    const spineRoad = x >= Math.floor(MAP_W / 2) - 1 && x <= Math.floor(MAP_W / 2) && y >= TOWN_A.maxY && y <= TOWN_B.minY;
    const eastConnector = y >= Math.floor(MAP_H / 2) - 1 && y <= Math.floor(MAP_H / 2) && x >= Math.floor(MAP_W / 2) && x <= MAP_W - 8;
    return northRoad || southRoad || spineRoad || eastConnector;
  }

  private isWaterTile(x: number, y: number): boolean {
    const northwestLake = x >= 14 && x <= 24 && y >= 2 && y <= 8;
    const centralLake = x >= 28 && x <= 36 && y >= 14 && y <= 22;
    const eastLake = x >= 45 && x <= 56 && y >= 6 && y <= 12;
    const southChannel = x >= 22 && x <= 25 && y >= 26 && y <= 36;
    return northwestLake || centralLake || eastLake || southChannel;
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
