export default function TableSurface(props: { class?: string; label: string }) {
  return (
    <div
      class={`absolute border-4 border-dashed border-stone-500/40 flex items-center justify-center ${props.class ?? ""}`}
    >
      <span class="text-stone-500/30 text-[9px] font-mono">{props.label}</span>
    </div>
  );
}
