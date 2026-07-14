import { context, requestExpandedMode } from '@devvit/web/client';

const startButton = document.getElementById('start-button');
const playerName = document.getElementById('player-name');
const communityScore = document.getElementById('community-score');
const runCount = document.getElementById('run-count');

if (startButton instanceof HTMLButtonElement) {
  startButton.addEventListener('click', (event) => {
    requestExpandedMode(event, 'game');
  });
}

if (playerName) playerName.textContent = `Daily map ready for u/${context.username ?? 'explorer'}`;

async function loadCommunity(): Promise<void> {
  try {
    const response = await fetch('/api/init');
    if (!response.ok) return;
    const data: unknown = await response.json();
    if (typeof data !== 'object' || data === null) return;
    const community = Reflect.get(data, 'community');
    if (typeof community !== 'object' || community === null) return;
    const score = Reflect.get(community, 'score');
    const runs = Reflect.get(community, 'runs');
    if (communityScore && typeof score === 'number') communityScore.textContent = String(score);
    if (runCount && typeof runs === 'number') runCount.textContent = String(runs);
  } catch {
    // The expanded game provides an offline practice map if the feed request is unavailable.
  }
}

void loadCommunity();
