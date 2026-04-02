import { SignInButton } from "clerk-solidjs";
import { useMutation, useQuery } from "convex-solidjs";
import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";
import { useConvexClerkAuth } from "../integrations/convex-clerk";

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

export default function ChatBox() {
  const convexAuth = useConvexClerkAuth();
  const messagesQuery = useQuery(api.chat.list, {});
  const sendMessage = useMutation(api.chat.send);
  const [isOpen, setIsOpen] = createSignal(true);
  const [body, setBody] = createSignal("");
  const [isSending, setIsSending] = createSignal(false);
  const [errorMessage, setErrorMessage] = createSignal<string | null>(null);
  const messages = createMemo(() => ((messagesQuery.data() ?? []) as Doc<"chatMessages">[]));
  const canSend = createMemo(() => body().trim().length > 0 && !isSending());
  let messagesRef: HTMLDivElement | undefined;

  createEffect(() => {
    isOpen();
    messages().length;

    queueMicrotask(() => {
      if (!isOpen() || !messagesRef) {
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
    <div class="pointer-events-none fixed bottom-4 right-4 z-50 flex items-end justify-end max-sm:left-4">
      <Show
        when={isOpen()}
        fallback={
          <button
            class="pointer-events-auto rounded-full border border-white/15 bg-black/55 px-4 py-2 text-xs uppercase tracking-[0.22em] text-white/90 shadow-[0_12px_30px_rgba(0,0,0,0.35)] backdrop-blur-sm transition hover:bg-black/70"
            onClick={() => setIsOpen(true)}
            type="button"
          >
            Chat
          </button>
        }
      >
        <section class="pointer-events-auto flex h-[400px] w-[320px] max-w-[calc(100vw-2rem)] flex-col rounded-[4px] border border-white/10 bg-black/20 shadow-[0_18px_50px_rgba(0,0,0,0.35)] backdrop-blur-sm">
          <header class="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div class="text-xs uppercase tracking-[0.22em] text-white/45">Chat</div>
            <button
              class="text-xs uppercase tracking-[0.22em] text-white/55 transition hover:text-white"
              onClick={() => setIsOpen(false)}
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
                        <article class="space-y-1">
                          <div class="flex items-center gap-2">
                            <span
                              class="h-2 w-2 rounded-full"
                              style={{
                                "background-color": message.color ?? DEFAULT_MESSAGE_DOT_COLOR,
                              }}
                            />
                            <span class="text-[10px] text-white/80">{message.nickname}</span>
                            <time
                              class="text-[10px] text-white/35"
                              dateTime={new Date(message._creationTime).toISOString()}
                              title={new Date(message._creationTime).toLocaleString()}
                            >
                              {formatRelativeTime(message._creationTime)}
                            </time>
                          </div>
                          <p class="break-words text-sm text-white/70">{message.body}</p>
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
          </footer>
        </section>
      </Show>
    </div>
  );
}
