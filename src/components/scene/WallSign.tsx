import BandNameSign from "./sign/BandNameSign";
import NowPlayingBanner from "./sign/NowPlayingBanner";

export default function WallSign() {
  return (
    <div class="absolute top-8 left-1/2 -translate-x-1/2">
      <div class="flex flex-col items-center gap-4">
        <BandNameSign />
        <NowPlayingBanner />
      </div>
    </div>
  );
}
