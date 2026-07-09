# Reddit Games with a Hook Submission Notes

## Project

- Name: `Thread Quest Daily`
- Repository: https://github.com/nonggde/thread-quest-daily
- Hackathon: https://redditgameswithahook.devpost.com/
- Deadline: July 15, 2026 at 6:00 PM PDT

## Concept

Thread Quest Daily is a daily cooperative map game for a subreddit. Each redditor gets one daily action:

- `Explore`: reveal more fog.
- `Bridge`: connect islands.
- `Beacon`: guide late players.

The post shows the shared progress for the day, so the comment thread has a common state to react to. The loop is designed for Reddit retention: one post, one daily map, one choice per user, visible collective milestones, and a reason to return tomorrow.

## Verification

```bash
npm run type-check
npm run lint
npm run build
```

All three passed locally after a clean dependency install.

## Remaining Account-Gated Steps

1. Log into Reddit Developer CLI:
   ```bash
   npm run login
   ```
2. Playtest the app on Reddit:
   ```bash
   npm run dev
   ```
3. Upload the app:
   ```bash
   npm run deploy
   ```
4. Create a public test subreddit with fewer than 200 members.
5. Install the app into that subreddit.
6. Create a public demo post running the game.
7. Submit on Devpost with:
   - App listing: `https://developers.reddit.com/apps/<app-name>`
   - Demo post: public subreddit post URL
   - Repo: https://github.com/nonggde/thread-quest-daily
   - Optional video under 1 minute
