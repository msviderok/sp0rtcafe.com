export default function BarShelf(props: { class?: string; label: string }) {
  return (
    <div
      class={`absolute border-2 border-dashed border-amber-400/30 flex items-center justify-center ${props.class ?? ""}`}
    >
      <span class="text-amber-400/30 text-[8px] font-mono">{props.label}</span>
    </div>
  );
}
