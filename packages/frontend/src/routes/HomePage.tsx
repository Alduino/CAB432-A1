import {DefaultRootResponse} from "@cab432-a1/common";
import {ReactElement} from "react";
import useSWR from "swr";
import {FollowingDisplay} from "../components/FollowingDisplay";
import fetchJson from "../utils/fetchJson";

export default function HomePage(): ReactElement {
    const {data: targetUserId, error: targetUserIdError} =
        useSWR<DefaultRootResponse>("/api/default-root", fetchJson);

    return (
        <FollowingDisplay
            userId={targetUserId?.id}
            isErrored={!!targetUserIdError}
        />
    );
}
