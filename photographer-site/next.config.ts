import type { NextConfig } from 'next';
// Vinext probes multipart requests before API routing. Keep that limit above
// the endpoint's bounded 12 MB image total plus multipart metadata.
const nextConfig: NextConfig = {
 experimental: { serverActions: { bodySizeLimit: '13mb' } },
};
export default nextConfig;
