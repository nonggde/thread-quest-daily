import * as Phaser from 'phaser';
import { AUTO, Game } from 'phaser';
import { Game as QuestGame } from './scenes/Game';

const config: Phaser.Types.Core.GameConfig = {
  type: AUTO,
  parent: 'game-container',
  backgroundColor: '#071017',
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 800,
    height: 900,
  },
  scene: [QuestGame],
};

function startGame(parent: string): Game {
  return new Game({ ...config, parent });
}

document.addEventListener('DOMContentLoaded', () => {
  startGame('game-container');
});
