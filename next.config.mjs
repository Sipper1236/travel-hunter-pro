import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/** api-anything resolves its bundled site specs relative to its package directory. */
export default {
  // The isolated local-stack smoke check needs its own development state so it
  // can run while the user's loopback site is already active.
  distDir: process.env.TRAVEL_NEXT_DIST_DIR || '.next',
  serverExternalPackages: ['api-anything', 'playwright-core'],
  turbopack: { root: dirname(fileURLToPath(import.meta.url)) },
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
      ],
    }];
  },
};
