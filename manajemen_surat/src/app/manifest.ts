import type { MetadataRoute } from "next";

import { withBasePath } from "@/lib/base-path";

/**
 * 23 Okt 2026: ALETA dapat dipasang dari peramban ke HP (Android & iPhone/iPad)
 * dan komputer. Alamat memakai basePath (mis. /aleta) karena portal tidak
 * berjalan di akar domain. Lihat src/lib/pasang-aplikasi.ts untuk batasnya.
 */
export default function manifest(): MetadataRoute.Manifest {
  const akar = withBasePath("/");
  return {
    id: akar,
    name: "ALETA - Akses Layanan Elektronik Terpadu Aksesibel",
    short_name: "ALETA",
    description: "Portal layanan elektronik terpadu pengadilan: surat, disposisi, jadwal sidang, dan layanan perkara.",
    lang: "id",
    start_url: akar,
    scope: akar,
    display: "standalone",
    orientation: "any",
    background_color: "#e6eef5",
    theme_color: "#155375",
    icons: [
      { src: withBasePath("/ikon-aplikasi/192"), sizes: "192x192", type: "image/png", purpose: "any" },
      { src: withBasePath("/ikon-aplikasi/512"), sizes: "512x512", type: "image/png", purpose: "any" },
      { src: withBasePath("/ikon-aplikasi/512"), sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
