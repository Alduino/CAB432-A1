import {TopAccount, TopAccountsResponse} from "@cab432-a1/common";
import {
    Box,
    Center,
    HStack,
    Icon,
    Image,
    LinkBox,
    LinkOverlay,
    Text,
    VStack
} from "@chakra-ui/react";
import {CaretRight} from "phosphor-react";
import {ReactElement} from "react";
import {Link} from "react-router-dom";
import useSWR from "swr";
import {MessageSpinner} from "../components/MessageSpinner";
import fetchJson from "../utils/fetchJson";

function LiveIcon(): ReactElement {
    return (
        <Text
            px={1}
            py={0.5}
            lineHeight={1}
            bg="red.500"
            color="white"
            borderRadius="sm"
            fontSize="sm"
            fontWeight="bold"
        >
            LIVE
        </Text>
    );
}

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
            <Text>{account.displayName}</Text>
            {account.isLiveOnTwitch && <LiveIcon />}
            <Box flexGrow={1} />
            <LinkOverlay as={Link} to={link}>
                <Icon as={CaretRight} />
            </LinkOverlay>
        </LinkBox>
    );
}

const spinnerMessages = [
    "Finding the followers",
    "Resolving the links",
    "Checking the stream status",
    "Crunching the data",
    "Baking a cake",
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

export default function HomePage(): ReactElement {
    const {data, error} = useSWR<TopAccountsResponse>(
        "/api/top-accounts",
        fetchJson
    );

    if (error) {
        return <Text>Something went wrong. Try refreshing the page.</Text>;
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
        <VStack spacing={4}>
            {data &&
                data.data.map(item => (
                    <UserDisplay key={item.id} account={item} />
                ))}
            <Text size="sm" color="blackAlpha.500">
                That&lsquo;s all
            </Text>
        </VStack>
    );
}
