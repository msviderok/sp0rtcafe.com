export default function Teleprompter() {
  return (
    <div class="absolute top-[188px] left-[660px] h-28 w-56 border-2 border-dashed border-emerald-500/50 bg-slate-900/70 overflow-hidden">
      <div class="absolute top-1 left-2 text-emerald-500/30 text-[7px] font-mono">
        [TELEPROMPTER]
      </div>
      <div class="flex h-full flex-col items-center justify-center gap-1 pt-2">
        <span class="text-emerald-400/20 text-[10px]">[previous line fading...]</span>
        <span class="text-emerald-400/80 text-base font-medium">[CURRENT LYRIC LINE]</span>
        <span class="text-emerald-400/40 text-xs">[next line...]</span>
        <span class="text-emerald-400/20 text-[10px]">[upcoming...]</span>
      </div>
    </div>
  );
}
