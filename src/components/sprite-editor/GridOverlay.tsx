export default function GridOverlay(props: { gridSize: number; visible: boolean }) {
  return (
    <div
      aria-hidden="true"
      class="pointer-events-none absolute inset-0 transition-opacity duration-150"
      style={{
        opacity: props.visible ? "1" : "0",
        "background-image": `
          linear-gradient(to right, rgb(255 255 255 / 0.12) 1px, transparent 1px),
          linear-gradient(to bottom, rgb(255 255 255 / 0.12) 1px, transparent 1px)
        `,
        "background-size": `${props.gridSize}px ${props.gridSize}px`,
      }}
    />
  );
}
