import {Spinner, Text, VStack} from "@chakra-ui/react";
import {ReactElement, useEffect, useState} from "react";

export interface MessageSpinnerProps {
    messages: string[];
    changeInterval: number;
}

export function MessageSpinner({messages, changeInterval}: MessageSpinnerProps): ReactElement {
    const [message, setMessage] = useState(messages[0]);

    useEffect(() => {
        let index = 0;
        const interval = setInterval(() => {
            index = (index + 1) % messages.length;
            setMessage(messages[index]);
        }, changeInterval);

        return () => clearInterval(interval);
    }, [messages, changeInterval]);

    return (
        <VStack spacing={6}>
            <Spinner />
            <Text fontSize="sm" color="blackAlpha.500">{message}</Text>
        </VStack>
    )
}
