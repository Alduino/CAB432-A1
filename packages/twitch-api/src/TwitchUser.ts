import TwitchApi from "./TwitchApi";
import {TwitchUserType} from "./types";

export default class TwitchUser {
    constructor(
        private readonly api: TwitchApi,
        private readonly data: TwitchUserType
    ) {}

    get broadcasterType(): string {
        return this.data.broadcaster_type;
    }

    get createdAt(): Date {
        return new Date(this.data.created_at);
    }

    get description(): string {
        return this.data.description;
    }

    get displayName(): string {
        return this.data.display_name;
    }

    get id(): string {
        return this.data.id;
    }

    get login(): string {
        return this.data.login;
    }

    get offlineImageUrl(): string {
        return this.data.offline_image_url;
    }

    get profileImageUrl(): string {
        return this.data.profile_image_url;
    }

    get type(): string {
        return this.data.type;
    }

    get viewCount(): number {
        return this.data.view_count;
    }
}
