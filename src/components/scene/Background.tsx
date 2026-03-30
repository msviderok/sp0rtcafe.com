export default function Background() {
  return (
    <>
      <div class="absolute inset-0 bg-linear-to-b from-slate-950 via-indigo-950 to-slate-900" />
      <div class="absolute inset-x-0 top-0 h-[520px] bg-linear-to-b from-slate-800 to-slate-900 border-b-8 border-slate-700" />
      <div class="absolute bottom-0 left-0 right-0 h-24 bg-slate-800 border-t-4 border-slate-600">
        <div class="absolute inset-0 opacity-10 bg-[repeating-linear-gradient(90deg,transparent,transparent_40px,rgba(255,255,255,0.05)_40px,rgba(255,255,255,0.05)_80px)]" />
      </div>
    </>
  );
}
