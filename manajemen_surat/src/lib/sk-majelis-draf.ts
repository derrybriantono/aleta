/**
 * Logika murni halaman admin "SK susunan majelis" (20 Okt 2026, agen B1):
 * draf yang disunting, pemeriksaan, perbandingan dengan yang tersimpan, dan
 * pratinjau "begini usulan PMH/PPP akan memakai SK ini". Tanpa React dan tanpa
 * jaringan supaya dapat diuji langsung.
 *
 * Bentuk data majelis SAMA dengan yang tersimpan di aleta_sipp_hari_sidang
 * (hakimKode berurutan ketua di depan; panitera berpasangan kode-id) - halaman
 * hanya mengubah cara menyuntingnya, bukan bentuknya.
 */

export type Pasangan = { kode: string; id: number };

export type MajelisSk = {
  majelisKode: string;
  hari: number;
  namaHari: string;
  paniteraKode: string[];
  panitera: Pasangan[];
  hakimKode: string[];
  akun: { kode: string; akunId: string }[];
  skNomor: string;
  skTanggal: string;
  skIkutBawaan: boolean;
  keterangan: string;
  bawaan: boolean;
};

export type DrafMajelis = MajelisSk & {
  /** true = majelis baru yang belum pernah disimpan. */
  baru: boolean;
  /** true = akan dihapus dari SK saat disimpan. */
  hapus: boolean;
};

export type PegawaiRingkas = { id: number; kode: string; nama: string };

export const KODE_SAH = /^[A-Z0-9]{1,8}$/;

export function drafDari(daftar: MajelisSk[]): DrafMajelis[] {
  return daftar.map((m) => ({
    ...m,
    hakimKode: [...m.hakimKode],
    paniteraKode: [...m.paniteraKode],
    panitera: m.panitera.map((p) => ({ ...p })),
    akun: (m.akun ?? []).map((a) => ({ ...a })),
    baru: false,
    hapus: false,
  }));
}

export function majelisBaru(kode: string, hari = 1, namaHari = "Senin"): DrafMajelis {
  return {
    majelisKode: kode.trim().toUpperCase(),
    hari,
    namaHari,
    paniteraKode: [],
    panitera: [],
    hakimKode: [],
    akun: [],
    skNomor: "",
    skTanggal: "",
    skIkutBawaan: true,
    keterangan: "",
    bawaan: false,
    baru: true,
    hapus: false,
  };
}

/** Pasangan panitera menurut urutan kode SK; kode tanpa pasangan berid 0 (belum diikat). */
export function barisPanitera(m: Pick<MajelisSk, "paniteraKode" | "panitera">): Pasangan[] {
  return m.paniteraKode.map((kode) => ({ kode, id: m.panitera.find((p) => p.kode === kode)?.id ?? 0 }));
}

/** Menyatukan kode panitera dan pasangannya dari baris yang disunting. */
export function terapkanBarisPanitera(m: DrafMajelis, baris: Pasangan[]): DrafMajelis {
  const bersih = baris.map((b) => ({ kode: b.kode.trim().toUpperCase(), id: b.id }));
  const kodeAda = new Set([...m.hakimKode, ...bersih.map((b) => b.kode)]);
  return {
    ...m,
    // Baris yang kodenya belum diisi TETAP ada di draf (ditandai galat sampai diisi),
    // supaya "Tambah pendamping" tidak menghilang sebelum sempat diketik.
    paniteraKode: bersih.map((b) => b.kode),
    panitera: bersih,
    // Tautan akun milik kode yang sudah tidak ada di majelis ini ikut gugur.
    akun: m.akun.filter((a) => kodeAda.has(a.kode)),
  };
}

export function terapkanHakim(m: DrafMajelis, hakimKode: string[]): DrafMajelis {
  const kodeAda = new Set([...hakimKode, ...m.paniteraKode]);
  return { ...m, hakimKode, akun: m.akun.filter((a) => kodeAda.has(a.kode)) };
}

export type HasilPeriksa = { galat: string[]; peringatan: string[] };

/**
 * Pemeriksaan draf. `galat` menahan penyimpanan; `peringatan` hanya diberitahukan.
 * hakim/panitera kosong = daftar SIPP tidak terbaca: kecocokan tidak diperiksa.
 */
