import {TopAccount} from "@cab432-a1/common";
import {
    AspectRatio,
    Box,
    Center, chakra,
    Heading,
    HStack,
    Icon,
    Image,
    Link,
    Spinner,
    Stack,
    Text
} from "@chakra-ui/react";
import {TwitchLogo, TwitterLogo} from "phosphor-react";
import {ReactElement} from "react";
import {useParams} from "react-router-dom";
import useSWR from "swr";
import {AccountName} from "../components/AccountName";
import {LiveIcon} from "../components/LiveIcon";
import fetchJson from "../utils/fetchJson";

interface ViewProps {
    account: TopAccount;
}

const IFrame = chakra("iframe");

function LiveView({account}: ViewProps): ReactElement | null {
    const src = `https://player.twitch.tv/?channel=${account.twitchLogin}&parent=${location.hostname}&muted=true`;

    return (
        <Box px={4}>
            <AspectRatio ratio={16 / 9} borderRadius="md" overflow="hidden">
                <IFrame allowFullScreen src={src} />
            </AspectRatio>
        </Box>
    );
}

function OfflineView({account}: ViewProps): ReactElement {
    return (
        <Box
            w="full"
            h="3xs"
            p={4}
            backgroundImage={account.notLiveCoverUrl}
            backgroundSize="cover"
            backgroundPosition="center center"
            position="relative"
            borderRadius="md"
            overflow="hidden"
        >
            <Box
                position="absolute"
                left={0}
                right={0}
                bottom={0}
                height="auto"
                bg="blackAlpha.800"
                p={2}
            >
                <Text color="white" align="center">
                    Sorry, {account.displayName} isn&lsquo;t live right now.
                </Text>
            </Box>
        </Box>
    );
}

export default function AccountPage(): ReactElement {
    const {id} = useParams<{id: string}>();
    const {data, error} = useSWR<TopAccount>(
        `/api/top-accounts/${id}`,
        fetchJson
    );

    if (error) {
        return <Text>Something went wrong. Try refreshing the page.</Text>;
    } else if (!data) {
        return (
            <Center h="full">
                <Spinner />
            </Center>
        );
    }

    return (
        <Stack spacing={4}>
            <HStack spacing={4} p={4} borderBottom="1px solid" borderColor="gray.200">
                <Image src={data.profilePictureUrl} h={12} borderRadius="md" />
                <Stack spacing={0}>
                    <HStack>
                        <AccountName
                            as={Heading}
                            size="md"
                            displayName={data.displayName}
                            verified={data.twitterVerified}
                        />
                        {data.twitchStreamId && <LiveIcon />}
                    </HStack>
                    <HStack fontSize="sm" spacing={2}>
                        <HStack spacing={1}>
                            <Icon as={TwitterLogo} color="twitter.500" />
                            <Text>
                                <Link
                                    href={`https://twitter.com/${data.twitterLogin}`}
                                    target="_blank"
                                    colorScheme="black"
                                >
                                    @{data.twitterLogin}
                                </Link>
                            </Text>
                        </HStack>
                        <Text color="blackAlpha.500">·</Text>
                        <HStack spacing={1}>
                            <Icon as={TwitchLogo} color="twitch.500" />
                            <Link
                                href={`https://twitch.tv/${data.twitchLogin}`}
                                target="_blank"
                                colorScheme="black"
                            >
                                twitch.tv/{data.twitchLogin}
                            </Link>
                        </HStack>
                    </HStack>
                </Stack>
            </HStack>
            {data.twitchStreamId ? (
                <LiveView account={data} />
            ) : (
                <OfflineView account={data} />
            )}
        </Stack>
    );
}
