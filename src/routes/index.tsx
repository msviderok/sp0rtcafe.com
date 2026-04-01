import { clientOnly } from "@solidjs/start";
import LoadingScreen from "~/components/LoadingScreen";

const SceneLanding = clientOnly(() => import("~/components/SceneLanding"), {
  lazy: true,
});

export default function Home() {
  return <SceneLanding fallback={<LoadingScreen label="Loading scene" />} />;
}
