import { onMount, createSignal } from 'solid-js';

export default function LoadingScreen() {
	const [visible, setVisible] = createSignal(false);

	onMount(() => {
		// Small delay to avoid flash on fast loads
		const timer = setTimeout(() => setVisible(true), 120);
		return () => clearTimeout(timer);
	});

	return (
		<div
			class="fixed inset-0 z-[9999] flex items-center justify-center bg-[#140d0b] transition-opacity duration-300"
			style={{ opacity: visible() ? 1 : 0 }}
		>
			<div class="flex flex-col items-center gap-6">
				<div class="flex gap-1.5">
					<div class="h-2.5 w-2.5 animate-bounce rounded-full bg-white/60 [animation-delay:0ms]" />
					<div class="h-2.5 w-2.5 animate-bounce rounded-full bg-white/60 [animation-delay:150ms]" />
					<div class="h-2.5 w-2.5 animate-bounce rounded-full bg-white/60 [animation-delay:300ms]" />
				</div>
				<p class="text-xs uppercase tracking-[0.22em] text-white/40">Loading</p>
			</div>
		</div>
	);
}
