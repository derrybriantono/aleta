import { getGatewayWilayahRingkas, getGatewayWilayahSipp } from "@/server/modules/aleta-bot/whatsapp-gateway-client";

/**
 * Daftar ringkas satu provinsi untuk "ketik nama desa" di ekstensi (22 Okt 2026).
 *
 * Bentuk (sama dengan sippWilayahService.daftarRingkas di bot):
 *   { versi, provinsi:{kode,nama}, kab:[[kode,nama]], kec:[[kode,nama]],
 *     desa:{ "72.03.11": [["2001","DALAKA"], ...] } }
 * Tanpa nilai bersandi (nilai satu desa terpilih diminta lewat ?kode= pada
 * rute wilayah). Diambil ekstensi SEKALI lalu disimpan di peramban 30 hari.
 *
 * Bot yang belum dibangun ulang tidak mengenal ?ringkas: jawabannya daftar
 * provinsi biasa. Kita lalu menyusun daftar yang sama dari ?induk= (kabupaten,
 * lalu kecamatan, sekali per provinsi, paralel terbatas) dan mengingatnya 12
 * jam di memori portal - peramban tetap hanya satu permintaan.
 */
export type WilayahRingkas = {
  versi: 1;
  provinsi: { kode: string; nama: string };
  kab: Array<[string, string]>;
  kec: Array<[string, string]>;
  desa: Record<string, Array<[string, string]>>;
};

type Anak = { ok: boolean; data: Array<{ kode: string; nama: string }> };
export type SumberWilayah = {
  ringkas: (provinsi: string) => Promise<{ ok: boolean; status?: number; kode?: string; data?: Record<string, unknown>; error?: string }>;
  anak: (induk: string) => Promise<Anak>;
};

export const SUMBER_GATEWAY: SumberWilayah = {
  ringkas: async (provinsi) => {
    const j = await getGatewayWilayahRingkas(provinsi);
    return j.ok ? { ok: true, data: j.data } : { ok: false, status: j.status, kode: j.kode, error: j.error };
  },
  anak: async (induk) => {
    const j = await getGatewayWilayahSipp({ induk });
    if (!j.ok) return { ok: false, data: [] };
    const isi = j.data as { ok?: boolean; data?: Array<{ kode: string; nama: string }> };
    return { ok: isi.ok === true, data: Array.isArray(isi.data) ? isi.data : [] };
  },
};

const UMUR_MS = 12 * 60 * 60 * 1000;
const singgah = new Map<string, { waktu: number; hasil: WilayahRingkas }>();
const berjalan = new Map<string, Promise<WilayahRingkas | null>>();

export function kosongkanSinggahRingkas() {
  singgah.clear();
  berjalan.clear();
}

function bentukSah(x: unknown): x is Record<string, unknown> & WilayahRingkas {
  const j = x as Partial<WilayahRingkas> | null;
  return Boolean(j && j.versi === 1 && j.provinsi && Array.isArray(j.kab) && Array.isArray(j.kec) && j.desa && typeof j.desa === "object");
}

async function paralel<T, R>(daftar: T[], batas: number, kerja: (x: T) => Promise<R>): Promise<R[]> {
  const hasil: R[] = new Array(daftar.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(batas, daftar.length) }, async () => {
      for (;;) {
        const n = i;
        i += 1;
        if (n >= daftar.length) return;
        hasil[n] = await kerja(daftar[n]);
      }
    })
  );
  return hasil;
}

async function susunDariAnak(provinsi: string, sumber: SumberWilayah): Promise<WilayahRingkas | null> {
  const semua = await sumber.anak("");
  const prov = semua.data.find((p) => p.kode === provinsi);
  if (!semua.ok || !prov) return null;
  const kab = await sumber.anak(provinsi);
  if (!kab.ok) return null;
  const kecamatan = await paralel(kab.data, 4, async (k) => ({ kab: k.kode, daftar: await sumber.anak(k.kode) }));
  if (kecamatan.some((k) => !k.daftar.ok)) return null;
  const kec: Array<[string, string]> = [];
  for (const k of kecamatan) for (const c of k.daftar.data) kec.push([c.kode, c.nama]);
  const desaPer = await paralel(kec, 6, async ([kode]) => ({ kode, daftar: await sumber.anak(kode) }));
  if (desaPer.some((d) => !d.daftar.ok)) return null;
  const desa: Record<string, Array<[string, string]>> = {};
  for (const d of desaPer) {
    const baris: Array<[string, string]> = [];
    for (const x of d.daftar.data) {
      const m = /^\d{2}\.\d{2}\.\d{2}\.(\d{4})$/.exec(x.kode);
      if (m) baris.push([m[1], x.nama]);
    }
    if (baris.length) desa[d.kode] = baris;
  }
  return { versi: 1, provinsi: { kode: prov.kode, nama: prov.nama }, kab: kab.data.map((k) => [k.kode, k.nama]), kec, desa };
}

/** null bila tidak terbaca (pemanggil menjawab "belum tersedia"). */
export async function ambilWilayahRingkas(provinsi: string, sumber: SumberWilayah = SUMBER_GATEWAY): Promise<WilayahRingkas | null> {
  const ada = singgah.get(provinsi);
  if (ada && Date.now() - ada.waktu < UMUR_MS) return ada.hasil;
  const sedang = berjalan.get(provinsi);
  if (sedang) return sedang;
  const janji = (async () => {
    try {
      const j = await sumber.ringkas(provinsi);
      let hasil: WilayahRingkas | null = null;
      if (j.ok && bentukSah(j.data)) {
        hasil = j.data as WilayahRingkas;
      } else if (j.ok || (j.status === 404 && !j.kode)) {
        // Bot lama: jawabannya daftar provinsi biasa (atau halaman 404) -> susun dari ?induk=.
        hasil = await susunDariAnak(provinsi, sumber);
      }
      if (hasil) singgah.set(provinsi, { waktu: Date.now(), hasil });
      return hasil;
    } finally {
      berjalan.delete(provinsi);
    }
  })();
  berjalan.set(provinsi, janji);
  return janji;
}
