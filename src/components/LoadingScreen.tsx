export default function LoadingScreen(props: { label?: string }) {
	return (
		<div
			class="fixed inset-0 z-[9999] flex items-center justify-center bg-[#140d0b]"
		>
			<div class="flex flex-col items-center gap-6">
				<div class="flex gap-1.5">
					<div class="h-2.5 w-2.5 animate-bounce rounded-full bg-white/60 [animation-delay:0ms]" />
					<div class="h-2.5 w-2.5 animate-bounce rounded-full bg-white/60 [animation-delay:150ms]" />
					<div class="h-2.5 w-2.5 animate-bounce rounded-full bg-white/60 [animation-delay:300ms]" />
				</div>
				<p class="text-xs uppercase tracking-[0.22em] text-white/40">
					{props.label ?? "Loading"}
				</p>
			</div>
		</div>
	);
}
