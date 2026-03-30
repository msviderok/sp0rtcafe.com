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
    <div class="w-[1920px] h-[1000px] flex items-center justify-center overflow-hidden" {...props}>
      <div class="w-full h-full relative overflow-scroll">
        <Background />
        <WallSign />
        <WallPosters />
        <BarArea />
        <TvZone />
        <Teleprompter />
        <Jukebox />
        <Tables />
        <FloorPlants />
        <CharacterZone />
        <RightSeating />
      </div>
    </div>
  );
}
