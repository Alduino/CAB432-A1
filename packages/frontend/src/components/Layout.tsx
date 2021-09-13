import {Box, FlexProps, Center, VStack, Image} from "@chakra-ui/react";
import {ReactElement} from "react";
import logo from "../assets/logo-wide-white.svg";

export function Layout(props: FlexProps): ReactElement {
    return (
        <Center bg="gray.900" w="full" h="100vh">
            <VStack spacing={4}>
                <Image src={logo} />
                <Box w="md" h="xl" bg="gray.50" p={4} borderRadius="lg" {...props} />
            </VStack>
        </Center>
    )
}
