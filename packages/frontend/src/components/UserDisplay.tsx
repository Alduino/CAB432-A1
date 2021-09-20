import {TopAccount} from "@cab432-a1/common";
import {Box, HStack, Icon, Image, LinkBox, LinkOverlay} from "@chakra-ui/react";
import {CaretRight} from "phosphor-react";
import {ReactElement} from "react";
import {Link} from "react-router-dom";
import {AccountName} from "./AccountName";
import {LiveIcon} from "./LiveIcon";
import {VodIcon} from "./VodIcon";

interface UserDisplayProps {
    account: TopAccount;
}

export function UserDisplay({account}: UserDisplayProps): ReactElement {
    const link = `/account/${account.id}`;

    return (
        <LinkBox
            as={HStack}
            spacing={3}
            p={4}
            bg="gray.200"
            w="full"
            borderRadius="md"
            transition="50ms"
            _hover={{bg: "gray.300"}}
        >
            <Image src={account.profilePictureUrl} h={6} borderRadius="full" />
            <AccountName
                displayName={account.displayName}
                verified={account.twitterVerified}
            />
            {account.twitchStreamId && <LiveIcon />}
            {account.youtube && <VodIcon />}
            <Box flexGrow={1} />
            <LinkOverlay as={Link} to={link}>
                <Icon as={CaretRight} />
            </LinkOverlay>
        </LinkBox>
    );
}
