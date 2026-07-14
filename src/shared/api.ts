export type CommunityMilestone = {
  level: number;
  nextTarget: number;
  progress: number;
  title: string;
  detail: string;
};

export type CommunityState = {
  score: number;
  runs: number;
  beacons: number;
  successes: number;
  milestone: CommunityMilestone;
};

export type PlayerState = {
  bestScore: number;
  bestBeacons: number;
  completed: boolean;
};

export type InitResponse = {
  type: 'init';
  postId: string;
  username: string;
  dayKey: string;
  seed: number;
  community: CommunityState;
  player: PlayerState;
};

export type RunSubmission = {
  score: number;
  beacons: number;
  steps: number;
  completed: boolean;
  durationMs: number;
};

export type RunResponse = Omit<InitResponse, 'type'> & {
  type: 'run';
  improved: boolean;
};
