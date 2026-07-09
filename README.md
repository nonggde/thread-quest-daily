## Thread Quest Daily

Thread Quest Daily is a Reddit Devvit + Phaser prototype for Reddit's Games
with a Hook Hackathon. It turns one interactive post into a daily cooperative
map: each redditor gets one action for the day, and the shared map changes as
the thread collectively chooses to explore, bridge, or light beacons.

The retention loop is intentionally Reddit-native:

- a fresh daily map key,
- one lightweight vote per user per day,
- shared progress that makes late visitors understand the thread state,
- visible collective milestones that invite comments and return visits.

## Devvit Phaser Starter Base

A starter to build web applications on Reddit's developer platform

- [Devvit](https://developers.reddit.com/): A way to build and deploy immersive games on Reddit
- [Vite](https://vite.dev/): For compiling the webView
- [Phaser](https://phaser.io/): 2D game engine
- [Hono](https://hono.dev/): For backend logic
- [TypeScript](https://www.typescriptlang.org/): For type safety

## Getting Started

> Make sure you have Node 22 downloaded on your machine before running!

1. Run `npm create devvit@latest --template=phaser`
2. Go through the installation wizard. You will need to create a Reddit account and connect it to Reddit developers
3. Copy the command on the success page into your terminal

## Commands

- `npm run dev`: Starts a development server where you can develop your application live on Reddit.
- `npm run build`: Builds your client and server projects
- `npm run deploy`: Uploads a new version of your app
- `npm run launch`: Publishes your app for review
- `npm run login`: Logs your CLI into Reddit
- `npm run type-check`: Type checks, lints, and prettifies your app

## Hackathon Submission Checklist

- App listing: requires a Reddit Developer account and `devvit upload`.
- Demo post: requires installing the app into a public test subreddit with fewer than 200 members.
- Devpost submission: requires the app listing URL and public demo post URL.

## Credits

Thanks to the Phaser team for [providing a great template](https://github.com/phaserjs/template-vite-ts)!
