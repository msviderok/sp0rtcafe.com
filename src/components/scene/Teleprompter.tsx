import TeleprompterHeader from "./teleprompter/TeleprompterHeader";
import TeleprompterLyrics from "./teleprompter/TeleprompterLyrics";

export default function Teleprompter() {
  return (
    <div class="absolute top-[188px] left-[660px] h-28 w-56 border-2 border-dashed border-emerald-500/50 bg-slate-900/70 overflow-hidden">
      <TeleprompterHeader />
      <TeleprompterLyrics />
    </div>
  );
}
