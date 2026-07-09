import { Scene } from 'phaser';
import * as Phaser from 'phaser';
import type { InitResponse, QuestAction, QuestMilestone, QuestTotals, VoteResponse } from '../../shared/api';

const ACTIONS: QuestAction[] = ['explore', 'bridge', 'beacon'];

const ACTION_COPY: Record<QuestAction, { label: string; detail: string; color: number }> = {
  explore: {
    label: 'Explore',
    detail: 'Reveal more fog',
    color: 0x3ddc97,
  },
  bridge: {
    label: 'Bridge',
    detail: 'Connect islands',
    color: 0xffc857,
  },
  beacon: {
    label: 'Beacon',
    detail: 'Guide late players',
    color: 0x59c3ff,
  },
};

type QuestState = {
  dayKey: string;
  username: string;
  totals: QuestTotals;
  playerChoice: QuestAction | null;
  milestone: QuestMilestone;
};

const EMPTY_TOTALS: QuestTotals = {
  explore: 0,
  bridge: 0,
  beacon: 0,
};

const EMPTY_MILESTONE: QuestMilestone = {
  total: 0,
  title: 'Waiting for the first party',
  detail: 'Every action helps the whole subreddit reveal more of the map.',
};

export class Game extends Scene {
  private background: Phaser.GameObjects.Rectangle | null = null;
  private titleText: Phaser.GameObjects.Text | null = null;
  private subtitleText: Phaser.GameObjects.Text | null = null;
  private milestoneText: Phaser.GameObjects.Text | null = null;
  private detailText: Phaser.GameObjects.Text | null = null;
  private statsText: Phaser.GameObjects.Text | null = null;
  private playerText: Phaser.GameObjects.Text | null = null;
  private actionButtons: Partial<Record<QuestAction, Phaser.GameObjects.Container>> = {};
  private mapLayer: Phaser.GameObjects.Container | null = null;
  private state: QuestState = {
    dayKey: 'loading',
    username: 'anonymous',
    totals: { ...EMPTY_TOTALS },
    playerChoice: null,
    milestone: EMPTY_MILESTONE,
  };

  constructor() {
    super('Game');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x07131d);
    this.background = this.add.rectangle(0, 0, 10, 10, 0x07131d).setOrigin(0);

    this.titleText = this.add.text(0, 0, 'Thread Quest Daily', {
      fontFamily: 'Arial Black',
      fontSize: 42,
      color: '#f7f4e8',
    });
    this.subtitleText = this.add.text(0, 0, 'One post. One map. One community decision per day.', {
      fontFamily: 'Arial',
      fontSize: 20,
      color: '#a7c7c5',
    });
    this.milestoneText = this.add.text(0, 0, this.state.milestone.title, {
      fontFamily: 'Arial Black',
      fontSize: 26,
      color: '#ffffff',
      wordWrap: { width: 460 },
    });
    this.detailText = this.add.text(0, 0, this.state.milestone.detail, {
      fontFamily: 'Arial',
      fontSize: 17,
      color: '#c9d6d5',
      lineSpacing: 6,
      wordWrap: { width: 460 },
    });
    this.statsText = this.add.text(0, 0, '', {
      fontFamily: 'Arial',
      fontSize: 18,
      color: '#f7f4e8',
      lineSpacing: 8,
    });
    this.playerText = this.add.text(0, 0, '', {
      fontFamily: 'Arial',
      fontSize: 16,
      color: '#a7c7c5',
    });
    this.mapLayer = this.add.container(0, 0);

    for (const action of ACTIONS) {
      this.actionButtons[action] = this.createActionButton(action);
    }

    this.updateLayout(this.scale.width, this.scale.height);
    this.renderState();
    void this.loadState();

