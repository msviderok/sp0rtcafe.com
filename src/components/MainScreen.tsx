// @refresh reload
import { createContext, useContext, type ParentProps } from "solid-js";
import { createStore, type SetStoreFunction, type Store } from "solid-js/store";
import createGameLoop from "~/lib/createGameLoop";
import Scene from "./Scene";

function contextFactory() {
  return {};
}

type State = ReturnType<typeof contextFactory>;

const MainContext = createContext<{
  store: Store<State>;
  setStore: SetStoreFunction<State>;
}>();

function useMainContext() {
  const context = useContext(MainContext);

  if (!context) {
    throw Error("Main context is missing!");
  }

  return context;
}

export default function MainScreen(props: ParentProps) {
  const [store, setStore] = createStore<State>({});
  const gameloop = createGameLoop({
    autostart: false,
    fn: () => {},
  });

  return (
    <MainContext.Provider value={{ store, setStore }}>
      <MainSceneContent />
    </MainContext.Provider>
  );
}

function MainSceneContent() {
  let containerRef!: HTMLDivElement;

  return <Scene ref={containerRef}>{/* <Guy /> */}</Scene>;
}

function Guy() {
  return <span class="absolute w-10 h-24 bg-yellow-400" />;
}
