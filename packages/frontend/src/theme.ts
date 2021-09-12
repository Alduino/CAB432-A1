import "@fontsource/farro/latin.css";
import "@fontsource/asap/variable.css";
import "@fontsource/asap/variable-italic.css";
import {extendTheme} from "@chakra-ui/react";

const fonts = {
    heading: "Farro, sans-serif",
    body: "AsapVariable, sans-serif"
};

export const theme = extendTheme({
    fonts
});
