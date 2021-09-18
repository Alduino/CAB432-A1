export const twitterConsumerKey = process.env.TWITTER_API_KEY as string;
if (!twitterConsumerKey) throw new Error("TWITTER_API_KEY must be set");

export const twitterConsumerSecret = process.env.TWITTER_API_SECRET as string;
if (!twitterConsumerSecret) throw new Error("TWITTER_API_SECRET must be set");

export const twitterBaseUserId = process.env.TWITTER_BASE_USER as string;
if (!twitterBaseUserId) throw new Error("TWITTER_BASE_USER must be set");

export const twitchApiKey = process.env.TWITCH_API_KEY as string;
if (!twitchApiKey) throw new Error("TWITCH_API_KEY must be set");

export const twitchApiSecret = process.env.TWITCH_API_SECRET as string;
if (!twitchApiSecret) throw new Error("TWITCH_API_SECRET must be set");

export const youtubeApiKey = process.env.YOUTUBE_API_KEY as string;
if (!youtubeApiKey) throw new Error("YOUTUBE_API_KEY must be set");
