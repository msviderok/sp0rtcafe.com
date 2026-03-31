import TvVideoPanel from "./tv/TvVideoPanel";

export default function TvZone() {
  return (
    <div class="absolute top-[118px] left-[60px] h-[294px] w-[520px] border-4 border-dashed border-cyan-500/50 bg-slate-800/80 flex flex-col">
      <TvVideoPanel />
    </div>
  );
}
