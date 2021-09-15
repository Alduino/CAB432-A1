import TwitchApi from "./TwitchApi";
import TwitchUser from "./TwitchUser";
import {TwitchStreamType} from "./types";

export default class TwitchStream {
    constructor(
        private readonly api: TwitchApi,
        private readonly data: TwitchStreamType
    ) {}

    get id(): string {
        return this.data.id;
    }

    get userId(): string {
        return this.data.user_id;
    }

    get userLogin(): string {
        return this.data.user_login;
    }

    get userName(): string {
        return this.data.user_name;
    }

    get gameId(): string {
        return this.data.game_id;
    }

    get getName(): string {
        return this.data.game_name;
    }

    get type(): string {
        return this.data.type;
    }

    get title(): string {
        return this.data.title;
    }

    get viewerCount(): number {
        return this.data.viewer_count;
    }

    get startedAt(): string {
        return this.data.started_at;
    }

    get language(): string {
        return this.data.language;
    }

    get thumbnailUrl(): string {
        return this.data.thumbnail_url;
    }

    get tagIds(): string[] {
        return this.data.tag_ids;
    }

    get isMature(): boolean {
        return this.data.is_mature;
    }

    getThumbnailUrl(width: number, height: number): string {
        return this.thumbnailUrl
            .replace("{width}", width.toString())
            .replace("{height}", height.toString());
    }

    async getUser(): Promise<TwitchUser> {
        const users = await this.api.getUsersByLogins([this.userLogin]);
        return users[this.userLogin];
    }
}
