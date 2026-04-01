import { Slider as SliderPrimitive } from '@msviderok/base-ui-solid/slider';
import { createMemo, For, mergeProps, splitProps } from 'solid-js';

import { cn } from '~/lib/utils';

function Slider(componentProps: SliderPrimitive.Root.Props) {
	const mergedProps = mergeProps({ min: 0, max: 100 }, componentProps);
	const [local, props] = splitProps(mergedProps, ['class', 'defaultValue', 'value', 'min', 'max']);
	const _values = createMemo(() =>
		Array.isArray(local.value)
			? local.value
			: Array.isArray(local.defaultValue)
				? local.defaultValue
				: [local.min, local.max],
	);

	return (
		<SliderPrimitive.Root
			class={cn('data-horizontal:w-full data-vertical:h-full', local.class)}
			data-slot="slider"
			defaultValue={local.defaultValue}
			value={local.value}
			min={local.min}
			max={local.max}
			{...props}
		>
			<SliderPrimitive.Control class="relative flex w-full touch-none items-center select-none data-disabled:opacity-50 data-vertical:h-full data-vertical:min-h-40 data-vertical:w-auto data-vertical:flex-col">
				<SliderPrimitive.Track
					data-slot="slider-track"
					class="relative grow overflow-hidden rounded-md bg-muted select-none data-horizontal:h-3 data-horizontal:w-full data-vertical:h-full data-vertical:w-3"
				>
					<SliderPrimitive.Indicator
						data-slot="slider-range"
						class="bg-primary select-none data-horizontal:h-full data-vertical:w-full"
					/>
				</SliderPrimitive.Track>
				<For each={_values()}>
					{() => (
						<SliderPrimitive.Thumb
							data-slot="slider-thumb"
							class="block size-4 shrink-0 rounded-md border border-primary bg-white shadow-sm ring-ring/30 transition-colors select-none hover:ring-4 focus-visible:ring-4 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50"
						/>
					)}
				</For>
			</SliderPrimitive.Control>
		</SliderPrimitive.Root>
	);
}

export { Slider };
export default Slider;
