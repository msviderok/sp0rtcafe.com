export default function TableProp(props: { class?: string; label?: string; textClass?: string }) {
  return (
    <div class={`absolute border border-dashed flex items-center justify-center ${props.class ?? ""}`}>
      {props.label ? <span class={props.textClass}>{props.label}</span> : null}
    </div>
  );
}
