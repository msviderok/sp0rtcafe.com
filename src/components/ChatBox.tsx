import { SignInButton } from "clerk-solidjs";
import { useMutation, useQuery } from "convex-solidjs";
import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";
import { useConvexClerkAuth } from "../integrations/convex-clerk";
import { useCurrentUserBootstrap } from "../integrations/current-user-bootstrap";

const relativeTimeFormatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const DEFAULT_MESSAGE_DOT_COLOR = "rgba(255, 255, 255, 0.35)";

function formatRelativeTime(timestamp: number) {
  const elapsedSeconds = Math.round((timestamp - Date.now()) / 1_000);

  if (Math.abs(elapsedSeconds) < 60) {
    return relativeTimeFormatter.format(elapsedSeconds, "second");
  }

  const elapsedMinutes = Math.round(elapsedSeconds / 60);
  if (Math.abs(elapsedMinutes) < 60) {
    return relativeTimeFormatter.format(elapsedMinutes, "minute");
  }

  const elapsedHours = Math.round(elapsedMinutes / 60);
  if (Math.abs(elapsedHours) < 24) {
    return relativeTimeFormatter.format(elapsedHours, "hour");
  }

  const elapsedDays = Math.round(elapsedHours / 24);
  return relativeTimeFormatter.format(elapsedDays, "day");
}

export default function ChatBox(props: { onClose: () => void }) {
  const convexAuth = useConvexClerkAuth();
  const currentUserBootstrap = useCurrentUserBootstrap();
  const messagesQuery = useQuery(api.chat.list, {});
  const sendMessage = useMutation(api.chat.send);
  const [body, setBody] = createSignal("");
  const [isSending, setIsSending] = createSignal(false);
  const [errorMessage, setErrorMessage] = createSignal<string | null>(null);
  const messages = createMemo(() => ((messagesQuery.data() ?? []) as Doc<"chatMessages">[]));
  const canSend = createMemo(() => body().trim().length > 0 && !isSending());
  let messagesRef: HTMLDivElement | undefined;

  createEffect(() => {
    messages().length;

    queueMicrotask(() => {
      if (!messagesRef) {
        return;
      }

      messagesRef.scrollTop = messagesRef.scrollHeight;
    });
  });

  const handleSubmit = async (event: SubmitEvent) => {
    event.preventDefault();

    const nextBody = body().trim();
    if (!nextBody || isSending()) {
      return;
    }

    setIsSending(true);
    setErrorMessage(null);

    try {
      await sendMessage.mutate({ body: nextBody });
      setBody("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to send message");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <aside class="flex h-full w-[22rem] min-w-[22rem] shrink-0 flex-col border-l border-white/10 bg-[#0e0a09]">
        <header class="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div class="text-xs uppercase tracking-[0.22em] text-white/45">Chat</div>
          <button
            class="text-xs uppercase tracking-[0.22em] text-white/55 transition hover:text-white"
            onClick={() => props.onClose()}
            type="button"
          >
            Close
          </button>
        </header>

          <div class="flex min-h-0 flex-1 flex-col px-4 py-3">
            <div class="text-xs uppercase tracking-[0.22em] text-white/45">Global channel</div>
            <div class="mt-3 min-h-0 flex-1 overflow-y-auto pr-1" ref={messagesRef}>
              <Show
                when={!messagesQuery.isLoading()}
                fallback={
                  <div class="pt-2 text-sm text-white/40">Loading messages...</div>
                }
              >
                <Show
                  when={messages().length > 0}
                  fallback={<div class="pt-2 text-sm text-white/40">No messages yet.</div>}
                >
                  <div class="space-y-3 pb-1">
                    <For each={messages()}>
                      {(message) => (
                        <article class="space-y-0.5">
                          <div class="flex items-center gap-2">
                            <span
                              class="h-2 w-2 shrink-0 rounded-full"
                              style={{
                                "background-color": message.color ?? DEFAULT_MESSAGE_DOT_COLOR,
                              }}
                            />
                            <span class="text-[10px] font-medium text-white/80">{message.nickname}</span>
                          </div>
                          <time
                            class="block pl-4 text-[9px] text-white/30"
                            dateTime={new Date(message._creationTime).toISOString()}
                            title={new Date(message._creationTime).toLocaleString()}
                          >
                            {formatRelativeTime(message._creationTime)}
                          </time>
                          <p class="break-words pl-4 text-sm text-white/70">{message.body}</p>
                        </article>
                      )}
                    </For>
                  </div>
                </Show>
              </Show>
            </div>
          </div>

          <footer class="border-t border-white/10 px-4 py-3">
            <Show
              when={!convexAuth.isLoading()}
              fallback={<div class="text-xs uppercase tracking-[0.22em] text-white/35">Checking session</div>}
            >
              <Show
                when={convexAuth.isAuthenticated()}
                fallback={
                  <div class="flex items-center justify-between gap-3">
                    <div class="text-xs uppercase tracking-[0.22em] text-white/45">
                      Sign in to chat
                    </div>
                    <SignInButton
                      mode="modal"
                      forceRedirectUrl="/"
                      fallbackRedirectUrl="/"
                      class="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs uppercase tracking-[0.22em] text-white transition hover:bg-white/15"
                    >
                      Sign in
                    </SignInButton>
                  </div>
                }
              >
                <Show
                  when={currentUserBootstrap.isReady()}
                  fallback={
                    <div class="text-xs uppercase tracking-[0.22em] text-white/35">
                      Preparing profile
                    </div>
                  }
                >
                  <form class="space-y-2" onSubmit={handleSubmit}>
                    <div class="flex items-center gap-2">
                      <input
                        class="min-w-0 flex-1 rounded-[4px] border border-white/15 bg-white/10 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30"
                        maxLength={500}
                        onInput={(event) => {
                          setBody(event.currentTarget.value);
                          if (errorMessage()) {
                            setErrorMessage(null);
                          }
                        }}
                        onKeyDown={(event) => event.stopPropagation()}
                        placeholder="Say something..."
                        type="text"
                        value={body()}
                      />
                      <button
                        class="rounded-[4px] border border-white/15 bg-white/10 px-3 py-2 text-xs uppercase tracking-[0.22em] text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:text-white/35"
                        disabled={!canSend()}
                        type="submit"
                      >
                        {isSending() ? "..." : "Send"}
                      </button>
                    </div>
                    <Show when={errorMessage()}>
                      {(message) => <div class="text-[10px] text-[#ffb4b4]">{message()}</div>}
                    </Show>
                  </form>
                </Show>
              </Show>
            </Show>
          </footer>
      </aside>
  );
}
