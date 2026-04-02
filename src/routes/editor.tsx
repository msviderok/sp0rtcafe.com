import { clientOnly } from "@solidjs/start";

const SpriteEditor = clientOnly(() => import("~/components/sprite-editor/SpriteEditor"), {
  lazy: true,
});

export default function EditorPage() {
  return <SpriteEditor />;
}
