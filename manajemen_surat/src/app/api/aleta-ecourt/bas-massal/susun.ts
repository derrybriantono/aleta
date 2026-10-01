/**
 * ============================================================================
 * BAS MASSAL - DAFTAR SIDANG SATU TANGGAL, STATUS BAS, DAN USULAN BLANGKONYA
 * ============================================================================
 *
 * Perbaikan 30 Sep 2026 sore, butir U4 (agen M): panitera sidang / panitera
 * pengganti mendapat pekerjaan massal yang setara "Putusan massal" hakim dan
 * "Relaas massal" juru sita. Fungsi di berkas ini MURNI - tanpa jaringan,
 * tanpa basis data - supaya aturannya diuji langsung.
 *
 * Yang disusun untuk tiap perkara yang bersidang pada tanggal itu:
 *
 *   - BAS di SIPP     adaBas pada baris jadwal (edoc_bas sidang itu terunggah)
 *   - saksi diajukan  saksiPihak1/2 dan namanya - belum tentu sudah diperiksa
 *   - lembar ALETA    lembar BAS yang diketik di Alat Bantu Tulis BAS portal
 *   - kehadiran       dihadiri_oleh SIPP (1 semua pihak, 2 pihak pertama saja,
 *                     3 pihak kedua saja, 4 tidak ada yang hadir)
 *   - blangko         pilihan blangko BAS dari set yang cocok dengan jenis
 *                     perkaranya (pohon-blangko.ts), pada jenjang "BAS <N>"
 *                     yang N-nya urutan sidang itu
 *
 * ============================================================================
 * USULAN BLANGKO HANYA BILA KEHADIRANNYA COCOK - SELEBIHNYA DIPILIH ORANG
 * ============================================================================
 *
 * Nama blangko BAS menyebut keadaannya ("BAS 2 P Hadir & T Tidak Hadir Pokok
 * Perkara - Putusan Verstek"). Usulan hanya diberikan bila keadaan di nama
 * blangko COCOK dengan kehadiran yang tercatat di SIPP. Kehadiran yang belum
 * dicatat, atau nama yang tidak menyebut kehadiran, tidak ditebak: seluruh
 * pilihan pada jenjang itu tetap ditawarkan, tanpa satu pun yang terpilih.
 *
 * Tidak ada yang ditulis ke mana pun oleh apa pun di sini.
 */
import { namaAdaDi } from "@/lib/perkara-sendiri";
import { setUntukPerkara } from "@/lib/pohon-blangko";

/** Bagian baris jadwal bot (SidangBaris) yang dipakai BAS massal. Semua opsional - bot lama. */
export type BarisSidangBas = {
  sidangId?: unknown;
  perkaraId?: unknown;
  nomorPerkara?: unknown;
  jenisPerkara?: unknown;
  tanggalSidang?: unknown;
  jamSidang?: unknown;
  agenda?: unknown;
  ruangan?: unknown;
  ditunda?: unknown;
  sudahPutus?: unknown;
  urutanSidang?: unknown;
  dihadiriOleh?: unknown;
  adaBas?: unknown;
  paniteraNama?: unknown;
  majelisNama?: unknown;
  saksiPihak1?: unknown;
  saksiPihak2?: unknown;
  saksiNamaPihak1?: unknown;
  saksiNamaPihak2?: unknown;
  panggilan?: { tergugatPernahHadir?: unknown } | null;
};

/** Satu blangko dari katalog bot (blangko.katalog) - bentuk BlangkoItem. */
export type BlangkoKatalog = {
  berkas?: unknown;
  basKe?: unknown;
  basVarian?: unknown;
  keadaan?: unknown;
  tindakan?: unknown;
  judul?: unknown;
};

/** Katalog satu folder, sudah dibaca: terbaca false = bot tidak menjawab / folder tidak ada. */
export type KatalogFolder = { terbaca: boolean; sebab: string; blangko: BlangkoKatalog[] };

export type KecocokanKehadiran = "cocok" | "bertentangan" | "tidak-diketahui";

export type PilihanBlangkoBas = {
  folder: string;
  berkas: string;
  setId: string;
  setNama: string;
  basKe: number;
  label: string;
  kehadiran: KecocokanKehadiran;
};

export type RingkasLembar = { jumlah: number; selesai: number; draf: number };

