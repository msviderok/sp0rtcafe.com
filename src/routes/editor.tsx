import { clientOnly } from "@solidjs/start";
import LoadingScreen from "~/components/LoadingScreen";

const SpriteEditor = clientOnly(() => import("~/components/sprite-editor/SpriteEditor"), {
  lazy: true,
});

export default function EditorPage() {
  return <SpriteEditor fallback={<LoadingScreen label="Loading editor" />} />;
}
