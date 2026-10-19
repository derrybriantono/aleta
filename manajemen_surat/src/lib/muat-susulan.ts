/**
 * Muat susulan portal yang DITUNDA (performa muat 19 Okt 2026, K3).
 *
 * Setiap halaman portal, sesudah sesi dan hak akses terbaca, meminta delapan
 * data susulan sekaligus: surat (100 terbaru), disposisi, setelan AI,
 * WhatsApp, asisten hakim, identitas satker, setelan panel, dan hak Blangko
 * Saya. Di halaman aplikasi yang memuat datanya sendiri (ALETA e-Court,
 * ALETA SIPP) kelimanya yang pertama tidak dipakai isi tab, tetapi ikut
 * berebut enam sambungan peramban ke server yang sama dengan permintaan tab
 * itu - SIPP, ABT, dan polling ekstensi memakai host yang sama.
 *
 * Yang ditunda HANYA lima itu dan HANYA di halaman tersebut, sampai peramban
 * senggang sesudah gambar pertama (paling cepat MIN_MS, paling lambat
 * MAKS_MS). Identitas satker, setelan panel, dan hak Blangko Saya tetap
 * segera: ketiganya dipakai kerangka halaman (logo, nama, menu). Di halaman
 * lain - surat, disposisi, setelan - tidak ada yang ditunda.
 */

/** Awalan jalur (sesudah basePath) yang boleh menunda muat susulan. */
const JALUR_BOLEH_TUNDA = ["/aleta-ecourt", "/aleta-sipp"];

export const MIN_TUNDA_SUSULAN_MS = 1200;
export const MAKS_TUNDA_SUSULAN_MS = 4000;

/** Kunci data susulan yang boleh ditunda. */
export const SUSULAN_BOLEH_TUNDA = ["surat", "disposisi", "ai", "whatsapp", "asistenHakim"] as const;

function buangBasePath(jalur: string, basePath: string) {
  const dasar = String(basePath || "").replace(/\/$/, "");
  if (dasar && (jalur === dasar || jalur.startsWith(`${dasar}/`))) return jalur.slice(dasar.length) || "/";
  return jalur;
}

/** Halaman ini boleh menunda muat susulannya? */
export function bolehTundaSusulan(jalur: string, basePath = process.env.NEXT_PUBLIC_BASE_PATH || "/aleta") {
  const bersih = buangBasePath(String(jalur || "").split(/[?#]/)[0], basePath);
  return JALUR_BOLEH_TUNDA.some((awal) => bersih === awal || bersih.startsWith(`${awal}/`));
}

type JendelaSenggang = {
  requestIdleCallback?: (f: () => void, opsi?: { timeout: number }) => number;
  setTimeout: (f: () => void, ms: number) => unknown;
};

/**
 * Selesai saat peramban senggang, tidak lebih cepat dari minMs dan tidak lebih
 * lambat dari maksMs. Tanpa requestIdleCallback: tepat minMs.
 */
export function tungguSenggang(
  jendela: JendelaSenggang | undefined = typeof window === "undefined" ? undefined : (window as unknown as JendelaSenggang),
  minMs = MIN_TUNDA_SUSULAN_MS,
  maksMs = MAKS_TUNDA_SUSULAN_MS
): Promise<void> {
  if (!jendela) return Promise.resolve();
  return new Promise((selesai) => {
    let sudah = false;
    const akhiri = () => {
      if (sudah) return;
      sudah = true;
      selesai();
    };
    jendela.setTimeout(() => {
      if (typeof jendela.requestIdleCallback === "function") {
        jendela.requestIdleCallback(akhiri, { timeout: Math.max(0, maksMs - minMs) });
        jendela.setTimeout(akhiri, Math.max(0, maksMs - minMs));
      } else {
        akhiri();
      }
    }, minMs);
  });
}
