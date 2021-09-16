import {ChakraProvider} from "@chakra-ui/react";
import {lazy, ReactElement, Suspense} from "react";
import {BrowserRouter, Route, Switch} from "react-router-dom";
import {Layout} from "./components/Layout";
import LoadingPage from "./routes/LoadingPage";
import {theme} from "./theme";

const LoginPage = lazy(() => import("./routes/LoginPage"));
const LogoutPage = lazy(() => import("./routes/LogoutPage"));
const HomePage = lazy(() => import("./routes/HomePage"));
const AccountPage = lazy(() => import("./routes/AccountPage"));
const NotFoundPage = lazy(() => import("./routes/NotFoundPage"));

export function App(): ReactElement {
    return (
        <ChakraProvider theme={theme} resetCSS>
            <BrowserRouter>
                <Layout>
                    <Suspense fallback={<LoadingPage />}>
                        <Switch>
                            <Route path="/logout" component={LogoutPage} />
                            <Route path="/home" component={HomePage} />
                            <Route path="/account/:id" component={AccountPage} />
                            <Route exact path="/" component={LoginPage} />
                            <Route component={NotFoundPage} />
                        </Switch>
                    </Suspense>
                </Layout>
            </BrowserRouter>
        </ChakraProvider>
    );
}
