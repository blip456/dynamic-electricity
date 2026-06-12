import type { LayoutServerLoad } from './$types';
import { env } from '$env/dynamic/public';

export const load: LayoutServerLoad = async () => {
    return { vapidPublicKey: env.PUBLIC_VAPID_KEY ?? '' };
};
