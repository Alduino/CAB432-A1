export function requireOkResponse(res: Response): Response {
    if (res.ok) return res;
    throw new Error(`${res.status} ${res.statusText}`);
}
