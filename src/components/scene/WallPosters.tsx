import WallPoster from "./posters/WallPoster";

export default function WallPosters() {
  return (
    <>
      <WallPoster class="top-[148px] left-[40px] h-28 w-20" label="[POSTER 1]" />
      <WallPoster class="top-[124px] left-[380px] h-24 w-20" label="[POSTER 2]" />
      <WallPoster class="top-[156px] left-[820px] h-32 w-24" label="[POSTER 3]" />
      <WallPoster class="top-[132px] left-[1240px] h-24 w-20" label="[POSTER 4]" />
      <WallPoster class="top-[168px] left-[1660px] h-28 w-20" label="[POSTER 5]" />
    </>
  );
}
