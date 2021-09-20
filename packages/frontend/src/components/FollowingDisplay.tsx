import {TopAccountsResponse} from "@cab432-a1/common";
import {
    Box,
    Center,
    HStack,
    Spinner,
    Stack,
    Text,
    VStack
} from "@chakra-ui/react";
import {ReactElement, ReactNode} from "react";
import useSWR from "swr";
import fetchJson from "../utils/fetchJson";
import {MessageSpinner} from "./MessageSpinner";
import {UserDisplay} from "./UserDisplay";

const spinnerMessages = [
    "Finding the followers",
    "Querying Twitter's API",
    "Resolving the links",
    "Checking the stream status",
    "Querying Twitch's API",
    "Crunching the data",
    "Baking a cake",
    "Querying YouTube's API",
    "Waiting for friends to arrive",
    "Chatting with friends",
    "Eating the cake",
    "Playing games with friends",
    "Forgetting masks are required",
    "Noticing that there are new cases",
    "Getting called by contact tracing",
    "Finding out the cases came from your party",
    "Regretting inviting a hundred people",
    "Making Brisbane lock down"
];

interface LoadingNewDataWrapperProps {
    children: ReactNode;
    isLoading: boolean;
}

function LoadingNewDataWrapper({
    isLoading,
    children
}: LoadingNewDataWrapperProps): ReactElement {
    return (
        <Stack alignItems="stretch" h="full" spacing={0}>
            <Box flexGrow={1} overflowY="auto">
                {children}
            </Box>
            {isLoading && (
                <HStack
                    p={4}
                    borderTop="1px solid"
                    borderColor="gray.300"
                    fontSize="sm"
                >
                    <Spinner size="sm" />
                    <Text>We&lsquo;re loading new data</Text>
                </HStack>
            )}
        </Stack>
    );
}

export interface FollowingDisplayProps {
    userId?: string;
    isErrored?: boolean;
}

export function FollowingDisplay({
    userId,
    isErrored
}: FollowingDisplayProps): ReactElement {
    const {data, error, isValidating} = useSWR<TopAccountsResponse>(
        userId ? `/api/top-accounts?id=${userId}` : null,
        fetchJson
    );

    if (isErrored || error) {
        return (
            <LoadingNewDataWrapper isLoading={isValidating}>
                <Text p={4}>
                    Something went wrong. Try refreshing the page.
                </Text>
            </LoadingNewDataWrapper>
        );
    } else if (!data) {
        return (
            <Center h="full">
                <MessageSpinner
                    messages={spinnerMessages}
                    changeInterval={2000}
                />
            </Center>
        );
    } else if (data.data.length === 0) {
        return (
            <Text>
                We couldn&lsquo;t find any users with a Twitch account being
                followed by this user.
            </Text>
        );
    }

    return (
        <LoadingNewDataWrapper isLoading={isValidating}>
            <VStack spacing={4} p={4}>
                {data &&
                    data.data.map(item => (
                        <UserDisplay key={item.id} account={item} />
                    ))}
                <Text size="sm" color="blackAlpha.500">
                    {data.data.length > 0
                        ? "That's all"
                        : "We couldn't find any Twitch accounts for the people you follow"}
                </Text>
            </VStack>
        </LoadingNewDataWrapper>
    );
}
