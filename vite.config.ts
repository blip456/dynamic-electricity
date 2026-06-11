import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

function getBuildTag(): string {
    // On Vercel: the deployed commit's short SHA.
    const sha = process.env.VERCEL_GIT_COMMIT_SHA;
    if (sha) return sha.slice(0, 7);

    // Fall back to the deployment id ("dpl_2xK9abc..."), shortened.
    const deployId = process.env.VERCEL_DEPLOYMENT_ID;
    if (deployId) return deployId.replace(/^dpl_/, '').slice(0, 7);

    // Locally: short SHA from git.
    try {
        return execSync('git rev-parse --short HEAD', { stdio: ['pipe', 'pipe', 'pipe'] })
            .toString()
            .trim();
    } catch {
        return 'local';
    }
}

export default defineConfig({
    plugins: [tailwindcss(), sveltekit()],
    define: {
        // Semver release number, managed by semantic-release (e.g. "0.1.1-beta.2")
        __APP_VERSION__: JSON.stringify(pkg.version),
        // Short build identifier for tracing a deployment back to a commit
        __APP_BUILD__: JSON.stringify(getBuildTag())
    }
});
