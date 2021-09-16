import {TopAccount} from "@cab432-a1/common";
import {
    Center,
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
        <Stack>
            <HStack spacing={4}>
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
        </Stack>
    );
}
