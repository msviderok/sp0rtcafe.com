import jukebox from "~/sprites/jukebox.png";

export default function Jukebox() {
  return (
    <>
      <div
        class="absolute bottom-[calc(var(--floor-h)-2px)] right-[100px] w-(--jukebox-w) h-(--jukebox-h) bg-no-repeat bg-size-[100%_100%]"
        style={{ "background-image": `url(${jukebox})` }}
      />
    </>
  );
}
