import { useAuth } from "clerk-solidjs";
import { useMutation } from "convex-solidjs";
import {
  createContext,
  createEffect,
  createSignal,
  useContext,
  type Accessor,
  type ParentProps,
} from "solid-js";
import { api } from "../../convex/_generated/api";
import { useConvexClerkAuth } from "./convex-clerk";

type CurrentUserBootstrapState = {
  error: Accessor<string | null>;
  isReady: Accessor<boolean>;
};

const CurrentUserBootstrapContext = createContext<CurrentUserBootstrapState>();

export function useCurrentUserBootstrap() {
  const context = useContext(CurrentUserBootstrapContext);

  if (!context) {
    throw new Error("useCurrentUserBootstrap must be used within CurrentUserBootstrapProvider");
  }

  return context;
}

export function CurrentUserBootstrapProvider(props: ParentProps) {
  const auth = useAuth();
  const convexAuth = useConvexClerkAuth();
  const ensureCurrentProfile = useMutation(api.userProfiles.ensureCurrent);
  const [isReady, setIsReady] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  let lastBootstrappedUserId: string | null = null;
  let activeBootstrapKey = 0;

  createEffect(() => {
    const isLoaded = auth.isLoaded();
    const isSignedIn = auth.isSignedIn();
    const userId = auth.userId() ?? null;
    const isConvexLoading = convexAuth.isLoading();
    const isConvexAuthenticated = convexAuth.isAuthenticated();

    if (!isLoaded || isConvexLoading) {
      setIsReady(false);
      return;
    }

    if (!isSignedIn || !userId) {
      lastBootstrappedUserId = null;
      activeBootstrapKey += 1;
      setError(null);
      setIsReady(true);
      return;
    }

    if (!isConvexAuthenticated) {
      lastBootstrappedUserId = null;
      setError(null);
      setIsReady(false);
      return;
    }

    if (lastBootstrappedUserId === userId) {
      setIsReady(true);
      return;
    }

    const bootstrapKey = ++activeBootstrapKey;
    lastBootstrappedUserId = userId;
    setError(null);
    setIsReady(false);

    void ensureCurrentProfile
      .mutate({})
      .then(() => {
        if (bootstrapKey !== activeBootstrapKey) {
          return;
        }

        setIsReady(true);
      })
      .catch((mutationError) => {
        if (bootstrapKey !== activeBootstrapKey) {
          return;
        }

        setError(
          mutationError instanceof Error ? mutationError.message : "Failed to prepare profile",
        );
        setIsReady(true);
      });
  });

  return (
    <CurrentUserBootstrapContext.Provider value={{ error, isReady }}>
      {props.children}
    </CurrentUserBootstrapContext.Provider>
  );
}
