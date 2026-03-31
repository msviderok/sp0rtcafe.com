import SceneCoffeeTable from "./seating/SceneCoffeeTable";
import SceneCouch from "./seating/SceneCouch";
import SceneFloorLamp from "./seating/SceneFloorLamp";

export default function RightSeating() {
  return (
    <>
      <SceneCouch />
      <SceneCoffeeTable />
      <SceneFloorLamp />
    </>
  );
}
