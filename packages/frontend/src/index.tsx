import {ColorModeScript} from "@chakra-ui/react";
import {StrictMode} from "react";
import ReactDOM from "react-dom";
import {App} from "./App";

ReactDOM.render(
    <StrictMode>
        <ColorModeScript initialColorMode="system" />
        <App />
    </StrictMode>,
    document.getElementById("root")
);
