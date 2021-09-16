import {requireOkResponse} from "@cab432-a1/common";

export default function fetchJson<T>(url: string): Promise<T> {
    return fetch(url)
        .then(requireOkResponse)
        .then(res => res.json());
}
