import { Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { ClerkProvider } from "clerk-solidjs/start";
import "./app.css";
import { client } from "./integrations/convex";
import { ConvexClerkProvider } from "./integrations/convex-clerk";

export default function App() {
  return (
    <Router
      root={(props) => (
        <ClerkProvider publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}>
          <ConvexClerkProvider client={client}>{props.children}</ConvexClerkProvider>
        </ClerkProvider>
      )}
    >
      <FileRoutes />
    </Router>
  );
}
