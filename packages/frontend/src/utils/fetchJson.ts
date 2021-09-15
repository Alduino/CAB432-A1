import {requireOkResponse} from "./require-response";

export default function fetchJson<T>(url: string): Promise<T> {
    return fetch(url)
        .then(requireOkResponse)
        .then(res => res.json());
}
