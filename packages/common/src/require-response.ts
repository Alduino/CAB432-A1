interface Response {
    ok: boolean;
    status: number;
    statusText: string;

    text(): Promise<string>;
}

async function getResponseError(res: Response): Promise<Error> {
    const response = await res.text();

    try {
        const json = JSON.parse(response);
        return new Error(`${res.statusText}: ${json.message ?? json.error}\nRaw response: ${response}`);
    } catch {
        return new Error(`${res.status}: ${res.statusText}\nRaw response: ${response}`);
    }
}

export async function requireOkResponse<T extends Response>(res: T): Promise<T> {
    if (res.ok) return res;
    throw await getResponseError(res);
}
