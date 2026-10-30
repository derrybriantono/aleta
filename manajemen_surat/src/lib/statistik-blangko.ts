/**
 * ============================================================================
 * STATISTIK PEMAKAIAN BLANGKO - ATURAN MURNI (30 Okt 2026, G6 butir 6.4)
 * ============================================================================
 *
 * ABT tidak mencatat blangko apa yang dicetak. ALETA mencatatnya setiap kali
 * blangko dicetak dari panel Blangko ABT by Derry (ekstensi statistik-cetak.js
 * -> POST /api/aleta-ecourt/statistik-blangko {aksi:"cetak"} -> audit_logs
 * aksi BLANGKO_DICETAK). Data lama yang sudah ada dipakai juga: baris cetak
 * aleta_blangko_lapor (dicetak = 1, hanya terisi bila saklar "wajib sebelum
 * cetak" pernah menyala; baris itu tidak menyimpan folder).
 *
 * Ringkasan HANYA INFORMASI untuk Super Admin/Admin di Pusat Kendali: blangko
 * paling sering / tidak pernah dicetak per folder (= per jenis perkara di
 * Blangko Derry) dan per jenis perkara SIPP, serta pasangan blangko satu folder
 * yang naskahnya hampir sama (kandidat arsip). Tidak ada yang dihapus atau
 * dipindah otomatis.
 *
 * Yang dicatat per cetakan: folder + nama berkas blangko, jenis blangko, jenis
 * perkara, nomor perkara, siapa, kapan. Tidak ada isi naskah atau isian.
 */

export const AKSI_BLANGKO_DICETAK = "BLANGKO_DICETAK";
export const ENTITAS_BLANGKO = "blangko_derry";
export const TERBANYAK_PER_KELOMPOK = 10;

export type CetakMasuk = {
  perkaraId: string;
  nomorPerkara: string;
  kelompok: string;
  berkas: string;
  jenisBlangko: string;
  jenisPerkara: string;
};

export type CetakTercatat = {
  kelompok: string; // folder (relatif terhadap derry_briantono); "" bila tidak diketahui (data lama)
  berkas: string; // nama berkas tanpa .rtf
  jenisPerkara: string;
  perkaraId: string;
  pada: string; // ISO
  sumber: "cetak" | "lapor";
};

export type BerkasKatalog = { rel: string; folder: string; nama: string; ukuran?: number };
export type PasanganMirip = { folder: string; a: string; b: string; mirip: number };
export type KatalogBlangko = { dipindai?: string; jumlah?: number; berkas: BerkasKatalog[]; ganda: PasanganMirip[]; ambangMirip?: number };

