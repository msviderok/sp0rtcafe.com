export default function Jukebox() {
  return (
    <>
      <div class="absolute bottom-24 right-[400px] w-64 h-[340px] border-4 border-dashed border-amber-500/50 bg-slate-800/50 flex items-center justify-center">
        <span class="text-amber-500/60 text-lg font-mono">[JUKEBOX]</span>
      </div>
      <div class="absolute bottom-[200px] right-[680px] flex items-center gap-2">
        <div class="w-14 h-14 border-3 border-dashed border-yellow-500/50 rounded-full flex items-center justify-center bg-slate-900/50">
          <span class="text-yellow-500/40 text-[10px] font-mono">VOL</span>
        </div>
        <div class="w-10 h-0.5 border-t-2 border-dashed border-yellow-500/30" />
        <span class="text-yellow-500/20 text-[7px] font-mono">~wire~</span>
      </div>
    </>
  );
}
