/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  images: { unoptimized: true },
  basePath: "",
  trailingSlash: false,
  reactStrictMode: true,
  // The landing sits inside the khoros repo; pin the tracing root to THIS dir
  // so Next doesn't infer the parent workspace.
  outputFileTracingRoot: import.meta.dirname,
};

export default nextConfig;
