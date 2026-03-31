import TableProp from "./tables/TableProp";
import TableSeat from "./tables/TableSeat";
import TableSurface from "./tables/TableSurface";

export default function Tables() {
  return (
    <>
      <TableSurface class="bottom-24 left-[680px] h-20 w-36" label="[TABLE 1]" />
      <TableSeat class="bottom-24 left-[648px] h-16 w-10" />
      <TableSeat class="bottom-24 left-[820px] h-16 w-10" />
      <TableSeat class="bottom-[132px] left-[724px] h-10 w-12" />
      <TableProp class="bottom-[152px] left-[704px] h-8 w-6 border-sky-400/20" />
      <TableProp class="bottom-[152px] left-[756px] h-7 w-5 border-amber-400/20" />
      <TableProp
        class="bottom-[152px] left-[782px] h-10 w-8 border-pink-400/20 flex items-center justify-center"
        label="FLR"
        textClass="text-pink-400/20 text-[4px]"
      />
      <TableSurface class="bottom-24 left-[940px] h-20 w-32" label="[TABLE 2]" />
      <TableSeat class="bottom-24 left-[908px] h-16 w-10" />
      <TableSeat class="bottom-24 left-[1068px] h-16 w-10" />
      <TableProp class="bottom-[128px] left-[968px] h-9 w-7 border-sky-400/20" />
      <TableProp class="bottom-[128px] left-[1024px] h-8 w-6 border-amber-400/20" />
      <TableSurface class="bottom-24 left-[1140px] h-20 w-40" label="[TABLE 3]" />
      <TableSeat class="bottom-24 left-[1108px] h-16 w-10" />
      <TableSeat class="bottom-24 left-[1288px] h-16 w-10" />
      <TableSeat class="bottom-[132px] left-[1188px] h-10 w-12" />
      <TableSeat class="bottom-[132px] left-[1244px] h-10 w-12" />
      <TableProp class="bottom-[152px] left-[1168px] h-8 w-6 border-sky-400/20" />
      <TableProp
        class="bottom-[152px] left-[1212px] h-10 w-8 border-green-400/20 flex items-center justify-center"
        label="PLT"
        textClass="text-green-400/20 text-[4px]"
      />
      <TableProp class="bottom-[152px] left-[1268px] h-7 w-5 border-amber-400/20" />
    </>
  );
}
