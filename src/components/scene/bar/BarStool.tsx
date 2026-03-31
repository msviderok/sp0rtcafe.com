export default function BarStool(props: { class?: string }) {
  return (
    <div
      class={`absolute bottom-24 w-12 h-20 border-2 border-dashed border-stone-500/40 flex items-end justify-center pb-1 ${props.class ?? ""}`}
    >
      <span class="text-stone-500/30 text-[6px] font-mono">[STOOL]</span>
    </div>
  );
}
