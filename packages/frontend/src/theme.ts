import "@fontsource/farro/latin.css";
import "@fontsource/asap/variable.css";
import "@fontsource/asap/variable-italic.css";
import {extendTheme, withDefaultColorScheme} from "@chakra-ui/react";

export const theme = extendTheme(
    withDefaultColorScheme({
        colorScheme: "blue",
        components: ["Link"]
    }),
    {
        config: {
            useSystemColorMode: true
        },
        fonts: {
            heading: "Farro, sans-serif",
            body: "AsapVariable, sans-serif"
        },
        colors: {
            twitch: {
                50: "#ece8f4",
                100: "#d1c6e4",
                200: "#b2a0d2",
                300: "#937ac0",
                400: "#7b5eb3",
                500: "#6441a5",
                600: "#5c3b9d",
                700: "#523293",
                800: "#482a8a",
                900: "#361c79"
            }
        },
        components: {
            Link: {
                baseStyle: ({colorScheme}: {colorScheme: string}) => ({
                    textDecoration: "none",
                    color: `${colorScheme}.500`,
                    "&:hover": {
                        color: `${colorScheme}.600`
                    },
                    "&:active": {
                        color: `${colorScheme}.700`
                    }
                })
            }
        }
    }
);
