import TwitchResponse from "./TwitchResponse";

export default interface TwitchCursorResponse<T> extends TwitchResponse<T> {
    pagination: {
        cursor?: string;
    }
}
