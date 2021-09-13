import {Button, Heading, Link, Text, VStack} from "@chakra-ui/react";
import {TwitchLogo, TwitterLogo} from "phosphor-react";
import {ReactElement} from "react";
import {useAsyncCallback} from "react-async-hook";
import {Link as RouterLink} from "react-router-dom";

async function doTwitterLogin() {
    await new Promise(yay => setTimeout(yay, 1000));
    return true;
}

async function doTwitchLogin() {
    await new Promise(yay => setTimeout(yay, 1000));
    return true;
}

export default function LoginPage(): ReactElement {
    const {result: twitterLoggedIn, loading: twitterLoading, execute: handleTwitterLogin} =
        useAsyncCallback(doTwitterLogin);
    const {result: twitchLoggedIn, loading: twitchLoading, execute: handleTwitchLogin} =
        useAsyncCallback(doTwitchLogin);

    return (
        <VStack spacing={4}>
            <Heading size="md">Log in</Heading>
            <Text>
                For personalised results, log in to your Twitter and Twitch
                accounts.
            </Text>
            <Button
                isFullWidth={true}
                colorScheme="twitter"
                isDisabled={twitterLoggedIn}
                isLoading={twitterLoading}
                rightIcon={<TwitterLogo />}
                onClick={handleTwitterLogin}
            >
                Log in to Twitter
            </Button>
            <Button
                colorScheme="twitch"
                isFullWidth={true}
                isDisabled={twitchLoggedIn}
                isLoading={twitchLoading}
                rightIcon={<TwitchLogo />}
                onClick={handleTwitchLogin}
            >
                Log in to Twitch
            </Button>

            <Text>
                Or <Link as={RouterLink} to="/home">skip logging in</Link>
            </Text>
        </VStack>
    );
}
