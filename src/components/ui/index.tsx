import { clientOnly } from '@solidjs/start';

export const Slider = clientOnly(() => import('./slider'), { lazy: true });
