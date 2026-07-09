export type QuestAction = 'explore' | 'bridge' | 'beacon';

export type QuestTotals = Record<QuestAction, number>;

export type QuestMilestone = {
  total: number;
  title: string;
  detail: string;
};

export type InitResponse = {
  type: 'init';
  postId: string;
  username: string;
  dayKey: string;
  totals: QuestTotals;
  playerChoice: QuestAction | null;
  milestone: QuestMilestone;
};

export type VoteResponse = {
  type: 'vote';
  postId: string;
  username: string;
  action: QuestAction;
  dayKey: string;
  totals: QuestTotals;
  playerChoice: QuestAction;
  milestone: QuestMilestone;
};
