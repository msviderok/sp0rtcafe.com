export default function RightSeating() {
  return (
    <>
      <div class="absolute bottom-24 left-[1380px] flex h-20 w-32 items-center justify-center border-4 border-dashed border-stone-500/40">
        <span class="text-stone-500/30 text-[8px] font-mono">[COUCH]</span>
      </div>
      <div class="absolute bottom-24 left-[1524px] flex h-16 w-24 items-center justify-center border-3 border-dashed border-stone-500/40">
        <span class="text-stone-500/30 text-[7px] font-mono">[COFFEE TBL]</span>
      </div>
      <div class="absolute bottom-24 left-[1624px] flex h-24 w-14 items-end justify-center border-2 border-dashed border-amber-400/30 pb-1">
        <span class="text-amber-400/30 text-[6px] font-mono">[LAMP]</span>
      </div>
    </>
  );
}
