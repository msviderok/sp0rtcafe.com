import { onCleanup, onMount } from "solid-js";
import { defaultProps } from "./utils";

const MAX_DELTA_SECONDS = 1 / 20;

export default function createGameLoop(options: {
  autostart?: boolean;
  fn: (timestamp: number, deltaSeconds: number) => void;
}) {
  let mainGameLoop: number | undefined;
  let previousTimestamp = 0;
  const props = defaultProps(options, {
    autostart: true,
    fn: () => {},
  });

  if (props.autostart) {
    onMount(() => start());
    onCleanup(() => stop());
  }

  function gameLoop(timestamp: number) {
    const deltaSeconds = previousTimestamp
      ? Math.min(MAX_DELTA_SECONDS, (timestamp - previousTimestamp) / 1000)
      : 0;
    previousTimestamp = timestamp;
    props.fn(timestamp, deltaSeconds);
    mainGameLoop = requestAnimationFrame(gameLoop);
  }

  function start() {
    previousTimestamp = 0;
    mainGameLoop = requestAnimationFrame(gameLoop);
  }

  function stop() {
    if (mainGameLoop) {
      cancelAnimationFrame(mainGameLoop);
      mainGameLoop = undefined;
    }

    previousTimestamp = 0;
  }

  return { start, stop };
}
