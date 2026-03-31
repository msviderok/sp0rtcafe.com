export default function WallPoster(props: { class?: string; label: string }) {
  return (
    <div
      class={`absolute border-2 border-dashed border-rose-500/30 flex items-center justify-center ${props.class ?? ""}`}
    >
      <span class="text-rose-500/30 text-[8px] font-mono text-center">{props.label}</span>
    </div>
  );
}