export type BarisBasMassal = {
  sidangId: string;
  perkaraId: string;
  nomorPerkara: string;
  jenisPerkara: string;
  tanggalSidang: string;
  jamSidang: string;
  agenda: string;
  ruangan: string;
  ditunda: boolean;
  sudahPutus: boolean;
  /** 0 = bot tidak mengirim urutan sidang. */
  urutanSidang: number;
  dihadiriOleh: number | null;
  kehadiran: string;
  /** null = bot lama tidak mengirim ruasnya (BUKAN "belum ada"). */
  basSipp: boolean | null;
  paniteraNama: string;
  majelisNama: string;
  /**
   * Pemilik kerja BAS = panitera pengganti sidang itu (KONTRAK K4, perbaikan
   * 1 Okt). id = kunci nama (penggunaKunci) - bot jadwal tidak mengirim kode
   * PP, jadwal SIPP hanya menyimpan namanya. Kosong bila PP belum ditunjuk.
   */
  pengguna: { id: string; nama: string };
  milikSaya: boolean;
  saksi: { pihak1: number; pihak2: number; nama1: string[]; nama2: string[] };
  /** null = lembar ALETA tidak terbaca. */
  lembar: RingkasLembar | null;
  blangko: { usulan: PilihanBlangkoBas | null; pilihan: PilihanBlangkoBas[]; sebab: string };
};

/**
 * Kunci pengelompokan satu nama petugas: huruf kecil, gelar sesudah koma dan
 * sebutan Drs./H./Hj./Ir./Prof. dibuang, tanpa tanda baca - "Siti Aminah,
 * S.H." dan "Siti Aminah" satu kelompok. SAMA dengan basmassalKunciPengguna di
 * ekstensi-sipp/basmassal.js (dijaga ekstensi-massal-1okt.test.ts).
 */
