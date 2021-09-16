import {HStack, Text} from "@chakra-ui/react";
import {ComponentType, ReactElement} from "react";
import {VerifiedBadge} from "./VerifiedBadge";

export interface AccountNameProps<T> {
    displayName: string;
    verified: boolean;
    as?: ComponentType<T>;
}

export function AccountName<T>({
    displayName,
    verified,
    as = Text,
    ...props
}: AccountNameProps<T> & T): ReactElement {
    const TextComponent = as;

    return (
        <HStack spacing={1}>
            <TextComponent {...(props as unknown as T)}>
                {displayName}
            </TextComponent>
            {verified && <VerifiedBadge />}
        </HStack>
    );
}
