import {Text, TextProps} from "@chakra-ui/react";
import {ReactElement} from "react";

export function Badge(props: TextProps): ReactElement {
    return (
        <Text
            px={1}
            py={0.5}
            lineHeight={1}
            bg="red.500"
            color="white"
            borderRadius="sm"
            fontSize="sm"
            fontWeight="bold"
            {...props}
        />
    );
}
