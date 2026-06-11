import { marked } from 'marked';

// Prerendered at build time: the changelog only changes when a release
// commit is deployed, which always triggers a fresh build.
export const prerender = true;

// import.meta.glob tolerates the file not existing yet (before the first
// release) — a direct import would fail the build.
const files = import.meta.glob('/CHANGELOG.md', {
    query: '?raw',
    import: 'default',
    eager: true
}) as Record<string, string>;

export const load = async () => {
    const raw = files['/CHANGELOG.md'] ?? null;
    const html = raw ? await marked.parse(raw) : null;
    return { html };
};
