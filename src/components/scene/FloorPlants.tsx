import FloorPlant from "./plants/FloorPlant";

export default function FloorPlants() {
  return (
    <>
      <FloorPlant
        class="left-[660px] h-20 w-14"
        label="[POTTED FLOWER]"
        borderClass="border-pink-400/30"
        textClass="text-pink-400/30 text-[7px]"
      />
      <FloorPlant
        class="left-[880px] h-20 w-12"
        label="[PLANT]"
        borderClass="border-pink-400/30"
        textClass="text-pink-400/30 text-[6px]"
      />
      <FloorPlant
        class="left-[1080px] h-20 w-14"
        label="[FLOWER]"
        borderClass="border-pink-400/30"
        textClass="text-pink-400/30 text-[7px]"
      />
      <FloorPlant
        class="left-[1340px] h-20 w-12"
        label="[FERN]"
        borderClass="border-green-400/30"
        textClass="text-green-400/30 text-[6px]"
      />
    </>
  );
}
