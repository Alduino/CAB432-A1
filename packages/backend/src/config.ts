export const twitterConsumerKey = process.env.TWITTER_API_KEY as string;
if (!twitterConsumerKey) throw new Error("TWITTER_API_KEY must be set");

export const twitterConsumerSecret = process.env.TWITTER_API_SECRET as string;
if (!twitterConsumerSecret) throw new Error("TWITTER_API_SECRET must be set");

export const twitchApiKey = process.env.TWITCH_API_KEY as string;
if (!twitchApiKey) throw new Error("TWITCH_API_KEY must be set");
