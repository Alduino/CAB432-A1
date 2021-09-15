import {AuthCheckResponse} from "@cab432-a1/common";
import {
    Box,
    Center,
    FlexProps,
    Image,
    Link,
    Text,
    VStack
} from "@chakra-ui/react";
import {ReactElement} from "react";
import {Link as RouterLink} from "react-router-dom";
import useSWR from "swr";
import logo from "../assets/logo-wide-white.svg";
import fetchJson from "../utils/fetchJson";

export function Layout(props: FlexProps): ReactElement {
    const {data} = useSWR<AuthCheckResponse>(
        "/api/auth/twitter/check",
        fetchJson
    );

    return (
        <Center bg="gray.900" w="full" h="100vh">
            <VStack spacing={4}>
                <Image src={logo} />
                <Box
                    w="md"
                    h="xl"
                    bg="gray.50"
                    p={4}
                    borderRadius="lg"
                    {...props}
                />
                <Text>
                    {data?.isLoggedIn ? (
                        <Link as={RouterLink} to="/logout" colorScheme="whiteAlpha">
                            Log out of @{data.identifier}
                        </Link>
                    ) : (
                        <Link as={RouterLink} to="/" colorScheme="whiteAlpha">
                            Log in
                        </Link>
                    )}
                </Text>
            </VStack>
        </Center>
    );
}
