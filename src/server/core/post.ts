import { reddit } from '@devvit/web/server';

export const createPost = async () => {
  return await reddit.submitCustomPost({
    title: "Thread Quest Daily: light two beacons and reach the north gate",
  });
};
