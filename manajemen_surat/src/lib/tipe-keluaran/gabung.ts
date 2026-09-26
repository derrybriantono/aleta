import type { DataEntri, EntriCermin, EntriTipe, KunciDaftar } from "@/lib/tipe-keluaran/kontrak";

/**
 * ============================================================================
 * ATURAN GABUNGAN TIPE KELUARAN (K3) - SATU ATURAN, DIHITUNG DI PORTAL SAJA
 * ============================================================================
 *
 *   efektif = entri cermin bawaan (urutan asli)
 *             - bawaan yang barisnya aktif = 0
 *             + tambahan berkeadaan 'disahkan' dan aktif = 1
 *               (urut 'urutan', lalu dibuat_at)
 *
 * NILAI BAWAAN SELALU DIAMBIL DARI CERMIN KODE, bukan dari baris tabel. Baris
 * bawaan hanya membawa saklar aktif/nonaktif. Dengan begitu tabel yang kosong
 * atau tak terbaca menghasilkan keluaran yang sama persis dengan hari ini, dan
 * kode serta basis data tidak dapat berselisih tanpa ketahuan: baris bawaan
 * yang sidiknya tidak lagi ada di cermin disebut YATIM - diabaikan, dan
 * pemanggil mencatatnya sekali.
 *
 * Berkas ini murni dan dapat dipakai di peramban: SHA-1 ditulis di sini
 * (tanpa node:crypto) dan dijaga sama dengan node:crypto oleh ujinya.
 */

/** JSON dengan kunci objek terurut di semua tingkat - dasar sidik dan versi. */
export function jsonKanonik(nilai: unknown): string {
  return JSON.stringify(urutkanKunci(nilai));
}

function urutkanKunci(nilai: unknown): unknown {
  if (Array.isArray(nilai)) return nilai.map((x) => (x === undefined ? null : urutkanKunci(x)));
  if (nilai && typeof nilai === "object") {
    const hasil: Record<string, unknown> = {};
    for (const kunci of Object.keys(nilai as Record<string, unknown>).sort()) {
      const isi = (nilai as Record<string, unknown>)[kunci];
      if (isi === undefined) continue;
      hasil[kunci] = urutkanKunci(isi);
    }
    return hasil;
  }
  return nilai;
}

/** SHA-1 heksadesimal atas teks UTF-8. */
export function sha1Hex(teks: string): string {
  const bait = new TextEncoder().encode(teks);
  const panjangBit = bait.length * 8;
  const panjangBlok = (((bait.length + 8) >> 6) + 1) * 16;
  const kata = new Uint32Array(panjangBlok);
  for (let i = 0; i < bait.length; i += 1) kata[i >> 2] |= bait[i] << (24 - (i % 4) * 8);
  kata[bait.length >> 2] |= 0x80 << (24 - (bait.length % 4) * 8);
  kata[panjangBlok - 1] = panjangBit >>> 0;
  kata[panjangBlok - 2] = Math.floor(panjangBit / 0x100000000);

  let h0 = 0x67452301;
  let h1 = 0xefcdab89;
  let h2 = 0x98badcfe;
  let h3 = 0x10325476;
  let h4 = 0xc3d2e1f0;
  const w = new Uint32Array(80);
  const putar = (x: number, n: number) => (x << n) | (x >>> (32 - n));

  for (let blok = 0; blok < panjangBlok; blok += 16) {
    for (let t = 0; t < 16; t += 1) w[t] = kata[blok + t];
    for (let t = 16; t < 80; t += 1) w[t] = putar(w[t - 3] ^ w[t - 8] ^ w[t - 14] ^ w[t - 16], 1);
    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    for (let t = 0; t < 80; t += 1) {
      let f: number;
      let k: number;
      if (t < 20) {
        f = (b & c) | (~b & d);
        k = 0x5a827999;
      } else if (t < 40) {
        f = b ^ c ^ d;
        k = 0x6ed9eba1;
      } else if (t < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = 0x8f1bbcdc;
      } else {
        f = b ^ c ^ d;
        k = 0xca62c1d6;
      }
      const sementara = (putar(a, 5) + f + e + k + w[t]) >>> 0;
      e = d;
      d = c;
      c = putar(b, 30) >>> 0;
      b = a;
      a = sementara;
    }
    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
  }
  return [h0, h1, h2, h3, h4].map((x) => x.toString(16).padStart(8, "0")).join("");
}