    this.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
      this.updateLayout(gameSize.width, gameSize.height);
    });
  }

  private createActionButton(action: QuestAction): Phaser.GameObjects.Container {
    const copy = ACTION_COPY[action];
    const container = this.add.container(0, 0);
    const bg = this.add
      .rectangle(0, 0, 210, 76, 0x102330)
      .setStrokeStyle(2, copy.color)
      .setInteractive({ useHandCursor: true });
    const label = this.add
      .text(-82, -24, copy.label, {
        fontFamily: 'Arial Black',
        fontSize: 22,
        color: '#ffffff',
      })
      .setOrigin(0, 0);
    const detail = this.add
      .text(-82, 8, copy.detail, {
        fontFamily: 'Arial',
        fontSize: 14,
        color: '#a7c7c5',
      })
      .setOrigin(0, 0);
    const dot = this.add.circle(-98, 0, 8, copy.color);

    container.add([bg, dot, label, detail]);
    bg.on('pointerover', () => bg.setFillStyle(0x173448));
    bg.on('pointerout', () => bg.setFillStyle(0x102330));
    bg.on('pointerdown', () => {
      void this.vote(action);
    });
    return container;
  }

  private async loadState(): Promise<void> {
    try {
      const response = await fetch('/api/init');
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      const data = (await response.json()) as InitResponse;
      this.applyState(data);
    } catch (error) {
      console.error('Failed to fetch Thread Quest state:', error);
    }
  }

  private async vote(action: QuestAction): Promise<void> {
    try {
      const response = await fetch('/api/vote', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      const data = (await response.json()) as VoteResponse;
      this.applyState(data);
    } catch (error) {
      console.error('Failed to submit Thread Quest action:', error);
    }
  }

  private applyState(data: InitResponse | VoteResponse): void {
    this.state = {
      dayKey: data.dayKey,
      username: data.username,
      totals: data.totals,
      playerChoice: data.playerChoice,
      milestone: data.milestone,
    };
    this.renderState();
  }

  private renderState(): void {
    this.milestoneText?.setText(this.state.milestone.title);
    this.detailText?.setText(this.state.milestone.detail);
    this.statsText?.setText(
      [
        `Explore: ${this.state.totals.explore}`,
        `Bridge: ${this.state.totals.bridge}`,
        `Beacon: ${this.state.totals.beacon}`,
        `Total moves today: ${this.state.milestone.total}`,
      ].join('\n')
    );
    this.playerText?.setText(
      this.state.playerChoice
        ? `u/${this.state.username}, today you chose ${ACTION_COPY[this.state.playerChoice].label}.`
        : `u/${this.state.username}, choose one action for ${this.state.dayKey}.`
    );

    for (const action of ACTIONS) {
      const button = this.actionButtons[action];
      const selected = this.state.playerChoice === action;
      const bg = button?.list[0] as Phaser.GameObjects.Rectangle | undefined;
      bg?.setStrokeStyle(selected ? 5 : 2, ACTION_COPY[action].color);
    }
    this.drawMap();
  }

  private drawMap(): void {
    if (!this.mapLayer) return;
    this.mapLayer.removeAll(true);

    const total = this.state.milestone.total;
    const revealCount = Math.min(35, 8 + total * 2);
    const tileSize = 42;
    const gap = 6;
    const cols = 7;
    const rows = 5;

    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        const index = y * cols + x;
        const visible = index < revealCount || (x === 3 && y === 2);
        const hash = (x * 19 + y * 31 + this.state.dayKey.length * 7) % 5;
        const terrain = visible ? [0x21485c, 0x296a5f, 0x4a6d3b, 0x6b5737, 0x20405a][hash] : 0x0d1c28;
        const tile = this.add
          .rectangle(x * (tileSize + gap), y * (tileSize + gap), tileSize, tileSize, terrain)
          .setStrokeStyle(1, visible ? 0x5e8c8a : 0x173448);
        this.mapLayer.add(tile);
        if (!visible) continue;

        if (this.state.totals.bridge > y + x && (x + y) % 4 === 0) {
          this.mapLayer.add(
            this.add.rectangle(x * (tileSize + gap), y * (tileSize + gap), 26, 6, ACTION_COPY.bridge.color)
          );
        }
        if (this.state.totals.beacon > index % 9) {
          this.mapLayer.add(
            this.add.circle(
              x * (tileSize + gap) + 12,
              y * (tileSize + gap) - 12,
              5,
              ACTION_COPY.beacon.color
            )
          );
        }
      }
    }
  }

  private updateLayout(width: number, height: number): void {
    this.cameras.resize(width, height);
    this.background?.setSize(width, height);

    const scaleFactor = Math.min(Math.min(width / 1024, height / 768), 1);
    this.titleText?.setPosition(48, 40).setScale(scaleFactor);
    this.subtitleText?.setPosition(50, 96).setScale(scaleFactor);
    this.mapLayer?.setPosition(width * 0.57, height * 0.2).setScale(scaleFactor);
    this.milestoneText?.setPosition(50, height * 0.2).setScale(scaleFactor);
    this.detailText?.setPosition(50, height * 0.29).setScale(scaleFactor);
    this.statsText?.setPosition(50, height * 0.43).setScale(scaleFactor);
    this.playerText?.setPosition(50, height * 0.73).setScale(scaleFactor);

    ACTIONS.forEach((action, index) => {
      this.actionButtons[action]?.setPosition(160 + index * 230, height * 0.86).setScale(scaleFactor);
    });
  }
}
