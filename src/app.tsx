import { Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { ConvexProvider } from "convex-solidjs";
import { Suspense } from "solid-js";
import "./app.css";
import LoadingScreen from "./components/LoadingScreen";
import { client } from "./integrations/convex";

export default function App() {
  return (
    <Router
      root={(props) => (
        <>
          <Suspense fallback={<LoadingScreen />}>
            <ConvexProvider client={client}>{props.children}</ConvexProvider>
          </Suspense>
        </>
      )}
    >
      <FileRoutes />
    </Router>
  );
}
