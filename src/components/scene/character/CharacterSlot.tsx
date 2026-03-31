export default function CharacterSlot(props: {
  class?: string;
  borderClass: string;
  textClass: string;
  label?: string;
}) {
  return (
    <div
      class={`absolute bottom-0 flex h-[112px] w-[60px] items-end justify-center border-2 border-dashed pb-1 ${props.borderClass} ${props.class ?? ""}`}
    >
      <span class={`text-[7px] font-mono ${props.textClass}`}>{props.label ?? "[CHAR]"}</span>
    </div>
  );
}
