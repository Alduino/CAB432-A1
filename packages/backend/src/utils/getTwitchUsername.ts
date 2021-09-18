const twitchLinkRegex = /https:\/\/(?:www\.)?twitch\.tv\/([0-9a-z_-]+)/i;

export function getTwitchUsername(source: string): string | undefined {
    const match = source.match(twitchLinkRegex);
    if (!match) return;
    return match[1].toLowerCase().trim();
}
