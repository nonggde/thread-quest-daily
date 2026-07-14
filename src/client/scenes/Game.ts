import { Scene } from 'phaser';
import * as Phaser from 'phaser';
import type { CommunityState, InitResponse, PlayerState, RunResponse, RunSubmission } from '../../shared/api';

type Terrain = 'plain' | 'ridge' | 'relay' | 'storm' | 'beacon' | 'start' | 'gate';

type Tile = {
  col: number;
  row: number;
  type: Terrain;
  revealed: boolean;
  visited: boolean;
};

type BoardMetrics = {
  left: number;
  top: number;
  cell: number;
  gap: number;
};

const COLS = 7;
const ROWS = 8;
const RUN_SECONDS = 75;
const START_ENERGY = 21;

const TERRAIN: Record<Terrain, { color: number; cost: number; points: number; label: string }> = {
  plain: { color: 0x2d6f68, cost: 1, points: 12, label: '' },
  ridge: { color: 0xd99058, cost: 2, points: 28, label: '2' },
  relay: { color: 0x47c9d8, cost: 1, points: 22, label: '+' },
  storm: { color: 0xb85c78, cost: 3, points: 52, label: '!' },
  beacon: { color: 0xf3c969, cost: 2, points: 120, label: '' },
  start: { color: 0xe8f2ed, cost: 0, points: 0, label: 'S' },
  gate: { color: 0xf4f0e2, cost: 1, points: 160, label: 'N' },
};

const EMPTY_COMMUNITY: CommunityState = {
  score: 0,
  runs: 0,
  beacons: 0,
  successes: 0,
  milestone: {
    level: 0,
    nextTarget: 5000,
    progress: 0,
    title: 'Signal detected',
    detail: 'The first expeditions are leaving a trail for the subreddit.',
  },
};

const EMPTY_PLAYER: PlayerState = {
  bestScore: 0,
  bestBeacons: 0,
  completed: false,
};

function numberField(value: unknown, key: string): number | null {
  if (typeof value !== 'object' || value === null) return null;
  const field = Reflect.get(value, key);
  return typeof field === 'number' && Number.isFinite(field) ? field : null;
}

function stringField(value: unknown, key: string): string | null {
  if (typeof value !== 'object' || value === null) return null;
  const field = Reflect.get(value, key);
  return typeof field === 'string' ? field : null;
}

