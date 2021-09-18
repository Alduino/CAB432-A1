import {TopAccount, TopAccountsResponse} from "@cab432-a1/common";
import {
    Box,
    Center,
    HStack,
    Icon,
    Image,
    LinkBox,
    LinkOverlay,
    Spinner,
    Stack,
    Text,
    VStack
} from "@chakra-ui/react";
import {CaretRight} from "phosphor-react";
import {ReactElement, ReactNode} from "react";
import {Link} from "react-router-dom";
import useSWR from "swr";
import {AccountName} from "../components/AccountName";
import {LiveIcon} from "../components/LiveIcon";
import {MessageSpinner} from "../components/MessageSpinner";
import {VodIcon} from "../components/VodIcon";
import fetchJson from "../utils/fetchJson";

interface UserDisplayProps {
    account: TopAccount;
}

function UserDisplay({account}: UserDisplayProps): ReactElement {
    const link = `/account/${account.id}`;

    return (
        <LinkBox
            as={HStack}
            spacing={3}
            p={4}
            bg="gray.200"
            w="full"
            borderRadius="md"
            transition="50ms"
            _hover={{bg: "gray.300"}}
        >
            <Image src={account.profilePictureUrl} h={6} borderRadius="full" />
            <AccountName
                displayName={account.displayName}
                verified={account.twitterVerified}
            />
            {account.twitchStreamId && <LiveIcon />}
            {account.youtube && <VodIcon />}
            <Box flexGrow={1} />
            <LinkOverlay as={Link} to={link}>
                <Icon as={CaretRight} />
            </LinkOverlay>
        </LinkBox>
    );
}

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

export interface LoadingNewDataWrapperProps {
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

export default function HomePage(): ReactElement {
    const {data, error, isValidating} = useSWR<TopAccountsResponse>(
        "/api/top-accounts",
        fetchJson
    );

    if (error) {
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
