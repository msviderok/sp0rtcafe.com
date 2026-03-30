import { clientOnly } from "@solidjs/start";

const MainScreen = clientOnly(async () => ({
  default: (await import("~/components/MainScreen")).default,
}));

export default function Home() {
  return <MainScreen />;
}
