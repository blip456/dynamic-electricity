import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
    preprocess: [vitePreprocess()],
    kit: {
        adapter: adapter({
            runtime: 'nodejs22.x',
            // Pin functions to Frankfurt: closest region to the Belgian users
            // and the Belgian price APIs (Eneco/ENTSO-E) this app calls.
            regions: ['fra1']
        }),
        serviceWorker: {
            register: true
        }
    }
};

export default config;
