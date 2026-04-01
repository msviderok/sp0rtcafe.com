import { useAuth } from "clerk-solidjs";
import { ConvexProvider } from "convex-solidjs";
import type { ConvexClient } from "convex/browser";
import {
  createContext,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  useContext,
  type Accessor,
  type ParentProps,
} from "solid-js";
import { isServer } from "solid-js/web";

type ConvexClerkAuthState = {
  isAuthenticated: Accessor<boolean>;
  isLoading: Accessor<boolean>;
};

const ConvexClerkAuthContext = createContext<ConvexClerkAuthState>();

type ConvexClientWithNestedAuth = ConvexClient & {
  client: {
    clearAuth: () => void;
    setAuth: ConvexClient["setAuth"];
  };
};

export function useConvexClerkAuth() {
  const context = useContext(ConvexClerkAuthContext);

  if (!context) {
    throw new Error("useConvexClerkAuth must be used within ConvexClerkProvider");
  }

  return context;
}

export function ConvexClerkProvider(props: ParentProps<{ client: ConvexClient }>) {
  const auth = useAuth();
  const [isConvexAuthenticated, setIsConvexAuthenticated] = createSignal<boolean | null>(null);
  const [hasResolvedInitialAuth, setHasResolvedInitialAuth] = createSignal(false);
  const isLoading = createMemo(() => !hasResolvedInitialAuth());
  const isAuthenticated = createMemo(
    () => Boolean(auth.isSignedIn()) && Boolean(isConvexAuthenticated()),
  );
  const authBindingKey = createMemo(() => {
    if (!auth.isLoaded()) {
      return null;
    }

    if (!auth.isSignedIn()) {
      return "signed-out";
    }

    return JSON.stringify({
      orgId: auth.orgId() ?? null,
      orgRole: auth.orgRole() ?? null,
    });
  });

  const fetchAccessToken = async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
    try {
      return (
        (await auth.getToken({ template: "convex", skipCache: forceRefreshToken })) ??
        (await auth.getToken({ skipCache: forceRefreshToken }))
      );
    } catch {
      try {
        return await auth.getToken({ skipCache: forceRefreshToken });
      } catch {
        return null;
      }
    }
  };

  let releaseAuthBinding: (() => void) | undefined;
  let currentBindingKey: string | null = null;

  createEffect(() => {
    if (isServer) {
      return;
    }

    const authClient = (props.client as ConvexClientWithNestedAuth).client;
    const bindingKey = authBindingKey();
    const isLoaded = auth.isLoaded();
    const isSignedIn = auth.isSignedIn() ?? false;

    if (!isLoaded) {
      return;
    }

    if (!isSignedIn || bindingKey === "signed-out") {
      releaseAuthBinding?.();
      releaseAuthBinding = undefined;
      currentBindingKey = "signed-out";
      authClient.clearAuth();
      setIsConvexAuthenticated(false);
      setHasResolvedInitialAuth(true);
      return;
    }

    if (bindingKey === currentBindingKey) {
      return;
    }

    releaseAuthBinding?.();
    currentBindingKey = bindingKey;

    let isCurrentBinding = true;

    authClient.setAuth(fetchAccessToken, (backendReportsIsAuthenticated) => {
      if (isCurrentBinding) {
        setIsConvexAuthenticated(backendReportsIsAuthenticated);
        setHasResolvedInitialAuth(true);
      }
    });

    releaseAuthBinding = () => {
      isCurrentBinding = false;
      authClient.clearAuth();
    };
  });

  onCleanup(() => {
    releaseAuthBinding?.();
  });

  return (
    <ConvexClerkAuthContext.Provider value={{ isAuthenticated, isLoading }}>
      <ConvexProvider client={props.client}>{props.children}</ConvexProvider>
    </ConvexClerkAuthContext.Provider>
  );
}
