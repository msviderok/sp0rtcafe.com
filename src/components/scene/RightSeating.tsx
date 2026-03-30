export default function RightSeating() {
  return (
    <>
      <div class="absolute bottom-24 left-[2600px] w-32 h-20 border-4 border-dashed border-stone-500/40 flex items-center justify-center">
        <span class="text-stone-500/30 text-[8px] font-mono">[COUCH]</span>
      </div>
      <div class="absolute bottom-24 left-[2760px] w-24 h-16 border-3 border-dashed border-stone-500/40 flex items-center justify-center">
        <span class="text-stone-500/30 text-[7px] font-mono">[COFFEE TBL]</span>
      </div>
      <div class="absolute bottom-24 right-8 w-20 h-28 border-2 border-dashed border-amber-400/30 flex items-end justify-center pb-1">
        <span class="text-amber-400/30 text-[6px] font-mono">[LAMP]</span>
      </div>
    </>
  );
}
