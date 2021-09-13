import {ChakraProvider} from "@chakra-ui/react";
import {lazy, ReactElement, Suspense} from "react";
import {BrowserRouter, Route, Switch} from "react-router-dom";
import {Layout} from "./components/Layout";
import LoadingPage from "./routes/LoadingPage";
import {theme} from "./theme";

const LoginPage = lazy(() => import("./routes/LoginPage"));
const NotFoundPage = lazy(() => import("./routes/NotFoundPage"));

export function App(): ReactElement {
    return (
        <ChakraProvider theme={theme} resetCSS>
            <Layout>
                <Suspense fallback={<LoadingPage />}>
                    <BrowserRouter>
                        <Switch>
                            <Route exact path="/" component={LoginPage} />
                            <Route component={NotFoundPage} />
                        </Switch>
                    </BrowserRouter>
                </Suspense>
            </Layout>
        </ChakraProvider>
    );
}
