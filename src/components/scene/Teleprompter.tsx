export default function Teleprompter() {
  return (
    <div class="absolute top-[200px] left-[700px] w-64 h-28 border-2 border-dashed border-emerald-500/50 bg-slate-900/70 overflow-hidden">
      <div class="absolute top-1 left-2 text-emerald-500/30 text-[7px] font-mono">
        [TELEPROMPTER]
      </div>
      <div class="flex flex-col items-center justify-center h-full gap-1 pt-2">
        <span class="text-emerald-400/20 text-[10px]">[previous line fading...]</span>
        <span class="text-emerald-400/80 text-base font-medium">[CURRENT LYRIC LINE]</span>
        <span class="text-emerald-400/40 text-xs">[next line...]</span>
        <span class="text-emerald-400/20 text-[10px]">[upcoming...]</span>
      </div>
    </div>
  );
}
