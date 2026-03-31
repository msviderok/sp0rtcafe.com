import barShelf from "~/sprites/bar_shelf.png";
import barStand from "~/sprites/bar_stand.png";

export default function BarArea() {
  return (
    <div class="absolute bottom-(--floor-h)">
      <div
        class="absolute w-(--bar-shelf-w) h-(--bar-shelf-h) bottom-[60px] bg-no-repeat bg-size-[100%_100%] -left-[100px]"
        style={{ "background-image": `url(${barShelf})` }}
      />
      <div
        class="absolute w-(--bar-stand-w) h-(--bar-stand-h) bg-no-repeat bg-size-[100%_100%] -left-[30px] bottom-0"
        style={{ "background-image": `url(${barStand})` }}
      />
    </div>
  );
}
