import { context, redis, reddit } from '@devvit/web/server';
import { Hono } from 'hono';
import type {
  InitResponse,
  QuestAction,
  QuestMilestone,
  QuestTotals,
  VoteResponse,
} from '../../shared/api';

type ErrorResponse = {
  status: 'error';
  message: string;
};

const ACTIONS = ['explore', 'bridge', 'beacon'] as const satisfies readonly QuestAction[];

export const api = new Hono();

function dayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function questKey(postId: string, day: string): string {
  return `thread-quest:${postId}:${day}`;
}

function scoreMilestone(totals: QuestTotals): QuestMilestone {
  const total = ACTIONS.reduce((sum, action) => sum + totals[action], 0);
  if (total >= 18) {
    return {
      total,
      title: 'The commons found the hidden gate',
      detail: 'Tomorrow starts with a bonus path because the thread solved today together.',
    };
  }
  if (total >= 9) {
    return {
      total,
      title: 'A route is forming',
      detail: 'Enough redditors have acted that the island now shows a shared direction.',
    };
  }
  if (total >= 3) {
    return {
      total,
      title: 'First campfire lit',
      detail: 'The thread has enough signal for new visitors to understand the day plan.',
    };
  }
  return {
    total,
    title: 'Waiting for the first party',
    detail: 'Every action helps the whole subreddit reveal more of the map.',
  };
}

function isQuestAction(value: unknown): value is QuestAction {
  return typeof value === 'string' && ACTIONS.includes(value as QuestAction);
}

async function readTotals(baseKey: string): Promise<QuestTotals> {
  const values = await Promise.all(ACTIONS.map((action) => redis.get(`${baseKey}:action:${action}`)));
  return {
    explore: values[0] ? parseInt(values[0], 10) : 0,
    bridge: values[1] ? parseInt(values[1], 10) : 0,
    beacon: values[2] ? parseInt(values[2], 10) : 0,
  };
}

api.get('/init', async (c) => {
  const { postId } = context;

  if (!postId) {
    console.error('API Init Error: postId not found in devvit context');
    return c.json<ErrorResponse>(
      {
        status: 'error',
        message: 'postId is required but missing from context',
      },
      400
    );
  }

  try {
    const username = (await reddit.getCurrentUsername()) ?? 'anonymous';
    const day = dayKey();
    const baseKey = questKey(postId, day);
    const [totals, playerChoice] = await Promise.all([
      readTotals(baseKey),
      redis.get(`${baseKey}:player:${username}`),
    ]);

    return c.json<InitResponse>({
      type: 'init',
      postId,
      username,
      dayKey: day,
      totals,
      playerChoice: isQuestAction(playerChoice) ? playerChoice : null,
      milestone: scoreMilestone(totals),
    });
  } catch (error) {
    console.error(`API Init Error for post ${postId}:`, error);
    const errorMessage =
      error instanceof Error ? `Initialization failed: ${error.message}` : 'Unknown error';
    return c.json<ErrorResponse>({ status: 'error', message: errorMessage }, 400);
  }
});

api.post('/vote', async (c) => {
  const { postId } = context;
  if (!postId) {
    return c.json<ErrorResponse>(
      {
        status: 'error',
        message: 'postId is required',
      },
      400
    );
  }

  const body = (await c.req.json().catch(() => null)) as { action?: unknown } | null;
  if (!isQuestAction(body?.action)) {
    return c.json<ErrorResponse>(
      {
        status: 'error',
        message: 'action must be one of: explore, bridge, beacon',
      },
      400
    );
  }

  const username = (await reddit.getCurrentUsername()) ?? 'anonymous';
  const day = dayKey();
  const baseKey = questKey(postId, day);
  const playerKey = `${baseKey}:player:${username}`;
  const previous = await redis.get(playerKey);

  if (isQuestAction(previous) && previous !== body.action) {
    await redis.incrBy(`${baseKey}:action:${previous}`, -1);
  }
  if (previous !== body.action) {
    await redis.incrBy(`${baseKey}:action:${body.action}`, 1);
    await redis.set(playerKey, body.action);
  }

  const totals = await readTotals(baseKey);
  return c.json<VoteResponse>({
    type: 'vote',
    postId,
    username,
    action: body.action,
    dayKey: day,
    totals,
    playerChoice: body.action,
    milestone: scoreMilestone(totals),
  });
});
