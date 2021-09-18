import {isResponseError, TopAccount} from "@cab432-a1/common";
import {
    AspectRatio,
    Box,
    Center,
    chakra,
    Heading,
    HStack,
    Icon,
    Image,
    Link,
    Spinner,
    Stack,
    Tab,
    TabList,
    TabPanel,
    TabPanels,
    Tabs,
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

function StreamTweets({account}: ViewProps): ReactElement {
    return <p>todo</p>;
}

interface LastVodProps {
    youtube: Required<TopAccount>["youtube"];
}

function LastVod({youtube}: LastVodProps): ReactElement {
    return (
        <AspectRatio ratio={16 / 9} borderRadius="md" overflow="hidden">
            <IFrame
                allowFullScreen={true}
                src={`https://www.youtube.com/embed/${youtube.id}`}
            />
        </AspectRatio>
    );
}

function LiveView({account}: ViewProps): ReactElement {
    const src = `https://player.twitch.tv/?channel=${account.twitchLogin}&parent=${location.hostname}&muted=true`;

    return (
        <Stack px={4}>
            <AspectRatio ratio={16 / 9} borderRadius="md" overflow="hidden">
                <IFrame allowFullScreen src={src} />
            </AspectRatio>
            {account.youtube ? (
                <Tabs>
                    <TabList>
                        <Tab>Stream Tweets</Tab>
                        <Tab>Last VOD</Tab>
                    </TabList>
                    <TabPanels>
                        <TabPanel>
                            <StreamTweets account={account} />
                        </TabPanel>
                        <TabPanel>
                            <LastVod youtube={account.youtube} />
                        </TabPanel>
                    </TabPanels>
                </Tabs>
            ) : (
                <StreamTweets account={account} />
            )}
        </Stack>
    );
}

function OfflineView({account}: ViewProps): ReactElement {
    // we need to split the image div into two, as Chakra's `Stack` disables any
    // margin we set on direct children
    return (
        <Box px={4}>
            {account.youtube ? (
                <Stack>
                    <Text>
                        {account.displayName} isn&lsquo;t live right now, but
                        you can watch their latest VOD on YouTube:
                    </Text>
                </Stack>
            ) : (
                <Box
                    w="full"
                    h="3xs"
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
                            Sorry, {account.displayName} isn&lsquo;t live right
                            now.
                        </Text>
                    </Box>
                </Box>
            )}
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
        return (
            <Text p={4}>
                {isResponseError(error) && error.response.status === 404
                    ? "That user doesn't exist, or we couldn't find their Twitch account"
                    : "Something went wrong. Try refreshing the page."}
            </Text>
        );
    } else if (!data) {
        return (
            <Center h="full">
                <Spinner />
            </Center>
        );
    }

    return (
        <Stack spacing={4} overflowY="auto" height="full">
            <HStack
                spacing={4}
                p={4}
                borderBottom="1px solid"
                borderColor="gray.200"
            >
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
