export interface StreamTweet {
    tweetId: string;
    authorDisplayName: string;
    authorUsername: string;
    authorIsVerified: boolean;
    profilePicUrl?: string;
    publishTime: string;
    source: string;
}

export default interface StreamTweetsResponse {
    data: StreamTweet[];
}
