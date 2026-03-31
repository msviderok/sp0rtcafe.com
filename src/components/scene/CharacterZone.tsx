import CharacterSlot from "./character/CharacterSlot";

export default function CharacterZone() {
  return (
    <div class="pointer-events-none absolute bottom-24 left-0 right-0 h-28">
      <CharacterSlot class="left-[120px]" borderClass="border-green-400/30" textClass="text-green-400/30" />
      <CharacterSlot class="left-[420px]" borderClass="border-blue-400/30" textClass="text-blue-400/30" />
      <CharacterSlot class="left-[760px]" borderClass="border-red-400/30" textClass="text-red-400/30" />
      <CharacterSlot class="left-[1120px]" borderClass="border-purple-400/30" textClass="text-purple-400/30" />
      <CharacterSlot class="left-[1540px]" borderClass="border-yellow-400/30" textClass="text-yellow-400/30" />
    </div>
  );
}
