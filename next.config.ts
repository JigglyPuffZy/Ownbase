import type { NextConfig } from "next";
import path from 'node:path';

const nextConfig: NextConfig = {
  distDir:process.env.VERCEL==='1'||process.env.OWNBASE_RUNTIME==='vercel'?'.next-vercel':'.next',
  outputFileTracingRoot:process.cwd(),
  webpack(config,{webpack}){if(process.env.VERCEL==='1'||process.env.OWNBASE_RUNTIME==='vercel')config.plugins.push(new webpack.NormalModuleReplacementPlugin(/^cloudflare:workers$/,(resource:{request:string})=>{resource.request=path.resolve('lib/vercel-env.ts');}));return config;},
};

export default nextConfig;
