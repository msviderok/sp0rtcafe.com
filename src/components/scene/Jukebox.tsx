export default function Jukebox() {
  return (
    <>
      <div class="absolute bottom-24 right-6 h-[260px] w-52 border-4 border-dashed border-amber-500/50 bg-slate-800/50 flex items-center justify-center">
        <span class="text-amber-500/60 text-base font-mono">[JUKEBOX]</span>
      </div>
      <div class="absolute bottom-[168px] right-[248px] flex items-center gap-2">
        <div class="flex h-12 w-12 items-center justify-center rounded-full border-3 border-dashed border-yellow-500/50 bg-slate-900/50">
          <span class="text-yellow-500/40 text-[10px] font-mono">VOL</span>
        </div>
        <div class="h-0.5 w-8 border-t-2 border-dashed border-yellow-500/30" />
        <span class="text-yellow-500/20 text-[7px] font-mono">~wire~</span>
      </div>
    </>
  );
}
