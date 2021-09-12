import {ChakraProvider, Text, theme} from "@chakra-ui/react";
import {ReactElement} from "react";

export function App(): ReactElement {
    return (
        <ChakraProvider theme={theme}>
            <Text>Hello, world!</Text>
        </ChakraProvider>
    );
}
