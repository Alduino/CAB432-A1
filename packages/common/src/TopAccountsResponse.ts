export interface TopAccount {
    // ID to use when querying Tweetch's api. Same as `twitterId`.
    id: string;
    twitterId: string;
    twitterLogin: string;
    twitterVerified: boolean;
    twitchId: string;
    twitchLogin: string;
    twitchStreamId?: string;
    profilePictureUrl: string;
    notLiveCoverUrl: string;
    displayName: string;
    description: string;
    youtube?: {
        id: string;
        title: string;
        embedHtml: string;
    };
}

export default interface TopAccountsResponse {
    data: TopAccount[];
}
