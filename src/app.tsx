import { Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { ConvexProvider } from "convex-solidjs";
import { Suspense } from "solid-js";
import Nav from "~/components/Nav";
import "./app.css";
import { client } from "./integrations/convex";

export default function App() {
  return (
    <Router
      root={(props) => (
        <>
          <Nav />
          <Suspense>
            <ConvexProvider client={client}>{props.children}</ConvexProvider>
          </Suspense>
        </>
      )}
    >
      <FileRoutes />
    </Router>
  );
}