export function penggunaKunci(nama: string): string {
  return String(nama || "")
    .split(",")[0]
    .toLowerCase()
    .replace(/\b(?:drs?|dra|hj?|ir|prof)\b\.?/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Batas pilihan blangko per perkara - daftar yang lebih panjang berhenti dibaca. */
export const BATAS_PILIHAN_BLANGKO = 12;

const teks = (x: unknown) => String(x ?? "").trim();
const angka = (x: unknown) => {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
};
const daftarTeks = (x: unknown) => (Array.isArray(x) ? x.map(teks).filter(Boolean) : []);

/** Sandi dihadiri_oleh SIPP -> kalimat (borang jadwal_sidang_p_edit.php). */
export const SEBUTAN_KEHADIRAN: Record<number, string> = {
  1: "semua pihak hadir",
  2: "hanya pihak pertama hadir",
  3: "hanya pihak kedua hadir",
  4: "tidak ada pihak hadir",
};

export function kalimatKehadiran(dihadiriOleh: number | null): string {
  return dihadiriOleh && SEBUTAN_KEHADIRAN[dihadiriOleh] ? SEBUTAN_KEHADIRAN[dihadiriOleh] : "kehadiran belum dicatat di SIPP";
}

/**
 * Keadaan kehadiran yang disebut nama blangko: { p, t } masing-masing
 * true (hadir), false (tidak hadir), atau null (tidak disebut).
 *
 *   "P Hadir & T Tidak Hadir Pokok Perkara"  -> { p: true,  t: false }
 *   "P & T Hadir"                            -> { p: true,  t: true }
 *   "P & T Tidak Hadir"                      -> { p: false, t: false }
 *   "Pembuktian"                             -> { p: null,  t: null }
 */
export function kehadiranDiNama(keadaan: string): { p: boolean | null; t: boolean | null } {
  const k = ` ${String(keadaan || "").toLowerCase().replace(/\s+/g, " ")} `;
  let p: boolean | null = null;
  let t: boolean | null = null;
  // Bentuk berdua lebih dulu: "p & t tidak hadir" / "p dan t hadir".
  const berdua = k.match(/\sp\s*(?:&|dan)\s*t\s+(tidak\s+)?hadir\b/);
  if (berdua) {
    const hadir = !berdua[1];
    p = hadir;
    t = hadir;
  }
  const satuP = k.match(/\sp\s+(tidak\s+)?hadir\b/);
  if (satuP) p = !satuP[1];
  const satuT = k.match(/\st\s+(tidak\s+)?hadir\b/);
  if (satuT) t = !satuT[1];
  return { p, t };
}

/** Kehadiran yang tercatat di SIPP -> { p, t }; null bila belum dicatat. */
function kehadiranSipp(dihadiriOleh: number | null): { p: boolean; t: boolean } | null {
  if (dihadiriOleh === 1) return { p: true, t: true };
  if (dihadiriOleh === 2) return { p: true, t: false };
  if (dihadiriOleh === 3) return { p: false, t: true };
  if (dihadiriOleh === 4) return { p: false, t: false };
  return null;
}

export function cocokKehadiran(keadaan: string, dihadiriOleh: number | null): KecocokanKehadiran {
  const sipp = kehadiranSipp(dihadiriOleh);
  const nama = kehadiranDiNama(keadaan);
  if (!sipp || (nama.p === null && nama.t === null)) return "tidak-diketahui";
  if ((nama.p !== null && nama.p !== sipp.p) || (nama.t !== null && nama.t !== sipp.t)) return "bertentangan";
  return "cocok";
}

/** Nama terbaca satu blangko di dalam jenjangnya (setara labelBlangko pohon-blangko.ts). */
function labelBlangkoBas(item: BlangkoKatalog): string {
  const gabung = [teks(item.keadaan), teks(item.tindakan)].filter(Boolean).join(" - ");
  return gabung || teks(item.judul) || teks(item.berkas);
}

/** Set BAS yang cocok dengan jenis perkara - dari pohon-blangko.ts, satu-satunya tempat set ditulis. */
export function setBasUntukPerkara(jenisPerkara: string) {
  return setUntukPerkara(jenisPerkara).filter((s) => s.jenis === "bas" && s.cocok);
}

/**
 * Tergugat/termohon hadir pada sidang ini atau pernah hadir sebelumnya ->
 * set contra lebih dahulu; selain itu verstek lebih dahulu. Hanya URUTAN -
 * kedua set tetap ditawarkan.
 */
function contraLebihDulu(dihadiriOleh: number | null, tergugatPernahHadir: unknown): boolean {
  if (dihadiriOleh === 1 || dihadiriOleh === 3) return true;
  return tergugatPernahHadir === true;
}

const PERINGKAT_KEHADIRAN: Record<KecocokanKehadiran, number> = { cocok: 0, "tidak-diketahui": 1, bertentangan: 2 };

/**
 * Pilihan blangko BAS untuk satu sidang.
 *
 * Kandidat = blangko set yang cocok dengan jenis perkaranya yang jenjangnya
 * "BAS <urutan sidang>". Urutan: set yang lebih mungkin (contra/verstek
 * menurut kehadiran tergugat), lalu kecocokan kehadiran, lalu nama berkas.
 * Usulan = kandidat pertama BILA kehadirannya "cocok"; selain itu null.
 */
export function pilihBlangkoBas(masukan: {
  jenisPerkara: string;
  urutanSidang: number;
  dihadiriOleh: number | null;
  tergugatPernahHadir?: unknown;
  katalog: Record<string, KatalogFolder | undefined>;
}): { usulan: PilihanBlangkoBas | null; pilihan: PilihanBlangkoBas[]; sebab: string } {
  const set = setBasUntukPerkara(masukan.jenisPerkara);
  if (set.length === 0) {
    return {
      usulan: null,
      pilihan: [],
      sebab: `Jenis perkara "${masukan.jenisPerkara || "tidak terbaca"}" belum punya set blangko BAS - pakai Alat Bantu Tulis BAS di portal.`,
    };
  }
  if (!(masukan.urutanSidang > 0)) {
    return { usulan: null, pilihan: [], sebab: "Urutan sidang tidak dikirim server - blangko BAS tidak dapat dipilihkan." };
  }
  const contra = contraLebihDulu(masukan.dihadiriOleh, masukan.tergugatPernahHadir);
  const urutanSet = [...set].sort((a, b) => {
    const nilai = (id: string) => (id === "bas-contra" ? (contra ? 0 : 1) : id === "bas-verstek" ? (contra ? 1 : 0) : 2);
    return nilai(a.id) - nilai(b.id);
  });

  const tidakTerbaca: string[] = [];
  const kandidat: Array<PilihanBlangkoBas & { urutSet: number }> = [];
  urutanSet.forEach((s, urutSet) => {
    const k = masukan.katalog[s.folder];
    if (!k || !k.terbaca) {
      tidakTerbaca.push(`${s.nama}: ${k?.sebab || "katalog tidak terbaca"}`);
      return;
    }
    for (const item of k.blangko) {
      if (angka(item.basKe) !== masukan.urutanSidang) continue;
      const berkas = teks(item.berkas);
      if (!berkas) continue;
      kandidat.push({
        folder: s.folder,
        berkas,
        setId: s.id,
        setNama: s.nama,
        basKe: angka(item.basKe),
        label: labelBlangkoBas(item),
        kehadiran: cocokKehadiran(teks(item.keadaan), masukan.dihadiriOleh),
        urutSet,
      });
    }
  });

  kandidat.sort(
    (a, b) =>
      a.urutSet - b.urutSet ||
      PERINGKAT_KEHADIRAN[a.kehadiran] - PERINGKAT_KEHADIRAN[b.kehadiran] ||
      a.berkas.localeCompare(b.berkas, "id", { numeric: true })
  );
  const pilihan = kandidat.slice(0, BATAS_PILIHAN_BLANGKO).map(({ urutSet: _u, ...sisa }) => sisa);

  if (pilihan.length === 0) {
    const sebab =
      tidakTerbaca.length === urutanSet.length
        ? `Katalog blangko tidak terbaca (${tidakTerbaca.join("; ")}).`
        : `Tidak ada blangko "BAS ${masukan.urutanSidang}" di ${urutanSet.map((s) => s.nama).join(" / ")} - pakai Alat Bantu Tulis BAS di portal.`;
    return { usulan: null, pilihan, sebab };
  }
  const usulan = pilihan[0].kehadiran === "cocok" ? pilihan[0] : null;
  const sebab = usulan
    ? ""
    : masukan.dihadiriOleh === null
      ? "Kehadiran sidang ini belum dicatat di SIPP - pilih blangkonya sendiri."
      : "Tidak ada blangko yang keadaannya jelas cocok dengan kehadiran - pilih blangkonya sendiri.";
  return { usulan, pilihan, sebab };
}

/** Ringkasan lembar ALETA satu perkara dari baris aleta_bas_lembar. */
export function ringkasLembar(baris: Array<{ keadaan?: unknown }>): RingkasLembar {
  const selesai = baris.filter((b) => teks(b.keadaan) === "selesai").length;
  return { jumlah: baris.length, selesai, draf: baris.length - selesai };
}

/**
 * Satu baris per PERKARA (baris jadwal ganda pada tanggal yang sama - sidang
 * ditunda lalu dijadwalkan ulang - diambil yang pertama), disaring menurut
 * panitera pengganti bila `saringan` "saya".
 */
export function susunBarisBasMassal(
  sidang: BarisSidangBas[],
  opsi: {
    namaAkun: string;
    saringan: "saya" | "semua";
    katalog: Record<string, KatalogFolder | undefined>;
    lembar: Record<string, RingkasLembar | null | undefined>;
  }
): { baris: BarisBasMassal[]; jumlahSemua: number; jumlahSaya: number } {
  const sudah = new Set<string>();
  const semua: BarisBasMassal[] = [];
  for (const s of Array.isArray(sidang) ? sidang : []) {
    const nomor = teks(s?.nomorPerkara);
    if (!nomor || sudah.has(nomor)) continue;
    sudah.add(nomor);
    const perkaraId = teks(s.perkaraId);
    const dihadiriMentah = s.dihadiriOleh === null || s.dihadiriOleh === undefined ? null : angka(s.dihadiriOleh);
    const dihadiriOleh = dihadiriMentah && SEBUTAN_KEHADIRAN[dihadiriMentah] ? dihadiriMentah : null;
    const urutanSidang = angka(s.urutanSidang);
    const paniteraNama = teks(s.paniteraNama);
    const jenisPerkara = teks(s.jenisPerkara);
    semua.push({
      sidangId: teks(s.sidangId),
      perkaraId,
      nomorPerkara: nomor,
      jenisPerkara,
      tanggalSidang: teks(s.tanggalSidang).slice(0, 10),
      jamSidang: teks(s.jamSidang),
      agenda: teks(s.agenda),
      ruangan: teks(s.ruangan),
      ditunda: s.ditunda === true,
      sudahPutus: s.sudahPutus === true,
      urutanSidang,
      dihadiriOleh,
      kehadiran: kalimatKehadiran(dihadiriOleh),
      basSipp: typeof s.adaBas === "boolean" ? s.adaBas : null,
      paniteraNama,
      majelisNama: teks(s.majelisNama),
      pengguna: { id: penggunaKunci(paniteraNama), nama: paniteraNama },
      milikSaya: Boolean(opsi.namaAkun) && namaAdaDi(opsi.namaAkun, paniteraNama),
      saksi: {
        pihak1: angka(s.saksiPihak1),
        pihak2: angka(s.saksiPihak2),
        nama1: daftarTeks(s.saksiNamaPihak1),
        nama2: daftarTeks(s.saksiNamaPihak2),
      },
      lembar: perkaraId && opsi.lembar[perkaraId] !== undefined ? (opsi.lembar[perkaraId] ?? null) : null,
      blangko: pilihBlangkoBas({
        jenisPerkara,
        urutanSidang,
        dihadiriOleh,
        tergugatPernahHadir: s.panggilan?.tergugatPernahHadir,
        katalog: opsi.katalog,
      }),
    });
  }
  const jumlahSaya = semua.filter((b) => b.milikSaya).length;
  const baris = opsi.saringan === "saya" ? semua.filter((b) => b.milikSaya) : semua;
  return { baris, jumlahSemua: semua.length, jumlahSaya };
}

/** Folder katalog yang dibutuhkan baris-baris ini - tanpa ganda. */
export function folderDibutuhkan(sidang: BarisSidangBas[]): string[] {
  const hasil = new Set<string>();
  for (const s of Array.isArray(sidang) ? sidang : []) {
    for (const set of setBasUntukPerkara(teks(s?.jenisPerkara))) hasil.add(set.folder);
  }
  return [...hasil];
}
