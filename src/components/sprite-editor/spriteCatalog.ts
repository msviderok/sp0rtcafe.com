import barShelf from "~/sprites/bar_shelf.png";
import barStand from "~/sprites/bar_stand.png";
import bottle1 from "~/sprites/bottle1.png";
import bottle2 from "~/sprites/bottle2.png";
import bottle3 from "~/sprites/bottle3.png";
import chairBack from "~/sprites/chair_back.png";
import chairFront from "~/sprites/chair_front.png";
import jukebox from "~/sprites/jukebox.png";
import telecasters from "~/sprites/telecasters.png";

export const SPRITE_CATALOG = [
  { key: "jukebox", url: jukebox },
  { key: "bar-shelf", url: barShelf },
  { key: "bar-stand", url: barStand },
  { key: "telecasters", url: telecasters },
  { key: "bottle-1", url: bottle1 },
  { key: "bottle-2", url: bottle2 },
  { key: "bottle-3", url: bottle3 },
  { key: "chair-back", url: chairBack },
  { key: "chair-front", url: chairFront },
] as const;