export function periksaDraf(draf: DrafMajelis[], hakim: PegawaiRingkas[], panitera: PegawaiRingkas[]): HasilPeriksa {
  const galat: string[] = [];
  const peringatan: string[] = [];
  const kodeHakimAktif = new Set(hakim.map((h) => h.kode.toUpperCase()).filter(Boolean));
  const idPaniteraAktif = new Set(panitera.map((p) => p.id));
  const sudah = new Set<string>();
  for (const m of draf) {
    if (m.hapus) continue;
    const nama = `Majelis ${m.majelisKode || "(tanpa kode)"}`;
    if (!KODE_SAH.test(m.majelisKode)) galat.push(`${nama}: kode hanya huruf dan angka, paling banyak 8 (mis. A, B, C1).`);
    if (sudah.has(m.majelisKode)) galat.push(`${nama}: kode majelis kembar.`);
    sudah.add(m.majelisKode);
    if (m.hakimKode.length < 2) galat.push(`${nama}: pilih ketua dan sedikitnya satu anggota.`);
    if (new Set(m.hakimKode).size !== m.hakimKode.length) galat.push(`${nama}: seorang hakim tidak boleh dua kali dalam satu majelis.`);
    if (m.hakimKode.some((k) => !KODE_SAH.test(k))) galat.push(`${nama}: ada hakim yang belum dipilih.`);
    const kodePp = m.paniteraKode;
    if (kodePp.some((k) => !KODE_SAH.test(k))) galat.push(`${nama}: kode panitera pendamping hanya huruf dan angka, paling banyak 8 (mis. D, D1).`);
    if (new Set(kodePp).size !== kodePp.length) galat.push(`${nama}: kode panitera pendamping kembar.`);
    const terikat = barisPanitera(m);
    const orangSama = terikat.filter((b) => b.id > 0).map((b) => b.id);
    if (new Set(orangSama).size !== orangSama.length) galat.push(`${nama}: seorang panitera tidak boleh dua kali dalam satu majelis.`);
    if (kodePp.length === 0) peringatan.push(`${nama}: belum ada panitera pengganti pendamping - panel memakai giliran beban.`);
    for (const b of terikat) {
      if (b.id === 0) peringatan.push(`${nama}: panitera ${b.kode} belum diikat ke orangnya.`);
      else if (idPaniteraAktif.size > 0 && !idPaniteraAktif.has(b.id)) peringatan.push(`${nama}: panitera ${b.kode} sudah tidak aktif di SIPP.`);
    }
    if (kodeHakimAktif.size > 0) {
      for (const k of m.hakimKode) {
        if (k && !kodeHakimAktif.has(k)) peringatan.push(`${nama}: hakim ${k} sudah tidak aktif di SIPP.`);
      }
    }
  }
  return { galat, peringatan };
}

const sebutHakim = (kode: string, hakim: PegawaiRingkas[]) => {
  const orang = hakim.find((h) => h.kode.toUpperCase() === kode);
  return orang ? `${kode} (${orang.nama})` : kode;
};
const sebutPanitera = (p: Pasangan, panitera: PegawaiRingkas[]) => {
  const orang = panitera.find((x) => x.id === p.id);
  return `${p.kode}${orang ? ` = ${orang.nama}` : p.id > 0 ? " = (tidak aktif)" : " (belum diikat)"}`;
};

export type Perubahan = { kode: string; jenis: "tambah" | "ubah" | "hapus"; uraian: string[] };

/** Apa yang berubah dari yang tersimpan (untuk kotak konfirmasi sebelum menyimpan). */
export function bandingkan(asli: MajelisSk[], draf: DrafMajelis[], hakim: PegawaiRingkas[], panitera: PegawaiRingkas[]): Perubahan[] {
  const hasil: Perubahan[] = [];
  const peta = new Map(asli.map((m) => [m.majelisKode, m]));
  for (const m of draf) {
    const lama = peta.get(m.majelisKode);
    if (m.hapus) {
      if (lama) hasil.push({ kode: m.majelisKode, jenis: "hapus", uraian: [`Majelis ${m.majelisKode} dihapus dari SK.`] });
      continue;
    }
    if (m.baru || !lama) {
      hasil.push({
        kode: m.majelisKode,
        jenis: "tambah",
        uraian: [
          `Hakim: ${m.hakimKode.map((k) => sebutHakim(k, hakim)).join(", ") || "-"}`,
          `Panitera pendamping: ${barisPanitera(m).map((p) => sebutPanitera(p, panitera)).join(", ") || "-"}`,
          `Hari sidang: ${m.namaHari}`,
        ],
      });
      continue;
    }
    const u: string[] = [];
    if (m.hari !== lama.hari) u.push(`Hari sidang ${lama.namaHari} -> ${m.namaHari}`);
    if (m.hakimKode.join(",") !== lama.hakimKode.join(",")) {
      u.push(`Hakim ${lama.hakimKode.join(", ") || "-"} -> ${m.hakimKode.map((k) => sebutHakim(k, hakim)).join(", ") || "-"}`);
    }
    const sebelumPp = barisPanitera(lama).map((p) => `${p.kode}=${p.id}`).join(",");
    const sesudahPp = barisPanitera(m).map((p) => `${p.kode}=${p.id}`).join(",");
    if (sebelumPp !== sesudahPp) u.push(`Panitera pendamping -> ${barisPanitera(m).map((p) => sebutPanitera(p, panitera)).join(", ") || "-"}`);
    const akunLama = (lama.akun ?? []).map((a) => `${a.kode}=${a.akunId}`).sort().join(",");
    const akunBaru = (m.akun ?? []).map((a) => `${a.kode}=${a.akunId}`).sort().join(",");
    if (akunLama !== akunBaru) u.push("Tautan akun portal anggota berubah");
    const skLama = lama.skIkutBawaan ? "" : `${lama.skNomor}|${lama.skTanggal}`;
    const skBaru = m.skIkutBawaan ? "" : `${m.skNomor}|${m.skTanggal}`;
    if (skLama !== skBaru) u.push(m.skIkutBawaan ? "SK khusus dicabut (ikut SK bawaan)" : `SK khusus ${m.skNomor} (${m.skTanggal})`);
    if (m.keterangan !== lama.keterangan) u.push("Keterangan berubah");
    if (u.length) hasil.push({ kode: m.majelisKode, jenis: "ubah", uraian: u });
  }
  return hasil;
}

