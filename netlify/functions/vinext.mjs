import server from '../../dist/server/index.js';

/**
 * Netlify's Fetch-style function adapter for Vinext's generated server.
 * Static files are served from dist/client before this fallback is invoked.
 */
export default async function vinext(request, context) {
  return server.fetch(request, undefined, {
    waitUntil: context.waitUntil.bind(context),
  });
}
