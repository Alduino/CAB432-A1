import {Image} from "@chakra-ui/react";
import {ReactElement} from "react";
import icon from "../assets/twitter-verified-badge.svg";

export function VerifiedBadge(): ReactElement {
    return <Image src={icon} width="1em" height="1em" />;
}
