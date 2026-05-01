import type { Handle } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

export const handle: Handle = async ({ event, resolve }) => {
    if (event.url.pathname.startsWith('/api/cron')) {
        const auth = event.request.headers.get('authorization');
        const secret = env.CRON_SECRET;
        if (secret && auth !== `Bearer ${secret}`) {
            return new Response('Unauthorized', { status: 401 });
        }
    }
    return resolve(event);
};
