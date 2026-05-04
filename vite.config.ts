import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

function getBuildNumber(): string {
    // Vercel exposes VERCEL_DEPLOYMENT_ID like "dpl_2xK9abc..."
    // Use it directly as a short build tag when on Vercel.
    const deployId = process.env.VERCEL_DEPLOYMENT_ID;
    if (deployId) return deployId;

    // Locally: use total git commit count as a sequential build number.
    try {
        return execSync('git rev-list --count HEAD', { stdio: ['pipe', 'pipe', 'pipe'] })
            .toString()
            .trim();
    } catch {
        return '0';
    }
}

const APP_VERSION = `${pkg.version}+${getBuildNumber()}`;

export default defineConfig({
    plugins: [tailwindcss(), sveltekit()],
    define: {
        __APP_VERSION__: JSON.stringify(APP_VERSION)
    }
});
