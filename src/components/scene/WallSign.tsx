export default function WallSign() {
  return (
    <div class="absolute top-8 left-1/2 -translate-x-1/2">
      <div class="flex flex-col items-center gap-4">
        <div class="px-20 py-6 border-4 border-dashed border-amber-500/50 bg-slate-900/60">
          <span class="text-amber-500/70 text-4xl font-mono tracking-[0.3em]">
            [BAND NAME SIGN]
          </span>
        </div>
        <div class="w-[420px] h-24 border-3 border-dashed border-pink-500/60 bg-slate-900/70 flex flex-col items-center justify-center gap-2">
          <span class="text-pink-400/80 text-base font-mono animate-pulse">
            SYNCED - 12 LISTENING
          </span>
          <span class="text-pink-400/60 text-sm font-mono">[TRACK NAME] / [NEXT TRACK]</span>
        </div>
      </div>
    </div>
  );
}
