import {ChakraProvider, Text} from "@chakra-ui/react";
import {ReactElement} from "react";
import {theme} from "./theme";

export function App(): ReactElement {
    return (
        <ChakraProvider theme={theme}>
            <Text>Hello, world!</Text>
        </ChakraProvider>
    );
}
