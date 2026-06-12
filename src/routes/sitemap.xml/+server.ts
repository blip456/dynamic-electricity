import type { RequestHandler } from './$types';

// /settings is excluded: it is noindex (personal configuration only).
const PAGES = ['/', '/week', '/stats', '/changelog'];

export const GET: RequestHandler = ({ url }) => {
    const body =
        '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
        PAGES.map((p) => `    <url><loc>${url.origin}${p}</loc></url>`).join('\n') +
        '\n</urlset>\n';

    return new Response(body, {
        headers: {
            'Content-Type': 'application/xml',
            'Cache-Control': 'public, max-age=3600'
        }
    });
};
