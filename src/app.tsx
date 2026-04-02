import { Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { ClerkProvider } from "clerk-solidjs/start";
import { Suspense } from "solid-js";
import "./app.css";
import LoadingScreen from "./components/LoadingScreen";
import { client } from "./integrations/convex";
import { ConvexClerkProvider } from "./integrations/convex-clerk";
import { CurrentUserBootstrapProvider } from "./integrations/current-user-bootstrap";

export default function App() {
  return (
    <Router
      root={(props) => (
        <ClerkProvider publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}>
          <ConvexClerkProvider client={client}>
            <CurrentUserBootstrapProvider>
              <Suspense fallback={<LoadingScreen />}>{props.children}</Suspense>
            </CurrentUserBootstrapProvider>
          </ConvexClerkProvider>
        </ClerkProvider>
      )}
    >
      <FileRoutes />
    </Router>
  );
}
