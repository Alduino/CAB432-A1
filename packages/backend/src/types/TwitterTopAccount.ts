export interface TwitterTopAccount {
    id: string;
    name: string;
    username: string;
    description: string;
    accountLinks: string[];
    verified: boolean;
    pinnedTweetId?: string;
}
