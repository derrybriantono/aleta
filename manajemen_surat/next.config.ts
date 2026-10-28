import type { NextConfig } from "next";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  ...(basePath ? { basePath, assetPrefix: basePath } : {}),
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  images: {
    unoptimized: true,
  },
  experimental: {
    // 28 Okt 2026: proxy (src/proxy.ts) memotong badan permintaan di atas 10 MB (bawaan Next 16) TANPA galat - unggah e-Doc
    // penetapan otomatis membawa RTF blangko ABT bergambar (PMH-PHS 4,5 MB, PPP/PJS 2,2 MB; ±18 MB setelah base64) sehingga
    // gagal dibaca. Rute unggah putusan/BAS manual juga menerima sampai 20 MB per berkas.
    proxyClientMaxBodySize: "64mb",
  },
};

export default nextConfig;
