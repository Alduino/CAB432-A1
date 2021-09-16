import {requireOkResponse} from "@cab432-a1/common";
import {Center, Link, Spinner, Text} from "@chakra-ui/react";
import {ReactElement} from "react";
import {useAsync} from "react-async-hook";
import {Link as RouterLink, Redirect} from "react-router-dom";

async function logout() {
    await fetch("/api/auth/twitter/logout", {method: "POST"}).then(
        requireOkResponse
    );
}

export default function LogoutPage(): ReactElement {
    const {loading, error} = useAsync(logout, []);

    if (error) {
        return (
            <Text>
                Something went wrong trying to log you out.{" "}
                <Link as={RouterLink} to="/home">
                    Go home
                </Link>
                .
            </Text>
        );
    } else if (loading) {
        return (
            <Center h="full">
                <Spinner />
            </Center>
        );
    } else {
        return <Redirect to="/" />;
    }
}