function isInitResponse(value: unknown): value is InitResponse | RunResponse {
  if (typeof value !== 'object' || value === null) return false;
  const community = Reflect.get(value, 'community');
  const player = Reflect.get(value, 'player');
  return (
    stringField(value, 'dayKey') !== null &&
    numberField(value, 'seed') !== null &&
    numberField(community, 'score') !== null &&
    numberField(player, 'bestScore') !== null
  );
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function localSeed(day: string): number {
  let seed = 0;
  for (let index = 0; index < day.length; index += 1) seed = Math.imul(seed, 31) + day.charCodeAt(index);
  return seed >>> 0;
}

export class Game extends Scene {
  private board: Tile[] = [];
  private path: number[] = [];
  private currentIndex = 0;
  private energy = START_ENERGY;
  private score = 0;
  private beacons = 0;
  private steps = 0;
  private combo = 1;
  private secondsLeft = RUN_SECONDS;
  private lastTerrain: Terrain | null = null;
  private overchargeAvailable = true;
  private ready = false;
  private ended = false;
  private startTime = 0;
  private seed = 1;
  private community: CommunityState = EMPTY_COMMUNITY;
  private player: PlayerState = EMPTY_PLAYER;
  private boardLayer: Phaser.GameObjects.Container | null = null;
  private backgroundLayer: Phaser.GameObjects.Graphics | null = null;
  private titleText: Phaser.GameObjects.Text | null = null;
  private dayText: Phaser.GameObjects.Text | null = null;
  private energyText: Phaser.GameObjects.Text | null = null;
  private scoreText: Phaser.GameObjects.Text | null = null;
  private timerText: Phaser.GameObjects.Text | null = null;
  private progressText: Phaser.GameObjects.Text | null = null;
  private progressTrack: Phaser.GameObjects.Rectangle | null = null;
  private progressFill: Phaser.GameObjects.Rectangle | null = null;
  private statusText: Phaser.GameObjects.Text | null = null;
  private hintText: Phaser.GameObjects.Text | null = null;
  private overchargeButton: Phaser.GameObjects.Container | null = null;
  private resultLayer: Phaser.GameObjects.Container | null = null;
  private timerEvent: Phaser.Time.TimerEvent | null = null;
  private metrics: BoardMetrics = { left: 0, top: 0, cell: 52, gap: 5 };

  constructor() {
    super('Game');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x071017);
    this.backgroundLayer = this.add.graphics();
    this.boardLayer = this.add.container(0, 0);

    this.titleText = this.add.text(20, 18, 'THREAD QUEST', {
      fontFamily: 'Arial Black',
      fontSize: 28,
      color: '#f4f0e2',
      letterSpacing: 2,
    });
    this.dayText = this.add.text(20, 52, 'Opening today\'s map...', {
      fontFamily: 'Arial',
      fontSize: 14,
      color: '#91aaa6',
    });
    this.energyText = this.createHudText();
    this.scoreText = this.createHudText();
    this.timerText = this.createHudText();
    this.progressText = this.add.text(20, 105, '', {
      fontFamily: 'Arial',
      fontSize: 13,
      color: '#bed0cb',
    });
    this.progressTrack = this.add.rectangle(20, 127, 260, 6, 0x18313a).setOrigin(0, 0.5);
    this.progressFill = this.add.rectangle(20, 127, 0, 6, 0x47c9d8).setOrigin(0, 0.5);
    this.statusText = this.add
      .text(0, 0, 'Loading expedition...', {
        fontFamily: 'Arial Black',
        fontSize: 18,
        color: '#f4f0e2',
        align: 'center',
      })
      .setOrigin(0.5);
    this.hintText = this.add
      .text(0, 0, 'Light 2 beacons, then reach the north gate.', {
        fontFamily: 'Arial',
        fontSize: 13,
        color: '#91aaa6',
        align: 'center',
      })
      .setOrigin(0.5);
    this.overchargeButton = this.createOverchargeButton();

    this.updateLayout(this.scale.width, this.scale.height);
    this.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
      this.updateLayout(gameSize.width, gameSize.height);
    });
    void this.loadState();
  }

  private createHudText(): Phaser.GameObjects.Text {
    return this.add
      .text(0, 0, '', {
        fontFamily: 'Arial Black',
        fontSize: 16,
        color: '#f4f0e2',
        align: 'center',
      })
      .setOrigin(0.5);
  }

  private createOverchargeButton(): Phaser.GameObjects.Container {
    const container = this.add.container(0, 0);
    const background = this.add
      .rectangle(0, 0, 174, 44, 0x122b33)
      .setStrokeStyle(2, 0x47c9d8)
      .setInteractive({ useHandCursor: true });
    const label = this.add
      .text(0, -2, 'OVERCHARGE  +5', {
        fontFamily: 'Arial Black',
        fontSize: 14,
        color: '#dff8f5',
      })
      .setOrigin(0.5);
    container.add([background, label]);
    background.on('pointerdown', () => this.useOvercharge());
    background.on('pointerover', () => background.setFillStyle(0x1b414b));
    background.on('pointerout', () => background.setFillStyle(0x122b33));
    return container;
  }

  private async loadState(): Promise<void> {
    try {
      const response = await fetch('/api/init');
      if (!response.ok) throw new Error(`API ${response.status}`);
      const data: unknown = await response.json();
      if (!isInitResponse(data)) throw new Error('Unexpected API response');
      this.applyServerState(data);
    } catch (error) {
      console.warn('Starting local practice mode:', error);
      const day = new Date().toISOString().slice(0, 10);
      this.seed = localSeed(day);
      this.dayText?.setText(`${day}  /  PRACTICE MAP`);
    }
    this.startRun();
  }

  private applyServerState(data: InitResponse | RunResponse): void {
    this.seed = data.seed;
    this.community = data.community;
    this.player = data.player;
    this.dayText?.setText(`${data.dayKey}  /  DAILY MAP  /  u/${data.username}`);
  }

  private startRun(): void {
    this.timerEvent?.remove(false);
    this.resultLayer?.destroy(true);
    this.resultLayer = null;
    this.board = this.generateBoard(this.seed);
    this.currentIndex = (ROWS - 1) * COLS + Math.floor(COLS / 2);
    this.path = [this.currentIndex];
    this.tileAtIndex(this.currentIndex).visited = true;
    this.energy = START_ENERGY;
    this.score = 0;
    this.beacons = 0;
    this.steps = 0;
    this.combo = 1;
    this.secondsLeft = RUN_SECONDS;
    this.lastTerrain = null;
    this.overchargeAvailable = true;
    this.ready = true;
    this.ended = false;
    this.startTime = Date.now();
    this.revealNeighbors(this.currentIndex);
    this.setStatus('Choose a glowing neighbor. Different terrain builds combo.', false);
    this.timerEvent = this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        if (!this.ready || this.ended) return;
        this.secondsLeft -= 1;
        this.renderHud();
        if (this.secondsLeft <= 0) void this.finishRun(false, 'The storm closed the route.');
      },
    });
    this.renderAll();
  }

  private generateBoard(seed: number): Tile[] {
    const random = seededRandom(seed);
    const tiles: Tile[] = [];
    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        const roll = random();
        let type: Terrain = 'plain';
        if (roll > 0.84) type = 'storm';
        else if (roll > 0.66) type = 'relay';
        else if (roll > 0.42) type = 'ridge';
        tiles.push({ col, row, type, revealed: false, visited: false });
      }
    }

    const mirrored = seed % 2 === 0;
    const beaconPositions = mirrored
      ? [this.indexAt(1, 6), this.indexAt(5, 4), this.indexAt(1, 2)]
      : [this.indexAt(5, 6), this.indexAt(1, 4), this.indexAt(5, 2)];
    for (const index of beaconPositions) {
      const tile = tiles[index];
      if (tile) tile.type = 'beacon';
    }
    const start = tiles[this.indexAt(3, ROWS - 1)];
    const gate = tiles[this.indexAt(3, 0)];
    if (start) start.type = 'start';
    if (gate) gate.type = 'gate';
    return tiles;
  }

  private indexAt(col: number, row: number): number {
    return row * COLS + col;
  }

  private tileAtIndex(index: number): Tile {
    const tile = this.board[index];
    if (!tile) throw new Error(`Missing tile ${index}`);
    return tile;
  }

  private revealNeighbors(index: number): void {
    const current = this.tileAtIndex(index);
    for (const tile of this.board) {
      const distance = Math.abs(tile.col - current.col) + Math.abs(tile.row - current.row);
      if (distance <= 1 || tile.type === 'beacon' || tile.type === 'gate') tile.revealed = true;
    }
  }

  private isReachable(tile: Tile): boolean {
    if (!this.ready || this.ended || tile.visited || !tile.revealed) return false;
    const current = this.tileAtIndex(this.currentIndex);
    return Math.abs(tile.col - current.col) + Math.abs(tile.row - current.row) === 1;
  }

  private moveTo(index: number): void {
    const tile = this.tileAtIndex(index);
    if (!this.isReachable(tile)) return;
    const terrain = TERRAIN[tile.type];
    if (tile.type === 'gate' && this.beacons < 2) {
      this.rejectMove('The north gate needs 2 lit beacons.');
      return;
    }
    if (terrain.cost > this.energy) {
      this.rejectMove(`Need ${terrain.cost} energy for that tile.`);
      return;
    }

    this.energy -= terrain.cost;
    this.steps += 1;
    if (tile.type === 'relay') this.energy = Math.min(26, this.energy + 4);
    if (tile.type === 'beacon') this.beacons += 1;

    const buildsCombo = this.lastTerrain !== null && this.lastTerrain !== tile.type;
    this.combo = buildsCombo ? Math.min(4, this.combo + 1) : 1;
    this.score += terrain.points * this.combo;
    this.lastTerrain = tile.type;
    tile.visited = true;
    this.currentIndex = index;
    this.path.push(index);
    this.revealNeighbors(index);
    this.burstAt(tile, terrain.color);

    if (tile.type === 'storm') {
      this.cameras.main.shake(120, 0.004);
      this.setStatus(`Storm crossed. x${this.combo} route combo.`, false);
    } else if (tile.type === 'relay') {
      this.setStatus(`Relay charged. +4 energy, x${this.combo} combo.`, false);
    } else if (tile.type === 'beacon') {
      this.setStatus(`${this.beacons}/3 beacons lit. The gate needs 2.`, false);
    } else {
      this.setStatus(`Route combo x${this.combo}. Keep terrain varied.`, false);
    }

    this.renderAll();
    if (tile.type === 'gate') {
      void this.finishRun(true, this.beacons === 3 ? 'Perfect signal chain.' : 'The north gate is open.');
      return;
    }
    if (!this.hasAffordableMove()) void this.finishRun(false, 'No energy remains for a safe step.');
  }

  private hasAffordableMove(): boolean {
    return this.board.some((tile) => this.isReachable(tile) && TERRAIN[tile.type].cost <= this.energy);
  }

  private useOvercharge(): void {
    if (!this.ready || this.ended || !this.overchargeAvailable) return;
    this.overchargeAvailable = false;
    this.energy = Math.min(26, this.energy + 5);
    this.score = Math.max(0, this.score - 40);
    this.combo = 1;
    this.setStatus('Overcharge restored 5 energy. Combo reset.', false);
    this.cameras.main.flash(140, 71, 201, 216, false);
    this.renderAll();
  }

  private rejectMove(message: string): void {
    this.setStatus(message, true);
    this.cameras.main.shake(90, 0.002);
  }

  private setStatus(message: string, danger: boolean): void {
    this.statusText?.setText(message).setColor(danger ? '#ff9d8d' : '#f4f0e2');
  }

  private burstAt(tile: Tile, color: number): void {
    const center = this.tileCenter(tile);
    for (let index = 0; index < 7; index += 1) {
      const angle = (Math.PI * 2 * index) / 7;
      const dot = this.add.circle(center.x, center.y, 3, color).setDepth(20);
      this.tweens.add({
        targets: dot,
        x: center.x + Math.cos(angle) * 28,
        y: center.y + Math.sin(angle) * 28,
        alpha: 0,
        scale: 0.2,
        duration: 280,
        onComplete: () => dot.destroy(),
      });
    }
  }

  private tileCenter(tile: Tile): { x: number; y: number } {
    const stride = this.metrics.cell + this.metrics.gap;
    return {
      x: this.metrics.left + tile.col * stride + this.metrics.cell / 2,
      y: this.metrics.top + tile.row * stride + this.metrics.cell / 2,
    };
  }

  private renderAll(): void {
    this.renderHud();
    this.renderBoard();
    this.renderOvercharge();
  }

  private renderHud(): void {
    this.energyText?.setText(`ENERGY  ${this.energy}`);
    this.scoreText?.setText(`SCORE  ${this.score}`);
    this.timerText?.setText(`TIME  ${this.secondsLeft}`);
    this.timerText?.setColor(this.secondsLeft <= 15 ? '#ff9d8d' : '#f4f0e2');
    this.progressText?.setText(
      `${this.community.milestone.title.toUpperCase()}  ${this.community.score}/${this.community.milestone.nextTarget}`
    );
    const trackWidth = Math.min(330, Math.max(220, this.scale.width * 0.38));
    this.progressTrack?.setSize(trackWidth, 6);
    this.progressFill?.setSize(trackWidth * this.community.milestone.progress, 6);
  }

  private renderOvercharge(): void {
    const background = this.overchargeButton?.list[0];
    const label = this.overchargeButton?.list[1];
    if (background instanceof Phaser.GameObjects.Rectangle) {
      background.setFillStyle(this.overchargeAvailable ? 0x122b33 : 0x172126);
      background.setStrokeStyle(2, this.overchargeAvailable ? 0x47c9d8 : 0x34454a);
      if (this.overchargeAvailable) background.setInteractive({ useHandCursor: true });
      else background.disableInteractive();
    }
    if (label instanceof Phaser.GameObjects.Text) {
      label.setText(this.overchargeAvailable ? 'OVERCHARGE  +5' : 'OVERCHARGE  USED');
      label.setColor(this.overchargeAvailable ? '#dff8f5' : '#66777a');
    }
  }

  private renderBoard(): void {
    if (!this.boardLayer) return;
    this.boardLayer.removeAll(true);
    const pathGraphics = this.add.graphics();
    pathGraphics.lineStyle(Math.max(3, this.metrics.cell * 0.08), 0xe8f2ed, 0.75);
    if (this.path.length > 1) {
      const firstIndex = this.path[0];
      if (firstIndex === undefined) return;
      const first = this.tileCenter(this.tileAtIndex(firstIndex));
      pathGraphics.beginPath();
      pathGraphics.moveTo(first.x, first.y);
      for (const index of this.path.slice(1)) {
        const point = this.tileCenter(this.tileAtIndex(index));
        pathGraphics.lineTo(point.x, point.y);
      }
      pathGraphics.strokePath();
    }
    this.boardLayer.add(pathGraphics);

    for (let index = 0; index < this.board.length; index += 1) {
      const tile = this.tileAtIndex(index);
      const center = this.tileCenter(tile);
      const visible = tile.revealed || tile.type === 'beacon' || tile.type === 'gate';
      const reachable = this.isReachable(tile);
      const baseColor = visible ? TERRAIN[tile.type].color : 0x101f26;
      const alpha = visible ? (tile.visited ? 0.88 : 0.74) : 0.72;
      const cell = this.add
        .rectangle(center.x, center.y, this.metrics.cell, this.metrics.cell, baseColor, alpha)
        .setStrokeStyle(reachable ? 3 : 1, reachable ? 0xf4f0e2 : visible ? 0x31515a : 0x172b31);
      if (reachable) {
        cell.setInteractive({ useHandCursor: true });
        cell.on('pointerdown', () => this.moveTo(index));
        this.tweens.add({
          targets: cell,
          alpha: { from: 0.68, to: 0.96 },
          duration: 620,
          yoyo: true,
          repeat: -1,
        });
      }
      this.boardLayer.add(cell);

      if (!visible) {
        const fogDot = this.add.circle(center.x, center.y, 2.5, 0x36505a, 0.8);
        this.boardLayer.add(fogDot);
        continue;
      }
      this.drawTileMark(tile, center.x, center.y);
      if (tile.visited) {
        const routeDot = this.add.circle(center.x, center.y, Math.max(4, this.metrics.cell * 0.09), 0xf4f0e2);
        this.boardLayer.add(routeDot);
      }
    }
  }

  private drawTileMark(tile: Tile, x: number, y: number): void {
    if (!this.boardLayer) return;
    if (tile.type === 'beacon') {
      const lit = tile.visited;
      const ring = this.add.circle(x, y, this.metrics.cell * 0.23, lit ? 0xf8e7a1 : 0x263a3f, 0.95);
      ring.setStrokeStyle(3, 0xf3c969);
      const core = this.add.circle(x, y, this.metrics.cell * 0.07, 0xf3c969);
      this.boardLayer.add([ring, core]);
      return;
    }
    if (tile.type === 'gate') {
      const gate = this.add.rectangle(x, y + 2, this.metrics.cell * 0.42, this.metrics.cell * 0.52, 0x14252b, 0.9);
      gate.setStrokeStyle(3, this.beacons >= 2 ? 0xf4f0e2 : 0x85938f);
      const label = this.add
        .text(x, y, this.beacons >= 2 ? 'GO' : '2', {
          fontFamily: 'Arial Black',
          fontSize: Math.max(11, this.metrics.cell * 0.2),
          color: this.beacons >= 2 ? '#f4f0e2' : '#85938f',
        })
        .setOrigin(0.5);
      this.boardLayer.add([gate, label]);
      return;
    }
    const label = TERRAIN[tile.type].label;
    if (label) {
      const mark = this.add
        .text(x, y, label, {
          fontFamily: 'Arial Black',
          fontSize: Math.max(13, this.metrics.cell * 0.25),
          color: tile.type === 'start' ? '#18313a' : '#f4f0e2',
        })
        .setOrigin(0.5);
      this.boardLayer.add(mark);
    }
  }

  private async finishRun(completed: boolean, message: string): Promise<void> {
    if (this.ended) return;
    this.ended = true;
    this.ready = false;
    this.timerEvent?.remove(false);
    if (completed) this.score += 300 + this.secondsLeft * 4 + this.beacons * 80;
    this.setStatus(message, !completed);
    this.renderAll();
    this.showResult(completed, 'Saving route...');

    const submission: RunSubmission = {
      score: this.score,
      beacons: this.beacons,
      steps: this.steps,
      completed,
      durationMs: Math.max(0, Date.now() - this.startTime),
    };
    try {
      const response = await fetch('/api/run', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(submission),
      });
      if (!response.ok) throw new Error(`API ${response.status}`);
      const data: unknown = await response.json();
      if (!isInitResponse(data)) throw new Error('Unexpected API response');
      this.applyServerState(data);
      const improved = Reflect.get(data, 'improved') === true;
      this.showResult(completed, improved ? 'New daily best. Route added to the community.' : 'Route saved. Your daily best still stands.');
      this.renderHud();
    } catch (error) {
      console.warn('Practice result was not uploaded:', error);
      this.showResult(completed, 'Practice result complete. Connect on Reddit to add it.');
    }
  }

  private showResult(completed: boolean, detail: string): void {
    this.resultLayer?.destroy(true);
    const width = this.scale.width;
    const height = this.scale.height;
    const layer = this.add.container(0, 0).setDepth(50);
    const veil = this.add.rectangle(0, 0, width, height, 0x03080b, 0.78).setOrigin(0);
    const panelWidth = Math.min(430, width - 28);
    const panelHeight = Math.min(330, height - 40);
    const panel = this.add
      .rectangle(width / 2, height / 2, panelWidth, panelHeight, 0x0d2027, 0.98)
      .setStrokeStyle(2, completed ? 0xf3c969 : 0x4c6670);
    const kicker = this.add
      .text(width / 2, height / 2 - panelHeight * 0.33, completed ? 'ROUTE COMPLETE' : 'ROUTE ENDED', {
        fontFamily: 'Arial Black',
        fontSize: 14,
        color: completed ? '#f3c969' : '#91aaa6',
        letterSpacing: 2,
      })
      .setOrigin(0.5);
    const score = this.add
      .text(width / 2, height / 2 - panelHeight * 0.13, String(this.score), {
        fontFamily: 'Arial Black',
        fontSize: 52,
        color: '#f4f0e2',
      })
      .setOrigin(0.5);
    const currentBest = Math.max(this.player.bestScore, this.score);
    const stats = this.add
      .text(
        width / 2,
        height / 2 + panelHeight * 0.05,
        `${this.beacons} beacons  /  ${this.steps} steps  /  best ${currentBest}`,
        {
        fontFamily: 'Arial',
        fontSize: 16,
        color: '#bed0cb',
        }
      )
      .setOrigin(0.5);
    const detailText = this.add
      .text(width / 2, height / 2 + panelHeight * 0.18, detail, {
        fontFamily: 'Arial',
        fontSize: 14,
        color: '#91aaa6',
        align: 'center',
        wordWrap: { width: panelWidth - 48 },
      })
      .setOrigin(0.5);
    const retryBackground = this.add
      .rectangle(width / 2, height / 2 + panelHeight * 0.36, 170, 42, 0xe05d44)
      .setInteractive({ useHandCursor: true });
    const retryText = this.add
      .text(width / 2, height / 2 + panelHeight * 0.36 - 1, 'TRY TODAY AGAIN', {
        fontFamily: 'Arial Black',
        fontSize: 14,
        color: '#ffffff',
      })
      .setOrigin(0.5);
    retryBackground.on('pointerdown', () => this.startRun());
    layer.add([veil, panel, kicker, score, stats, detailText, retryBackground, retryText]);
    this.resultLayer = layer;
  }

  private updateLayout(width: number, height: number): void {
    this.cameras.resize(width, height);
    this.drawBackground(width, height);
    const compact = width < 620;
    this.titleText?.setFontSize(compact ? 23 : 28).setPosition(18, 15);
    this.dayText?.setFontSize(compact ? 11 : 14).setPosition(20, compact ? 45 : 52);

    const hudY = compact ? 82 : 84;
    const spread = Math.min(390, width - 36);
    const center = width / 2;
    this.energyText?.setPosition(center - spread * 0.34, hudY);
    this.scoreText?.setPosition(center, hudY);
    this.timerText?.setPosition(center + spread * 0.34, hudY);

    this.progressText?.setPosition(20, compact ? 106 : 108).setFontSize(compact ? 11 : 13);
    this.progressTrack?.setPosition(20, compact ? 125 : 129);
    this.progressFill?.setPosition(20, compact ? 125 : 129);

    const top = compact ? 145 : 148;
    const bottomSpace = compact ? 170 : 152;
    const cell = Math.floor(Math.min(70, (width - 32 - (COLS - 1) * 5) / COLS, (height - top - bottomSpace) / ROWS));
    const safeCell = Math.max(34, cell);
    const gap = safeCell < 45 ? 3 : 5;
    const boardWidth = COLS * safeCell + (COLS - 1) * gap;
    this.metrics = { left: (width - boardWidth) / 2, top, cell: safeCell, gap };

    const boardHeight = ROWS * safeCell + (ROWS - 1) * gap;
    const boardBottom = top + boardHeight;
    this.statusText?.setPosition(width / 2, Math.min(height - 92, boardBottom + 26));
    this.statusText?.setFontSize(compact ? 14 : 17).setWordWrapWidth(width - 34);
    this.hintText?.setPosition(width / 2, Math.min(height - 68, boardBottom + 50));
    this.hintText?.setFontSize(compact ? 11 : 13).setWordWrapWidth(width - 34);
    this.overchargeButton?.setPosition(width / 2, height - 32);
    this.renderAll();
  }

  private drawBackground(width: number, height: number): void {
    if (!this.backgroundLayer) return;
    this.backgroundLayer.clear();
    this.backgroundLayer.fillStyle(0x071017, 1).fillRect(0, 0, width, height);
    this.backgroundLayer.fillStyle(0x0c1d23, 1).fillRect(0, 0, width, 140);
    this.backgroundLayer.lineStyle(1, 0x1b3840, 0.55);
    for (let x = -height; x < width; x += 48) {
      this.backgroundLayer.beginPath().moveTo(x, height).lineTo(x + height, 0).strokePath();
    }
    this.backgroundLayer.fillStyle(0x47c9d8, 0.08).fillCircle(width * 0.86, height * 0.18, Math.min(width, height) * 0.2);
    this.backgroundLayer.fillStyle(0xe05d44, 0.05).fillCircle(width * 0.08, height * 0.72, Math.min(width, height) * 0.18);
  }
}
