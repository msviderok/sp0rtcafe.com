export default function GridOverlay(props: { gridSize: number; visible: boolean }) {
  const tile = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${props.gridSize}' height='${props.gridSize}' viewBox='0 0 ${props.gridSize} ${props.gridSize}' fill='none'%3E%3Cpath d='M0.5 0V${props.gridSize}M0 0.5H${props.gridSize}' stroke='%23ffffff' stroke-opacity='0.12'/%3E%3C/svg%3E")`;

  return (
    <div
      aria-hidden="true"
      class="pointer-events-none absolute inset-0 transition-opacity duration-150"
      style={{
        opacity: props.visible ? "1" : "0",
        "background-image": tile,
        "background-size": `${props.gridSize}px ${props.gridSize}px`,
      }}
    />
  );
}