export type SkAtas = { nomor: string; tanggal: string; berlaku: string };

/** Pratinjau kalimat awam: apa yang akan dipakai usulan PMH/PPP/PHS bila SK ini disimpan. */
export function susunPratinjau(draf: DrafMajelis[], hakim: PegawaiRingkas[], panitera: PegawaiRingkas[], sk: SkAtas): string[] {
  const baris: string[] = [];
  const aktif = draf.filter((m) => !m.hapus && m.hakimKode.length >= 2);
  if (aktif.length === 0) {
    baris.push("Belum ada majelis di SK: usulan memakai susunan yang terpakai tahun ini dan papan memberi tanda \"belum memakai SK\".");
    return baris;
  }
  baris.push(
    `Penetapan Majelis Hakim menyebut: Memperhatikan Surat Keputusan Ketua Nomor ${sk.nomor || "(nomor belum diisi)"}` +
      `${sk.tanggal ? ` tanggal ${sk.tanggal}` : ""}${sk.berlaku && sk.berlaku !== sk.tanggal ? `, berlaku mulai ${sk.berlaku}` : ""}.`
  );
  for (const m of [...aktif].sort((a, b) => a.majelisKode.localeCompare(b.majelisKode))) {
    const [ketua, ...anggota] = m.hakimKode;
    const pp = barisPanitera(m);
    baris.push(
      `Majelis ${m.majelisKode} (sidang hari ${m.namaHari}): ketua ${sebutHakim(ketua, hakim)}` +
        `${anggota.length ? `; anggota ${anggota.map((k) => sebutHakim(k, hakim)).join(", ")}` : ""}.`
    );
    baris.push(
      pp.length
        ? `  PPP dipilih dari pendamping majelis ini: ${pp.map((p) => sebutPanitera(p, panitera)).join(", ")} - yang paling ringan bebannya didahulukan.`
        : "  PPP: belum ada pendamping terikat, usulan memakai giliran beban semua panitera."
    );
    baris.push(`  PHS jatuh pada hari ${m.namaHari}, ditandatangani ketua majelis (${ketua}).`);
  }
  baris.push("Susunan di luar SK tetap dapat dipilih manual di papan, bertanda \"di luar SK\" dan tanpa kode majelis.");
  return baris;
}

/** Badan POST simpan satu majelis - bentuk yang sama dengan yang diterima rute sejak 0044/0045. */
export function badanSimpan(m: DrafMajelis) {
  const kodeAda = new Set([...m.hakimKode, ...m.paniteraKode]);
  return {
    majelisKode: m.majelisKode,
    hari: m.hari,
    paniteraKode: m.paniteraKode.join(","),
    hakimKode: m.hakimKode.join(","),
    paniteraId: barisPanitera(m).map((p) => `${p.kode}=${p.id}`).join(","),
    akunId: (m.akun ?? []).filter((a) => kodeAda.has(a.kode)).map((a) => `${a.kode}=${a.akunId}`).join(","),
    skNomor: m.skIkutBawaan ? "" : m.skNomor,
    skTanggal: m.skIkutBawaan ? "" : m.skTanggal,
    keterangan: m.keterangan,
  };
}
