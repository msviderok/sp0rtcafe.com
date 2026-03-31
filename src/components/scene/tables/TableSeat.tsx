export default function TableSeat(props: { class?: string }) {
  return (
    <div class={`absolute border-2 border-dashed border-stone-400/30 ${props.class ?? ""}`} />
  );
}
