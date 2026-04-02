import { For, Show } from "solid-js";

export default function QuickActionsBar(props: {
  actions: Array<{
    key: string;
    label: string;
    slot: number;
  }>;
  activeActionName: string | null;
  isRunActive: boolean;
  runAvailable: boolean;
}) {
  return (
    <div class="mt-3 flex flex-wrap items-center gap-2 rounded-[4px] border border-white/10 bg-black/20 px-4 py-3 backdrop-blur-sm">
      <div class="text-[10px] uppercase tracking-[0.18em] text-white/40">Quick actions</div>

      <Show when={props.runAvailable}>
        <div
          class={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.16em] transition ${
            props.isRunActive
              ? "border-emerald-400/30 bg-emerald-400/12 text-emerald-200"
              : "border-white/10 bg-white/[0.03] text-white/65"
          }`}
        >
          Shift Run
        </div>
      </Show>

      <For each={props.actions}>
        {(action) => (
          <div
            class={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.16em] transition ${
              props.activeActionName === action.key
                ? "border-white/25 bg-white/12 text-white"
                : "border-white/10 bg-white/[0.03] text-white/65"
            }`}
          >
            {action.slot} {action.label}
          </div>
        )}
      </For>

      <Show when={!props.runAvailable && props.actions.length === 0}>
        <div class="text-xs text-white/45">No extra actions on this character.</div>
      </Show>
    </div>
  );
}
