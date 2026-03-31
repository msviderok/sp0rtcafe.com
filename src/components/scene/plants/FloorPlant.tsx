export default function FloorPlant(props: { class?: string; label: string; borderClass: string; textClass: string }) {
  return (
    <div
      class={`absolute bottom-24 border-2 border-dashed flex items-end justify-center pb-1 ${props.borderClass} ${props.class ?? ""}`}
    >
      <span class={`font-mono ${props.textClass}`}>{props.label}</span>
    </div>
  );
}
