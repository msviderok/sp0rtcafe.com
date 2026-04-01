import { Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { ClerkProvider } from "clerk-solidjs/start";
import { Suspense } from "solid-js";
import "./app.css";
import LoadingScreen from "./components/LoadingScreen";
import { ConvexClerkProvider } from "./integrations/convex-clerk";
import { client } from "./integrations/convex";

export default function App() {
  return (
    <Router
      root={(props) => (
        <ClerkProvider
          publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}
          afterSignInUrl="/"
          afterSignUpUrl="/"
        >
          <Suspense fallback={<LoadingScreen />}>
            <ConvexClerkProvider client={client}>{props.children}</ConvexClerkProvider>
          </Suspense>
        </ClerkProvider>
      )}
    >
      <FileRoutes />
    </Router>
  );
}
