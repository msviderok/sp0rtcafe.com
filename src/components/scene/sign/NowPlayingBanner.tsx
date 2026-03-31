export default function NowPlayingBanner() {
  return (
    <div class="w-[420px] h-24 border-3 border-dashed border-pink-500/60 bg-slate-900/70 flex flex-col items-center justify-center gap-2">
      <span class="text-pink-400/80 text-base font-mono animate-pulse">SYNCED - 12 LISTENING</span>
      <span class="text-pink-400/60 text-sm font-mono">[TRACK NAME] / [NEXT TRACK]</span>
    </div>
  );
}
