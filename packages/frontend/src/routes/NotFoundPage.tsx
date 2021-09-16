import {Heading, Link, Text, VStack} from "@chakra-ui/react";
import {ReactElement} from "react";
import {Link as RouterLink} from "react-router-dom";

export default function NotFoundPage(): ReactElement {
    return (
        <VStack spacing={4} p={4}>
            <Heading size="md">Oops!</Heading>
            <Text>
                We couldn&apos;t find that page. Maybe go{" "}
                <Link as={RouterLink} to="/home">
                    back home
                </Link>
                ?
            </Text>
        </VStack>
    );
}