const teks = (x: unknown) =>
  String(x ?? "")
    .replace(/[\u0000-\u001f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Nama berkas tanpa folder dan tanpa .rtf. */
export function namaBerkas(x: unknown): string {
  const s = teks(x).replace(/\\/g, "/");
  return (s.split("/").pop() ?? "").replace(/\.rtf$/i, "").trim();
}

/** Folder relatif terhadap derry_briantono ("derry_briantono/1 Perceraian CG" -> "1 Perceraian CG"). */
export function namaKelompok(x: unknown): string {
  return teks(x)
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "")
    .replace(/^derry_briantono(\/|$)/i, "")
    .trim();
}

/** Laporan cetak dari ekstensi -> bentuk bersih, atau null bila tidak lengkap. */
export function bersihkanCetak(mentah: unknown): CetakMasuk | null {
  if (!mentah || typeof mentah !== "object" || Array.isArray(mentah)) return null;
  const o = mentah as Record<string, unknown>;
  const berkas = namaBerkas(o.berkas).slice(0, 300);
  const perkaraId = teks(o.perkaraId).slice(0, 60);
  if (!berkas || !perkaraId) return null;
  return {
    perkaraId,
    nomorPerkara: teks(o.nomorPerkara).slice(0, 100),
    kelompok: namaKelompok(o.kelompok).slice(0, 300),
    berkas,
    jenisBlangko: teks(o.jenisBlangko ?? o.jenis).slice(0, 20),
    jenisPerkara: teks(o.jenisPerkara).slice(0, 120),
  };
}

export type RingkasBlangko = { berkas: string; jumlah: number; terakhir: string };
export type RingkasKelompok = {
  kelompok: string;
  jumlahBlangko: number;
  jumlahCetak: number;
  dipakai: number;
  terbanyak: RingkasBlangko[];
  tidakPernah: string[];
};
export type RingkasJenis = { jenisPerkara: string; jumlahCetak: number; terbanyak: Array<RingkasBlangko & { kelompok: string }> };
export type RingkasGanda = PasanganMirip & { cetakA: number; cetakB: number };
export type StatistikBlangko = {
  jumlahCetak: number;
  sejak: string;
  sampai: string;
  tanpaFolder: number;
  perKelompok: RingkasKelompok[];
  perJenis: RingkasJenis[];
  ganda: RingkasGanda[];
  katalogTersedia: boolean;
  dipindai: string;
};

/**
 * Menyusun ringkasan. Cetakan lama tanpa folder (sumber "lapor") ditempatkan ke folder katalog
 * HANYA bila nama berkasnya unik di katalog; selain itu dihitung di `tanpaFolder` (tidak ditebak).
 */
export function susunStatistik(cetak: CetakTercatat[], katalog: KatalogBlangko | null): StatistikBlangko {
  const berkasKatalog = katalog?.berkas ?? [];
  const folderNama = new Map<string, string[]>();
  for (const b of berkasKatalog) {
    const n = namaBerkas(b.nama || b.rel);
    folderNama.set(n, [...(folderNama.get(n) ?? []), namaKelompok(b.folder)]);
  }
  const kunci = (k: string, b: string) => `${k}\u0000${b}`;
  const hitung = new Map<string, { kelompok: string; berkas: string; jumlah: number; terakhir: string }>();
  const perJenis = new Map<string, Map<string, { kelompok: string; berkas: string; jumlah: number; terakhir: string }>>();
  let tanpaFolder = 0;
  let sejak = "";
  let sampai = "";
  for (const c of cetak) {
    const berkas = namaBerkas(c.berkas);
    if (!berkas) continue;
    let kelompok = namaKelompok(c.kelompok);
    if (!kelompok) {
      const calon = folderNama.get(berkas) ?? [];
      if (calon.length === 1) kelompok = calon[0];
    }
    if (!sejak || c.pada < sejak) sejak = c.pada;
    if (!sampai || c.pada > sampai) sampai = c.pada;
    if (!kelompok) tanpaFolder += 1;
    const k = kunci(kelompok, berkas);
    const e = hitung.get(k) ?? { kelompok, berkas, jumlah: 0, terakhir: "" };
    e.jumlah += 1;
    if (c.pada > e.terakhir) e.terakhir = c.pada;
    hitung.set(k, e);
    const jenis = teks(c.jenisPerkara) || "(jenis perkara tidak tercatat)";
    const pj = perJenis.get(jenis) ?? new Map();
    const ej = pj.get(k) ?? { kelompok, berkas, jumlah: 0, terakhir: "" };
    ej.jumlah += 1;
    if (c.pada > ej.terakhir) ej.terakhir = c.pada;
    pj.set(k, ej);
    perJenis.set(jenis, pj);
  }

  const urut = <T extends { jumlah: number; terakhir: string; berkas: string }>(a: T, b: T) =>
    b.jumlah - a.jumlah || b.terakhir.localeCompare(a.terakhir) || a.berkas.localeCompare(b.berkas, "id");

  const kelompokSemua = new Set<string>();
  for (const b of berkasKatalog) kelompokSemua.add(namaKelompok(b.folder));
  for (const e of hitung.values()) kelompokSemua.add(e.kelompok); // "" = cetakan lama tanpa folder (baris tersendiri)

  const perKelompok: RingkasKelompok[] = [...kelompokSemua]
    .sort((a, b) => a.localeCompare(b, "id", { numeric: true }))
    .map((kelompok) => {
      const dicetak = [...hitung.values()].filter((e) => e.kelompok === kelompok).sort(urut);
      const isi = berkasKatalog.filter((b) => namaKelompok(b.folder) === kelompok).map((b) => namaBerkas(b.nama || b.rel));
      const pernah = new Set(dicetak.map((e) => e.berkas));
      return {
        kelompok,
        jumlahBlangko: isi.length,
        jumlahCetak: dicetak.reduce((n, e) => n + e.jumlah, 0),
        dipakai: isi.filter((n) => pernah.has(n)).length,
        terbanyak: dicetak.slice(0, TERBANYAK_PER_KELOMPOK).map(({ berkas, jumlah, terakhir }) => ({ berkas, jumlah, terakhir })),
        tidakPernah: isi.filter((n) => !pernah.has(n)).sort((a, b) => a.localeCompare(b, "id", { numeric: true })),
      };
    });

  const ringkasJenis: RingkasJenis[] = [...perJenis.entries()]
    .map(([jenisPerkara, peta]) => {
      const isi = [...peta.values()].sort(urut);
      return {
        jenisPerkara,
        jumlahCetak: isi.reduce((n, e) => n + e.jumlah, 0),
        terbanyak: isi.slice(0, TERBANYAK_PER_KELOMPOK).map(({ kelompok, berkas, jumlah, terakhir }) => ({ kelompok, berkas, jumlah, terakhir })),
      };
    })
    .sort((a, b) => b.jumlahCetak - a.jumlahCetak || a.jenisPerkara.localeCompare(b.jenisPerkara, "id"));

  const jumlahDi = (folder: string, rel: string) => {
    const e = hitung.get(kunci(namaKelompok(folder), namaBerkas(rel)));
    return e ? e.jumlah : 0;
  };
  const ganda: RingkasGanda[] = (katalog?.ganda ?? []).map((g) => ({ ...g, cetakA: jumlahDi(g.folder, g.a), cetakB: jumlahDi(g.folder, g.b) }));

  return {
    jumlahCetak: [...hitung.values()].reduce((n, e) => n + e.jumlah, 0),
    sejak,
    sampai,
    tanpaFolder,
    perKelompok,
    perJenis: ringkasJenis,
    ganda,
    katalogTersedia: Boolean(katalog),
    dipindai: katalog?.dipindai ?? "",
  };
}
