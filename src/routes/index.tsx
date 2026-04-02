import { clientOnly } from "@solidjs/start";

const SceneLanding = clientOnly(() => import("~/components/SceneLanding"), {
  lazy: true,
});

export default function Home() {
  return <SceneLanding />;
}