/**
 * Sidik satu entri (K3):
 *   sha1 hex dari daftar + '\u0000' + kunci + '\u0000' + nilai + '\u0000' + JSON data kanonik.
 */
export function sidik(daftar: string, kunci: string, nilai: string, data: DataEntri | undefined | null): string {
  return sha1Hex(`${daftar}\u0000${kunci}\u0000${nilai}\u0000${jsonKanonik(data ?? {})}`);
}

/** versi = 16 hex pertama sha1 dari JSON kanonik semua daftar efektif yang dikirim. */
export function versiDari(daftar: Partial<Record<KunciDaftar, EntriTipe[]>>): string {
  return sha1Hex(jsonKanonik(daftar)).slice(0, 16);
}

/**
 * Baris tabel sebagaimana dibutuhkan aturan gabungan - sudah dirapikan
 * pemanggil (data sudah diurai dari JSON, aktif sudah boolean).
 */
export type BarisGabung = {
  id: string;
  asal: "bawaan" | "tambahan";
  sidik: string;
  aktif: boolean;
  keadaan: "usulan" | "disahkan" | "ditolak" | "diganti";
  kunci: string;
  nilai: string;
  data: DataEntri;
  urutan: number;
  dibuatAt: string;
};

export type HasilGabung = {
  entri: EntriTipe[];
  /** Baris bawaan yang sidiknya tidak ada di cermin - diabaikan. */
  yatim: BarisGabung[];
};

/** Entri cermin sebagai EntriTipe, tanpa melihat tabel sama sekali. */
export function cerminSebagaiEntri(
  daftar: KunciDaftar,
  cermin: readonly EntriCermin[],
  asal: "bawaan" | "cermin" = "bawaan"
): EntriTipe[] {
  return cermin.map((e) => ({
    kunci: e.kunci,
    nilai: e.nilai,
    data: e.data ?? {},
    urutan: e.urutan,
    asal,
    sidik: sidik(daftar, e.kunci, e.nilai, e.data),
  }));
}

export function gabungEfektif(
  daftar: KunciDaftar,
  cermin: readonly EntriCermin[],
  baris: readonly BarisGabung[]
): HasilGabung {
  const bawaan = cerminSebagaiEntri(daftar, cermin, "bawaan");
  const sidikCermin = new Set(bawaan.map((e) => e.sidik));
  // Saklar sebuah entri cermin = baris yang bersidik sama. UNIQUE (daftar,
  // sidik) menjamin barisnya paling banyak satu: biasanya baris bawaan, tetapi
  // dapat pula tambahan yang KEMUDIAN diadopsi ke kode - benihnya lalu
  // bertabrakan dan tidak pernah tertanam. Tambahan semacam itu menjadi
  // saklarnya dan tidak dikirim lagi sebagai tambahan: tanpa itu entrinya
  // tampil DUA kali, tanpa satu pun galat.
  const saklar = new Map<string, BarisGabung>();
  for (const b of baris) if (sidikCermin.has(b.sidik)) saklar.set(b.sidik, b);

  // Bawaan: nilai dari cermin, saklarnya dari baris. Entri cermin yang belum
  // punya baris (benih belum sempat tertulis) tetap berlaku - "tidak ada
  // barisnya" tidak pernah boleh berarti "dimatikan".
  const entri = bawaan.filter((e) => {
    const b = saklar.get(e.sidik);
    return !b || b.aktif;
  });

  const yatim = baris.filter((b) => b.asal === "bawaan" && !sidikCermin.has(b.sidik));

  const tambahan = baris
    .filter((b) => b.asal === "tambahan" && b.keadaan === "disahkan" && b.aktif && !sidikCermin.has(b.sidik))
    .slice()
    .sort(
      (a, b) =>
        a.urutan - b.urutan ||
        (a.dibuatAt < b.dibuatAt ? -1 : a.dibuatAt > b.dibuatAt ? 1 : 0) ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
    );
  for (const t of tambahan) {
    entri.push({ kunci: t.kunci, nilai: t.nilai, data: t.data, urutan: t.urutan, asal: "tambahan", sidik: t.sidik });
  }

  return { entri, yatim };
}
