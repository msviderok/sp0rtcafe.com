import { onCleanup, onMount } from "solid-js";
import { defaultProps } from "./utils";

const TICK = 16.66666666; // 60 fps | 1000ms / 60fps = 16.66ms

export default function createGameLoop(options: { autostart?: boolean; fn: () => void }) {
  let mainGameLoop: number | undefined;
  let tickTimer = 0;
  const props = defaultProps(options, { autostart: true, fn: () => {} });

  if (props.autostart) {
    onMount(() => start());
    onCleanup(() => stop());
  }

  /**
   * In order to keep the game updates more consistent – we need to limit amount of updates per second.
   * 120 fps was way too inconsistent.
   * 60 fps seems to be working good so far.
   */
  async function gameLoop(timestamp: number) {
    if (!tickTimer) tickTimer = timestamp;
    if (timestamp - tickTimer < TICK) {
      mainGameLoop = requestAnimationFrame(gameLoop);
      return;
    }
    tickTimer += TICK;

    props.fn();

    mainGameLoop = requestAnimationFrame(gameLoop);
  }

  function start() {
    mainGameLoop = requestAnimationFrame(gameLoop);
  }

  function stop() {
    if (mainGameLoop) {
      cancelAnimationFrame(mainGameLoop);
      mainGameLoop = undefined;
    }
  }

  return { start, stop };
}
