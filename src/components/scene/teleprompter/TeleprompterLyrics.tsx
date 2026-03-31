export default function TeleprompterLyrics() {
  return (
    <div class="flex h-full flex-col items-center justify-center gap-1 pt-2">
      <span class="text-emerald-400/20 text-[10px]">[previous line fading...]</span>
      <span class="text-emerald-400/80 text-base font-medium">[CURRENT LYRIC LINE]</span>
      <span class="text-emerald-400/40 text-xs">[next line...]</span>
      <span class="text-emerald-400/20 text-[10px]">[upcoming...]</span>
    </div>
  );
}
