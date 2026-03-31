import type { ComponentProps } from "solid-js";
import Background from "./scene/Background";
import BarArea from "./scene/BarArea";
import CharacterZone from "./scene/CharacterZone";
import FloorPlants from "./scene/FloorPlants";
import Jukebox from "./scene/Jukebox";
import RightSeating from "./scene/RightSeating";
import Tables from "./scene/Tables";
import Teleprompter from "./scene/Teleprompter";
import TvZone from "./scene/TvZone";
import WallPosters from "./scene/WallPosters";
import WallSign from "./scene/WallSign";

export default function Scene(props: ComponentProps<"div">) {
  return (
    <div
      class="flex min-h-screen w-full items-center justify-center relative overflow-hidden"
      {...props}
    >
      <div class="relative h-[1000px] w-scene shrink-0 overflow-hidden" style={{}}>
        <Background />
        <BarArea />
        <Jukebox />
        {/* <WallSign /> */}
        {/* <WallPosters /> */}
        {/* <TvZone /> */}
        {/* <Teleprompter /> */}
        {/* <Tables /> */}
        {/* <FloorPlants /> */}
        {/* <CharacterZone /> */}
        {/* <RightSeating /> */}
      </div>
    </div>
  );
}
