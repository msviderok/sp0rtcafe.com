export default function BarCounterItem(props: { class?: string; label: string; textClass?: string }) {
  return (
    <div
      class={`absolute bottom-[164px] border border-dashed flex items-center justify-center ${props.class ?? ""}`}
    >
      <span class={props.textClass ?? "text-sky-400/30 text-[5px]"}>{props.label}</span>
    </div>
  );
}
