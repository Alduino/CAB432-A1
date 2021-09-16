interface Response {
    ok: boolean;
    status: number;
    statusText: string;

    text(): Promise<string>;
}

export interface ResponseError extends Error {
    response: Response;
}

export function isResponseError(err: Error): err is ResponseError {
    if (!err) return false;
    return typeof (err as ResponseError).response === "object";
}

async function getResponseError(res: Response): Promise<Error> {
    const response = await res.text();

    try {
        const json = JSON.parse(response);
        const err = new Error(`${res.statusText}: ${json.message ?? json.error}\nRaw response: ${response}`) as ResponseError;
        err.response = res;
        return err;
    } catch {
        const err = new Error(`${res.status}: ${res.statusText}\nRaw response: ${response}`) as ResponseError;
        err.response = res;
        return err;
    }
}

export async function requireOkResponse<T extends Response>(res: T): Promise<T> {
    if (res.ok) return res;
    throw await getResponseError(res);
}
