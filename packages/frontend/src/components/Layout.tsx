import {AuthCheckResponse} from "@cab432-a1/common";
import {
    Box,
    Center,
    FlexProps,
    Image,
    Link,
    Text, useColorModeValue,
    VStack
} from "@chakra-ui/react";
import {ReactElement} from "react";
import {Link as RouterLink} from "react-router-dom";
import useSWR from "swr";
import logoBlack from "../assets/logo-wide-black.svg";
import logoWhite from "../assets/logo-wide-white.svg";
import fetchJson from "../utils/fetchJson";

export function Layout(props: FlexProps): ReactElement {
    const logo = useColorModeValue(logoBlack, logoWhite);
    const bg = useColorModeValue("gray.100", "gray.900");
    const loginScheme = useColorModeValue("blackAlpha", "whiteAlpha");

    const {data} = useSWR<AuthCheckResponse>(
        "/api/auth/twitter/check",
        fetchJson
    );

    return (
        <Center bg={bg} w="full" h="100vh">
            <VStack spacing={4}>
                <Image src={logo} />
                <Box
                    w="md"
                    h="xl"
                    bg="gray.50"
                    borderRadius="lg"
                    overflow="hidden"
                    boxShadow="md"
                    color="gray.900"
                    {...props}
                />
                <Text>
                    {data?.isLoggedIn ? (
                        <Link as={RouterLink} to="/logout" colorScheme={loginScheme}>
                            Log out of @{data.identifier}
                        </Link>
                    ) : (
                        <Link as={RouterLink} to="/" colorScheme={loginScheme}>
                            Log in
                        </Link>
                    )}
                </Text>
            </VStack>
        </Center>
    );
}
