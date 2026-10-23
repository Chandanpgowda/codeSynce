const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['lh3.googleusercontent.com', 'avatars.githubusercontent.com'],
  },
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
    ];
  },
  webpack: (config) => {
    // y-monaco imports monaco-editor via an internal submodule path
    // ("monaco-editor/esm/vs/editor/editor.api.js"). The monaco-editor package's
    // "exports" map redirects this subpath to a wrong nested path, and bundling
    // Monaco's ESM sources breaks Next.js builds (SWC cannot parse its worker
    // files). Instead, we alias the specifier to a small shim that forwards to
    // the runtime-loaded Monaco instance provided by @monaco-editor/react.
    config.resolve.alias = {
      ...config.resolve.alias,
      'monaco-editor/esm/vs/editor/editor.api.js': path.resolve(
        __dirname,
        'lib/monaco-api-shim.js'
      ),
    };

    return config;
  },
};

module.exports = nextConfig;
