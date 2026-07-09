import { reddit } from '@devvit/web/server';

export const createPost = async () => {
  return await reddit.submitCustomPost({
    title: "Thread Quest Daily: help the subreddit reveal today's map",
  });
};
