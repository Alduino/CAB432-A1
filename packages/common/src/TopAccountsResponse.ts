export interface TopAccount {
    // ID to use when querying Tweetch's api. Same as `twitterId`.
    id: string;
    twitterId: string;
    twitterName: string;
    twitterUsername: string;
    twitterVerified: boolean;
    twitchId: string;
    twitchName: string;
    isLiveOnTwitch: boolean;
    description: string;
}

export default interface TopAccountsResponse {
    data: TopAccount[];
}
