import {
    AuthCheckResponse,
    AuthLinkResponse,
    AuthPollResponse,
    requireOkResponse
} from "@cab432-a1/common";
import {Button, Heading, Link, Text, useToast, VStack} from "@chakra-ui/react";
import {TwitterLogo} from "phosphor-react";
import {ReactElement, useEffect} from "react";
import {useAsyncCallback} from "react-async-hook";
import {Link as RouterLink, useHistory} from "react-router-dom";
import useSWR from "swr";
import fetchJson from "../utils/fetchJson";
import createPromiseDispatch from "../utils/promise-dispatch";

function openCentredWindow(url: string, width: number, height: number) {
    const left = Math.floor((screen.width - width) / 2);
    const top = Math.floor((screen.height - height) / 2);

    const featuresObj = {
        width,
        height,
        left,
        top
    };

    const features = Object.entries(featuresObj)
        .map(kv => kv.join("="))
        .join(",");

    const win = window.open(url, "_blank", features);
    if (!win) throw new Error("Popup was blocked");
    return win;
}

async function openLoginPopup(target: string): Promise<boolean> {
    const authWindow = openCentredWindow("/popup-loading.html", 400, 765);

    const completePromise = createPromiseDispatch<boolean>();

    async function poll(url: string, resolveWhenIncomplete: boolean) {
        try {
            const res = await fetch(url);
            const {isComplete, isFailed}: AuthPollResponse = await res.json();

            if (isComplete) {
                completePromise.resolve(true);
            } else if (isFailed || resolveWhenIncomplete) {
                completePromise.resolve(false);
            }
        } catch (err) {
            completePromise.reject(err);
        }
    }

    try {
        const links: AuthLinkResponse = await fetch(`/api/auth/${target}/init`)
            .then(requireOkResponse)
            .then(res => res.json());

        authWindow.location.assign(links.link);

        const checkInterval = setInterval(() => {
            if (authWindow.closed) poll(links.pollLink, true);
            else poll(links.pollLink, false);
        }, 2000);

        const result = await completePromise.promise;
        clearInterval(checkInterval);
        authWindow.close();
        return result;
    } catch {
        authWindow.close();
        return false;
    }
}

function doTwitterLogin() {
    return openLoginPopup("twitter");
}

export default function LoginPage(): ReactElement {
    const {push: pushHistory} = useHistory();

    const {
        result: twitterLoggedIn,
        loading: twitterLoading,
        error: twitterError,
        execute: handleTwitterLogin
    } = useAsyncCallback(doTwitterLogin);

    const {
        data: twitterInitial,
        isValidating: twitterInitialLoading
    } = useSWR<AuthCheckResponse>("/api/auth/twitter/check", fetchJson);

    const createToast = useToast();

    useEffect(() => {
        if (!twitterError) return;

        createToast({
            title: "Twitter login failed",
            description:
                process.env.NODE_ENV === "development" && twitterError.message,
            status: "error"
        });
    }, [twitterError]);

    const isTwitterLoggedIn =
        twitterLoggedIn || twitterInitial?.isLoggedIn;
    const twitterLabel = twitterInitial?.isLoggedIn ? `@${twitterInitial.identifier}` : "Log in to Twitter";

    useEffect(() => {
        if (!isTwitterLoggedIn || twitterInitialLoading) return;
        pushHistory("/home");
    }, [isTwitterLoggedIn, twitterInitialLoading, pushHistory]);

    return (
        <VStack spacing={4} p={4}>
            <Heading size="md">Log in</Heading>
            <Text>
                Log in to your Twitter account for personalised results.
            </Text>
            <Button
                isFullWidth={true}
                colorScheme="twitter"
                isDisabled={isTwitterLoggedIn}
                isLoading={twitterLoading || twitterInitialLoading}
                leftIcon={<TwitterLogo />}
                onClick={handleTwitterLogin}
            >
                {twitterLabel}
            </Button>

            <Text>
                Or{" "}
                <Link as={RouterLink} to="/home">
                    skip logging in
                </Link>
            </Text>
        </VStack>
    );
}
