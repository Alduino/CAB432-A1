import {Center, Spinner} from "@chakra-ui/react";
import {ReactElement} from "react";

export default function LoadingPage(): ReactElement {
    return (
        <Center h="full">
            <Spinner />
        </Center>
    );
}
