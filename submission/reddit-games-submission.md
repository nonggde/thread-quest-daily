# Reddit Games with a Hook Submission Notes

## Project

- Name: `Thread Quest Daily`
- Repository: https://github.com/nonggde/thread-quest-daily
- App listing: https://developers.reddit.com/apps/thread-quest-daily
- Test community: https://www.reddit.com/r/thread_quest_dail_dev
- Demo post: https://www.reddit.com/r/thread_quest_dail_dev/comments/1uw5rza/thread_quest_daily_light_two_beacons_and_reach/
- Judge access: official `dr-admin-approve` app installed for Reddit administrators
- Devpost submission: https://devpost.com/software/thread-quest-daily
- Hackathon: https://redditgameswithahook.devpost.com/
- Deadline: July 15, 2026 at 6:00 PM PDT

## Concept

Thread Quest Daily is a 75-second daily route puzzle inside a Reddit post. Every
redditor receives the same deterministic 7x8 map for the day and must:

1. Spend limited energy to cross terrain.
2. Light at least two of three beacons.
3. Reach the north gate before time expires.

Terrain variety builds a combo, relay tiles restore energy, and a one-use
Overcharge provides a strategic rescue. Each player's best score is saved for
the day and contributes to a shared subreddit signal. Repeat runs are welcome,
but only improvements increase the community total.

## Hook

The post is not a link to a game; it is the game. The inline feed card displays
live community progress, while expanded mode provides the full Phaser run.
Daily shared maps create route discussion and a reason to return the next day.

## Technical Details

- Devvit Web custom post with separate inline and expanded entrypoints
- Phaser 4 responsive game client
- Hono API in Devvit's serverless runtime
- Devvit Redis for daily player bests and community totals
- Deterministic daily seed based on post ID and UTC date
- Server-side payload bounds and best-score delta accounting

## Verification

```bash
npm run type-check
npm run lint
npm run build
```

All three passed locally after a clean dependency install. A full mobile
playthrough also completed successfully with a score of `3178`.

## Submission Checklist

- [x] Build the complete game loop.
- [x] Verify desktop and mobile layouts.
- [x] Upload Devvit app version `0.0.2`.
- [x] Create a private playtest and complete a successful run.
- [x] Install `dr-admin-approve` so Reddit judges can access the private test community.
- [x] Install app version `0.0.2` and verify the playable feed card.
- [x] Push final source and documentation to GitHub.
- [x] Submit the final Devpost entry.
