import floor from "~/sprites/textures/Brickwall5_Texture.png";
import wallBaseColor from "~/sprites/textures/wood/Birch/Planks/Birch_Planks_basecolor.png";
import wall from "~/sprites/textures/wood/Birch/Planks/Birch_Planks_height.png";

export default function Background() {
  return (
    <>
      <div class="absolute inset-0 h-[800px]">
        <div class="absolute inset-0" style={{ "background-image": `url(${wallBaseColor})` }} />
        <div class="absolute inset-0 opacity-10" style={{ "background-image": `url(${wall})` }} />
      </div>
      <div
        style={{ "background-image": `url(${floor})` }}
        class="absolute bottom-0 left-0 right-0 h-(--floor-h) bg-amber-950 bg-center bg-repeat bg-size-(--floor-texture-size) border-t-8 border-amber-950"
      />
    </>
  );
}
