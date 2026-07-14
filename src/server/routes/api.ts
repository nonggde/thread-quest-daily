import { context, redis, reddit } from '@devvit/web/server';
import { Hono } from 'hono';
import type {
  CommunityMilestone,
  CommunityState,
  InitResponse,
  PlayerState,
  RunResponse,
  RunSubmission,
} from '../../shared/api';

type ErrorResponse = {
  status: 'error';
  message: string;
};

const MAX_SCORE = 10000;
const MAX_STEPS = 56;
const MAX_DURATION_MS = 10 * 60 * 1000;

export const api = new Hono();

function dayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function dailyKey(postId: string, day: string): string {
  return `thread-quest:v2:${postId}:${day}`;
}

function dailySeed(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function parseCounter(value: string | undefined): number {
  if (!value) return 0;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function milestoneFor(score: number): CommunityMilestone {
  const tiers = [5000, 20000, 50000, 100000];
  const titles = ['Signal detected', 'Trail mapped', 'Relay network online', 'North gate stabilized'];
  const details = [
    'The first expeditions are leaving a trail for the subreddit.',
    'Shared route data now reveals safer paths through the storm.',
    'Enough beacons are live to guide every late explorer.',
    'The community has completed today\'s expedition together.',
  ];
  const level = tiers.findIndex((target) => score < target);
  const resolvedLevel = level === -1 ? tiers.length : level;
  const finalTarget = tiers[tiers.length - 1] ?? 100000;
  const previousTarget =
    resolvedLevel === 0 ? 0 : (tiers[Math.min(resolvedLevel - 1, tiers.length - 1)] ?? 0);
  const nextTarget = resolvedLevel < tiers.length ? (tiers[resolvedLevel] ?? finalTarget) : finalTarget;
  const span = Math.max(1, nextTarget - previousTarget);
  const progress = resolvedLevel >= tiers.length ? 1 : Math.min(1, (score - previousTarget) / span);
  const copyIndex = Math.min(resolvedLevel, titles.length - 1);
  return {
    level: resolvedLevel,
    nextTarget,
    progress,
    title: titles[copyIndex] ?? 'North gate stabilized',
    detail: details[copyIndex] ?? 'The community has completed today\'s expedition together.',
  };
}

async function readCommunity(baseKey: string): Promise<CommunityState> {
  const [scoreValue, runsValue, beaconsValue, successesValue] = await Promise.all([
    redis.get(`${baseKey}:score`),
    redis.get(`${baseKey}:runs`),
    redis.get(`${baseKey}:beacons`),
    redis.get(`${baseKey}:successes`),
  ]);
  const score = parseCounter(scoreValue);
  return {
    score,
    runs: parseCounter(runsValue),
    beacons: parseCounter(beaconsValue),
    successes: parseCounter(successesValue),
    milestone: milestoneFor(score),
  };
}

async function readPlayer(baseKey: string, username: string): Promise<PlayerState> {
  const [scoreValue, beaconsValue, completedValue] = await Promise.all([
    redis.get(`${baseKey}:player:${username}:score`),
    redis.get(`${baseKey}:player:${username}:beacons`),
    redis.get(`${baseKey}:player:${username}:completed`),
  ]);
  return {
    bestScore: parseCounter(scoreValue),
    bestBeacons: parseCounter(beaconsValue),
    completed: completedValue === '1',
  };
}

function isIntegerInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

function isRunSubmission(value: unknown): value is RunSubmission {
  if (typeof value !== 'object' || value === null) return false;
  return (
    isIntegerInRange(Reflect.get(value, 'score'), 0, MAX_SCORE) &&
    isIntegerInRange(Reflect.get(value, 'beacons'), 0, 3) &&
    isIntegerInRange(Reflect.get(value, 'steps'), 0, MAX_STEPS) &&
    typeof Reflect.get(value, 'completed') === 'boolean' &&
    isIntegerInRange(Reflect.get(value, 'durationMs'), 0, MAX_DURATION_MS)
  );
}

async function buildInit(postId: string, username: string, day: string): Promise<InitResponse> {
  const baseKey = dailyKey(postId, day);
  const [community, player] = await Promise.all([
    readCommunity(baseKey),
    readPlayer(baseKey, username),
  ]);
  return {
    type: 'init',
    postId,
    username,
    dayKey: day,
    seed: dailySeed(`${postId}:${day}`),
    community,
    player,
  };
}

api.get('/init', async (c) => {
  const { postId } = context;
  if (!postId) {
    return c.json<ErrorResponse>({ status: 'error', message: 'postId is required' }, 400);
  }
  try {
    const username = (await reddit.getCurrentUsername()) ?? 'anonymous';
    return c.json<InitResponse>(await buildInit(postId, username, dayKey()));
  } catch (error) {
    console.error('Thread Quest init failed:', error);
    return c.json<ErrorResponse>({ status: 'error', message: 'Unable to load today\'s expedition' }, 500);
  }
});

api.post('/run', async (c) => {
  const { postId } = context;
  if (!postId) {
    return c.json<ErrorResponse>({ status: 'error', message: 'postId is required' }, 400);
  }
  const body: unknown = await c.req.json().catch(() => null);
  if (!isRunSubmission(body)) {
    return c.json<ErrorResponse>({ status: 'error', message: 'Invalid expedition result' }, 400);
  }

  try {
    const username = (await reddit.getCurrentUsername()) ?? 'anonymous';
    const day = dayKey();
    const baseKey = dailyKey(postId, day);
    const player = await readPlayer(baseKey, username);
    const nextScore = Math.max(player.bestScore, body.score);
    const nextBeacons = Math.max(player.bestBeacons, body.beacons);
    const nextCompleted = player.completed || body.completed;
    const improved = nextScore > player.bestScore;

    const writes: Promise<unknown>[] = [];
    if (nextScore > player.bestScore) {
      writes.push(redis.set(`${baseKey}:player:${username}:score`, String(nextScore)));
      writes.push(redis.incrBy(`${baseKey}:score`, nextScore - player.bestScore));
    }
    if (nextBeacons > player.bestBeacons) {
      writes.push(redis.set(`${baseKey}:player:${username}:beacons`, String(nextBeacons)));
      writes.push(redis.incrBy(`${baseKey}:beacons`, nextBeacons - player.bestBeacons));
    }
    if (player.bestScore === 0 && body.steps > 0) {
      writes.push(redis.incrBy(`${baseKey}:runs`, 1));
    }
    if (!player.completed && nextCompleted) {
      writes.push(redis.set(`${baseKey}:player:${username}:completed`, '1'));
      writes.push(redis.incrBy(`${baseKey}:successes`, 1));
    }
    await Promise.all(writes);

    const init = await buildInit(postId, username, day);
    return c.json<RunResponse>({ ...init, type: 'run', improved });
  } catch (error) {
    console.error('Thread Quest run submission failed:', error);
    return c.json<ErrorResponse>({ status: 'error', message: 'Unable to save expedition result' }, 500);
  }
});
