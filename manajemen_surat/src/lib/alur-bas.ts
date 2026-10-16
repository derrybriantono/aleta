/**
 * ============================================================================
 * PETA ALUR SIDANG -> BAS (Agen R, 12 Okt 2026; paket ABT "abt-bas-alur-sidang")
 * ============================================================================
 *
 * Permintaan pengguna: "Lengkapi lagi berita acara sidang di blangko Derry dengan melihat status persidangan dan putusan,
 * buat dalam bentuk satu kesatuan foldernya (contoh: putusan verstek cerai -> BAS sidang pertama, BAS sidang lanjutan putus saksi)".
 *
 * Paket ABT menambah 13 folder di grup "Blangko Derry" (derry_briantono), satu folder per ALUR SIDANG, berisi BAS berurutan
 * [1] [2] ... Berkas di folder alur adalah SALINAN BAS yang sudah ada (diurutkan per alur) kecuali dua turunan; isi hukum tidak dikarang.
 *
 * Berkas ini adalah PETA yang sama dengan isi paket (dibangkitkan dari spec paket; dijaga alur-bas.test.ts) dan penebak alur
 * dari keadaan sidang. Tidak mengubah pemilihan blangko BAS massal yang sudah ada - hanya menambah keterangan alur pada baris.
 * Frekuensi alur sungguhan (SIPP PA Donggala, 10.078 perkara berstatus): D:/aleta-dev/kerja/abt-bas-alur-sidang/hasil/alur-bas-frekuensi.md.
 */

/** Nomor sidang yang dilayani langkah; 0 = sidang terakhir (putusan / penetapan) - nomornya tidak tetap. */
export type PeranLangkahAlurBas = "pertama" | "lanjutan" | "terakhir" | "varian";

export type LangkahAlurBas = {
  /** Awalan di nama berkas: "[1]", "[2a]" ... tanpa kurung. */
  kode: string;
  /** Nama berkas di folder alur (dengan .rtf). */
  berkas: string;
  ke: number;
  peran: PeranLangkahAlurBas;
  keterangan: string;
  /** derry = grup Derry sekarang; derry-lama = (C3) Derry Kumpulan BAS; satker = blangko standar satker; standar = pustaka standar ABT (PA lain). */
  asal: "derry" | "derry-lama" | "satker" | "standar";
  /** true = turunan (ditambah #5404# #8562# [#8563#]) dari berkas sumbernya. */
  turunan: boolean;
};

export type AlurBas = {
  id: string;
  nomor: number;
  nama: string;
  /** Folder di ABT, relatif _blangko_abt - sama dengan abt_menu.direktori di bawah derry_briantono. */
  folder: string;
  menuId: number;
  /** Jenis perkara SIPP (jenis_perkara_id) yang melihat folder ini di ABT. */
  jenisMin: number;
  jenisMaks: number;
  langkah: LangkahAlurBas[];
};

export function alurBasMenurutId(id: string): AlurBas | undefined {
  return ALUR_BAS.find((a) => a.id === id);
}

export type GrupJenisAlur = "cerai-gugat" | "cerai-talak" | "itsbat" | "dispensasi" | "asal-usul" | "permohonan-lain" | "";

export function grupJenisAlur(jenisPerkara: unknown): GrupJenisAlur {
  const j = String(jenisPerkara ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  if (!j) return "";
  if (j.includes("cerai gugat")) return "cerai-gugat";
  if (j.includes("cerai talak")) return "cerai-talak";
  if (j.includes("istbat") || j.includes("itsbat") || j.includes("pengesahan perkawinan")) return "itsbat";
  if (j.includes("dispensasi")) return "dispensasi";
  if (j.includes("asal usul") || j.includes("asal-usul")) return "asal-usul";
  if (j.includes("perwalian") || j.includes("wali") || j.includes("ahli waris") || j.includes("p3hp") || j.includes("lain-lain")) return "permohonan-lain";
  return "";
}

export type MasukanAlurBas = {
  jenisPerkara: string;
  /** Urutan sidang ini (1 = sidang pertama); 0/tidak ada = tidak diketahui. */
  urutanSidang: number;
  /** Sandi dihadiri_oleh SIPP: 1 semua, 2 pihak pertama saja, 3 pihak kedua saja, 4 tidak ada. */
  dihadiriOleh: number | null;
  agenda?: string;
  /** Tergugat/Termohon pernah hadir pada sidang sebelumnya (bot: panggilan.tergugatPernahHadir). */
  tergugatPernahHadir?: unknown;
  /** Sidang ikrar talak (bukan sidang pemeriksaan). */
  sidangIkrarTalak?: boolean;
  /** Hasil akhir bila sudah diketahui (jarang pada BAS massal - sidang masih berjalan). */
  akhir?: "gugur" | "cabut" | "no" | null;
};

export type LangkahLainAlur = { alur: AlurBas; langkah: LangkahAlurBas };

export type HasilAlurBas = {
  alur: AlurBas | null;
  /** Langkah yang diusulkan (null = alur dikenal tetapi langkahnya belum ada contoh). */
  langkah: LangkahAlurBas | null;
  /** Langkah lain yang mungkin pada alur yang sama (mis. varian 3/4 saksi) - urut. */
  alternatif: LangkahAlurBas[];
  /**
   * Q3 16 Okt: langkah di ALUR LAIN yang juga mungkin (mis. verstek sidang 2 bisa ternyata ALUR 03 [2]; kontradiktoir 1-4 sidang bisa
   * ternyata lisan ALUR 05; semua cerai bisa berujung cabut/NO/gugur). Dipakai BAS massal sebagai pilihan tambahan.
   */
  lainAlur?: LangkahLainAlur[];
  /** true = alur ditebak dari urutan sidang dan kehadiran; ujungnya baru diketahui sesudah sidang. */
  perkiraan: boolean;
  sebab: string;
};

const TIDAK_DIKENAL: HasilAlurBas = { alur: null, langkah: null, alternatif: [], perkiraan: false, sebab: "Jenis perkara ini belum punya folder alur BAS." };

function ambil(alurId: string, kode: string): { alur: AlurBas; langkah: LangkahAlurBas } | null {
  const alur = alurBasMenurutId(alurId);
  const langkah = alur?.langkah.find((l) => l.kode === kode);
  return alur && langkah ? { alur, langkah } : null;
}

function hasil(
  alurId: string,
  kode: string,
  perkiraan: boolean,
  sebab: string,
  alternatifKode: string[] = [],
  /** Q3 16 Okt: [alurId, kode] di alur lain - yang tidak ada di peta dilewati. */
  lain: Array<[string, string]> = []
): HasilAlurBas {
  const utama = ambil(alurId, kode);
  if (!utama) return { ...TIDAK_DIKENAL, sebab: `Peta alur BAS rusak: ${alurId}[${kode}] tidak ada.` };
  const alternatif = alternatifKode
    .map((k) => alurBasMenurutId(alurId)?.langkah.find((l) => l.kode === k))
    .filter((l): l is LangkahAlurBas => Boolean(l));
  const lainAlur: LangkahLainAlur[] = [];
  const lihat = new Set<string>([`${alurId}|${kode}`]);
  for (const [a, k] of lain) {
    if (lihat.has(`${a}|${k}`)) continue;
    lihat.add(`${a}|${k}`);
    const x = ambil(a, k);
    if (x) lainAlur.push(x);
  }
  return { alur: utama.alur, langkah: utama.langkah, alternatif, ...(lainAlur.length ? { lainAlur } : {}), perkiraan, sebab };
}

const AGENDA_TERTULIS = /tertulis|e-?litigasi|court calendar|replik|duplik|rekonvensi/i;
const AGENDA_LISAN = /lisan/i;
const AGENDA_AKHIR = /putus|musyawarah|penetapan|bukti|pembuktian|saksi/i;

/**
 * Q3 16 Okt: langkah ALUR 04 (kontradiktoir tertulis) dari AGENDA sidang, bila agenda menyebutnya; selain itu dari urutan sidang.
 * Urutan kata kunci SAMA dengan penyusun peta perkara L3 (peta.py langkah_kt): mediasi|laporan|pokok -> [2]; jawab -> [3]; replik -> [4];
 * duplik rekonvensi -> [5a]; duplik -> [5]; kesimpulan -> [8]; musyawarah|putusan -> [9]; pembuktian/saksi Tergugat -> [7]; pembuktian/saksi
 * (Penggugat, atau tak disebut) -> [6]. Sidang pertama selalu [1] dan sidang kedua [2] (laporan mediasi). Varian saksi (6a-c, 7a-b)
 * selalu ikut sebagai alternatif karena jumlah saksi tidak ada di SIPP.
 */
export function langkahAlur04(dilihat: number, agendaMentah: string): { kode: string; alternatif: string[]; dariAgenda: boolean } {
  const ag = String(agendaMentah ?? "").toLowerCase();
  const urutan = dilihat >= 9 ? "9" : String(Math.max(1, dilihat));
  const dariUrutan = () => ({
    kode: urutan,
    alternatif: urutan === "5" ? ["5a"] : urutan === "6" ? ["6a", "6b", "6c"] : urutan === "7" ? ["7a", "7b"] : [],
    dariAgenda: false,
  });
  if (dilihat <= 1) return { kode: "1", alternatif: [], dariAgenda: false };
  if (dilihat === 2) return { kode: "2", alternatif: [], dariAgenda: false };
  if (!ag.trim()) return dariUrutan();
  if (/mediasi|laporan|pokok/.test(ag)) return { kode: "2", alternatif: [], dariAgenda: true };
  if (/jawab/.test(ag)) return { kode: "3", alternatif: [], dariAgenda: true };
  if (/replik/.test(ag)) return { kode: "4", alternatif: [], dariAgenda: true };
  if (/duplik\s+rekonvensi/.test(ag)) return { kode: "5a", alternatif: ["5"], dariAgenda: true };
  if (/duplik/.test(ag)) return { kode: "5", alternatif: ["5a"], dariAgenda: true };
  if (/kesimpulan/.test(ag)) return { kode: "8", alternatif: [], dariAgenda: true };
  if (/musyawarah|putusan/.test(ag)) return { kode: "9", alternatif: [], dariAgenda: true };
  if (/bukti|pembuktian|saksi/.test(ag)) {
    const sisiT = /tergugat|termohon/.test(ag);
    const sisiP = /penggugat|pemohon/.test(ag);
    if (sisiT && !sisiP) return { kode: "7", alternatif: ["7a", "7b"], dariAgenda: true };
    if (sisiP && !sisiT) return { kode: "6", alternatif: ["6a", "6b", "6c"], dariAgenda: true };
    // Sisi tak disebut: pembuktian pertama = P. Sesudah sidang ke-6 lebih mungkin T; sisi lainnya ikut ditawarkan.
    return dilihat >= 7
      ? { kode: "7", alternatif: ["7a", "7b", "6"], dariAgenda: true }
      : { kode: "6", alternatif: ["6a", "6b", "6c", "7"], dariAgenda: true };
  }
  return dariUrutan();
}

/**
 * Q3 16 Okt: akhir perkara cerai yang MUNGKIN tetapi belum diketahui saat BAS massal (cabut, tidak dapat diterima, gugur) ditawarkan
 * sebagai pilihan - dulu hanya terjangkau bila `akhir` diketahui (jarang). Mengembalikan [alurId, kode] di luar alur utama.
 * `adaMediasi` = T pernah hadir sehingga cabut sesudah mediasi (C2) juga mungkin.
 */
function akhirLain(grup: GrupJenisAlur, dilihat: number, adaMediasi: boolean, utamaAlur: string): Array<[string, string]> {
  if (grup !== "cerai-gugat" && grup !== "cerai-talak") return [];
  const lain: Array<[string, string]> = [];
  if (utamaAlur !== "alur-08") {
    lain.push(["alur-08", dilihat <= 1 ? "A" : "B"]);
    if (adaMediasi && dilihat >= 2) lain.push(["alur-08", "C2"]);
  }
  // NO: sidang sebelum yang memutus memakai [1] (tunda panggil T, alamat tidak jelas), sidang yang memutus [2].
  if (utamaAlur !== "alur-09") {
    lain.push(["alur-09", "1"]);
    if (dilihat >= 2) lain.push(["alur-09", "2"]);
  }
  if (utamaAlur !== "alur-07" && dilihat >= 2) lain.push(["alur-07", "3"]);
  return lain;
}

/**
 * ALUR SIDANG sebuah perkara menurut keadaan sidang ini, dan BAS langkah berikut dari folder alurnya.
 *
 * Dasar: frekuensi alur sungguhan di SIPP PA Donggala (hasil/alur-final.md, 10.078 perkara berstatus): verstek 2 sidang
 * (tunda panggil T lalu saksi dan putus) paling umum; 1 sidang untuk itsbat/dispensasi; kontradiktoir 5-9 sidang;
 * T hadir lalu tidak hadir; gugur; cabut; NO. Hasil akhir sebuah perkara BARU diketahui sesudah sidang terakhir, jadi
 * kecuali `akhir` diketahui, usulan ini PERKIRAAN (perkiraan = true) - petugas tetap memilih.
 *
 * Murni: tanpa jaringan dan tanpa basis data.
 */
export function tentukanAlurBas(m: MasukanAlurBas): HasilAlurBas {
  const grup = grupJenisAlur(m.jenisPerkara);
  const n = Number.isFinite(m.urutanSidang) && m.urutanSidang > 0 ? Math.floor(m.urutanSidang) : 0;
  const agenda = String(m.agenda ?? "");
  const h = m.dihadiriOleh;
  if (!grup) return TIDAK_DIKENAL;

  if (grup === "itsbat") {
    if (n >= 2) return hasil("alur-11", "1", true, "Itsbat nikah sidang ke-" + n + ": BAS lanjutan itsbat belum ada contoh - folder alur hanya memuat BAS 1 sidang.", ["1a"]);
    return hasil("alur-11", "1", false, "Itsbat nikah: BAS 1 sidang (pembuktian dan penetapan).", ["1a"]);
  }
  if (grup === "dispensasi") return hasil("alur-12", "1", n >= 2, "Dispensasi kawin: pilih menurut anak (perempuan/laki-laki) dan keadaannya.", ["1a", "2", "2a"]);
  if (grup === "asal-usul") return hasil("alur-13", "1", n >= 2, "Asal usul anak: BAS 1 sidang (pembuktian dan penetapan).");
  if (grup === "permohonan-lain") {
    return {
      ...TIDAK_DIKENAL,
      sebab: "Perwalian / wali adhal / ahli waris / pengangkatan anak: belum ada contoh BAS di blangko Derry (pustaka standar ABT memakai nama PA lain) - pakai Alat Bantu Tulis BAS.",
    };
  }

  // --- Cerai gugat / cerai talak ---
  if (grup === "cerai-talak" && m.sidangIkrarTalak) {
    const kode = h === 1 ? "2" : h === 3 ? "3" : "1";
    return hasil("alur-10", kode, h === null || h === 4, "Sidang ikrar talak.", ["1", "2", "2a", "3"].filter((k) => k !== kode));
  }
  if (m.akhir === "gugur") return hasil("alur-07", n >= 2 ? "3" : "1", false, "Cerai gugur.", ["1", "2", "3"].filter((k) => k !== (n >= 2 ? "3" : "1")));
  if (m.akhir === "cabut") return hasil("alur-08", n >= 2 ? "B" : "A", false, "Cerai dicabut.", ["A", "B", "C1", "C2"].filter((k) => k !== (n >= 2 ? "B" : "A")));
  if (m.akhir === "no") return hasil("alur-09", n >= 2 ? "2" : "1", false, "Cerai tidak dapat diterima.", ["1", "2"].filter((k) => k !== (n >= 2 ? "2" : "1")));

  const tHadirKini = h === 1 || h === 3;
  const tPernah = m.tergugatPernahHadir === true || tHadirKini;
  const semuaTidakHadir = h === 4;
  const dilihat = n === 0 ? 1 : n;

  if (semuaTidakHadir && !tPernah) {
    // P dan T tidak hadir: sidang pertama tunda panggil; kedua kalinya putus gugur (data: 'XX' = 2 sidang).
    return dilihat <= 1
      ? hasil("alur-07", "1", true, "P dan T tidak hadir: tunda panggil P dan T.", ["3"], akhirLain(grup, dilihat, false, "alur-07"))
      : hasil("alur-07", "3", true, "P dan T tidak hadir lagi: putus gugur (atau tunda panggil lagi bila Majelis memanggil sekali lagi).", ["2"], akhirLain(grup, dilihat, false, "alur-07"));
  }

  if (!tPernah) {
    // Verstek: T tidak pernah hadir.
    // Q3 16 Okt: ALUR 01 (putus verstek di sidang pertama; 1a Cerai Gugat / 1b Cerai Talak) kini ikut ditawarkan; varian saksi lengkap.
    if (dilihat <= 1) {
      return hasil("alur-02", "1", true, "T tidak hadir: tunda panggil T. (Putus di sidang pertama: folder alur 01.)", ["1a"], [
        ["alur-01", grup === "cerai-talak" ? "1b" : "1a"],
        ...akhirLain(grup, dilihat, false, "alur-02"),
      ]);
    }
    if (dilihat === 2) {
      // Diukur atas 656 sidang ke-2 verstek PA Donggala 2024-2026: 81% tuntas di sidang itu (ALUR 02 [2]) walau agendanya masih
      // "panggil tergugat" (agenda sidang ke-2 ditulis sewaktu menunda sidang 1) - maka agenda tunda TIDAK menggeser usulan; ALUR 03 [2] hanya ditawarkan.
      return hasil("alur-02", "2", true, "Sidang kedua, T tidak hadir: pembuktian saksi dan putusan verstek (2 saksi; 3/4/5 saksi tersedia). Bila T dipanggil lagi: alur 03 [2].", ["2a", "2b", "2c"], [
        ["alur-03", "2"],
        ...akhirLain(grup, dilihat, false, "alur-02"),
      ]);
    }
    return AGENDA_AKHIR.test(agenda)
      ? hasil("alur-03", "3", true, `Sidang ke-${dilihat}, T tidak hadir: saksi dan putusan verstek.`, ["3a", "3b", "3c", "2"], akhirLain(grup, dilihat, false, "alur-03"))
      : hasil("alur-03", "2", true, `Sidang ke-${dilihat}, T tidak hadir: tunda panggil T lagi.`, ["3", "3a", "3b", "3c"], akhirLain(grup, dilihat, false, "alur-03"));
  }

  if (tHadirKini) {
    // Kontradiktoir: jawab-menjawab tertulis (PERMA 7/2022, e-Litigasi) atau lisan.
    const lisan = AGENDA_LISAN.test(agenda) && !AGENDA_TERTULIS.test(agenda);
    if (lisan) {
      const kode = dilihat <= 1 ? "1" : dilihat === 2 ? "2" : dilihat === 3 ? "3" : "4";
      return hasil("alur-05", kode, true, "P dan T hadir, jawab-menjawab lisan.", kode === "3" ? ["3a"] : [], akhirLain(grup, dilihat, true, "alur-05"));
    }
    // Q3 16 Okt: langkah ALUR 04 ditebak dari AGENDA lebih dulu (peta L3: urutan saja meleset 10-40% per langkah), baru dari urutan sidang.
    const l4 = langkahAlur04(dilihat, agenda);
    // ALUR 05 (lisan) ditawarkan untuk sidang awal yang agendanya tak menyebut penanda tertulis (14 CG + 12 CT lisan, <= 5 sidang).
    const lisanLain: Array<[string, string]> =
      dilihat <= 4 && !AGENDA_TERTULIS.test(agenda)
        ? (dilihat <= 1 ? ["1"] : dilihat === 2 ? ["2"] : dilihat === 3 ? ["3", "3a"] : ["4", "3"]).map((k): [string, string] => ["alur-05", k])
        : [];
    // Sidang mediasi (T pertama kali hadir) bisa jatuh di sidang ke-2..4 bila sidang sebelumnya tunda panggil: ALUR 06 [1] (T hadir mediasi lalu tidak hadir).
    const mediasiLain: Array<[string, string]> = dilihat >= 2 && dilihat <= 4 ? [["alur-06", "1"]] : [];
    return hasil("alur-04", l4.kode, true, "P dan T hadir: kontradiktoir (sidang ke-" + dilihat + ")" + (l4.dariAgenda ? ", langkah dibaca dari agenda." : "."), l4.alternatif, [
      ...lisanLain,
      ...mediasiLain,
      ...akhirLain(grup, dilihat, true, "alur-04"),
    ]);
  }

  // T pernah hadir tetapi sidang ini tidak hadir (mis. sesudah mediasi): "verstek setelah mediasi" sebutan pengguna, putusannya
  // kontradiktoir (T pernah hadir) - BAS [3] ALUR 06 sejak paket abt-blangko-derry-rapi beramar tanpa "verstek".
  // Semua pihak tidak hadir sesudah T pernah hadir: sidang tunda panggil P & T (ALUR 04 [T] / ALUR 07 [1]-[2]) menggantikan langkah ALUR 06.
  const tidakHadirLagi: Array<[string, string]> = h === 4 ? [["alur-04", "T"], ["alur-07", dilihat <= 1 ? "1" : "2"]] : [];
  return dilihat <= 2
    ? hasil("alur-06", "2", true, "T pernah hadir (mediasi) tetapi sekarang tidak hadir: laporan mediasi, tunda panggil T.", ["3"], [...tidakHadirLagi, ...akhirLain(grup, dilihat, true, "alur-06")])
    : hasil("alur-06", "3", true, `T pernah hadir, sekarang tidak hadir (sidang ke-${dilihat}): saksi dan putusan tanpa hadirnya T (kontradiktoir, bukan verstek - T pernah hadir).`, ["3a", "3b", "3c", "2"], [...tidakHadirLagi, ...akhirLain(grup, dilihat, true, "alur-06")]);
}

/** Dibangkitkan dari alat/spec_alur.py paket abt-bas-alur-sidang - jangan disunting tangan. */
export const ALUR_BAS: AlurBas[] = [
  {
    "id": "alur-01",
    "nomor": 1,
    "nama": "Cerai Verstek 1 Sidang (Putus Sidang Pertama)",
    "folder": "derry_briantono/ALUR 01 Cerai Verstek 1 Sidang (Putus Sidang Pertama)",
    "menuId": 960,
    "jenisMin": 346,
    "jenisMaks": 347,
    "langkah": [
      {
        "kode": "1a",
        "berkas": "[1a] BAS 1 P Hadir & T Tidak Hadir - Putus Verstek di Sidang Pertama - Cerai Gugat.rtf",
        "ke": 1,
        "peran": "terakhir",
        "keterangan": "Cerai Gugat",
        "asal": "derry-lama",
        "turunan": false
      },
      {
        "kode": "1b",
        "berkas": "[1b] BAS 1 P Hadir & T Tidak Hadir - Putus Verstek di Sidang Pertama - Cerai Talak.rtf",
        "ke": 1,
        "peran": "terakhir",
        "keterangan": "Cerai Talak",
        "asal": "derry-lama",
        "turunan": false
      }
    ]
  },
  {
    "id": "alur-02",
    "nomor": 2,
    "nama": "Cerai Verstek 2 Sidang",
    "folder": "derry_briantono/ALUR 02 Cerai Verstek 2 Sidang",
    "menuId": 961,
    "jenisMin": 346,
    "jenisMaks": 347,
    "langkah": [
      {
        "kode": "1",
        "berkas": "[1] BAS 1 P Hadir & T Tidak Hadir - Tunda Panggil T.rtf",
        "ke": 1,
        "peran": "pertama",
        "keterangan": "",
        "asal": "derry",
        "turunan": false
      },
      {
        "kode": "1a",
        "berkas": "[1a] BAS 1 P Hadir & T Tidak Hadir - Alamat Tidak Jelas atau Luar Batas Antar.rtf",
        "ke": 1,
        "peran": "varian",
        "keterangan": "alamat Tergugat tidak jelas / luar batas antar",
        "asal": "derry",
        "turunan": false
      },
      {
        "kode": "2",
        "berkas": "[2] BAS 2 P Hadir & T Tidak Hadir - Saksi dan Putusan Verstek (2 Saksi).rtf",
        "ke": 2,
        "peran": "terakhir",
        "keterangan": "2 saksi",
        "asal": "derry",
        "turunan": false
      },
      {
        "kode": "2a",
        "berkas": "[2a] BAS 2 P Hadir & T Tidak Hadir - Saksi dan Putusan Verstek (3 Saksi).rtf",
        "ke": 2,
        "peran": "varian",
        "keterangan": "3 saksi",
        "asal": "derry",
        "turunan": false
      },
      {
        "kode": "2b",
        "berkas": "[2b] BAS 2 P Hadir & T Tidak Hadir - Saksi dan Putusan Verstek (4 Saksi).rtf",
        "ke": 2,
        "peran": "varian",
        "keterangan": "4 saksi",
        "asal": "derry",
        "turunan": false
      },
      {
        "kode": "2c",
        "berkas": "[2c] BAS 2 P Hadir & T Tidak Hadir - Saksi dan Putusan Verstek (5 Saksi).rtf",
        "ke": 2,
        "peran": "varian",
        "keterangan": "5 saksi",
        "asal": "derry",
        "turunan": false
      }
    ]
  },
  {
    "id": "alur-03",
    "nomor": 3,
    "nama": "Cerai Verstek 3 Sidang atau Lebih",
    "folder": "derry_briantono/ALUR 03 Cerai Verstek 3 Sidang atau Lebih",
    "menuId": 962,
    "jenisMin": 346,
    "jenisMaks": 347,
    "langkah": [
      {
        "kode": "1",
        "berkas": "[1] BAS 1 P Hadir & T Tidak Hadir - Tunda Panggil T.rtf",
        "ke": 1,
        "peran": "pertama",
        "keterangan": "",
        "asal": "derry",
        "turunan": false
      },
      {
        "kode": "1a",
        "berkas": "[1a] BAS 1 P Hadir & T Tidak Hadir - Alamat Tidak Jelas atau Luar Batas Antar.rtf",
        "ke": 1,
        "peran": "varian",
        "keterangan": "alamat Tergugat tidak jelas / luar batas antar",
        "asal": "derry",
        "turunan": false
      },
      {
        "kode": "2",
        "berkas": "[2] BAS Lanjutan P Hadir & T Tidak Hadir - Tunda Panggil T Lagi.rtf",
        "ke": 2,
        "peran": "lanjutan",
        "keterangan": "tunda panggil T lagi",
        "asal": "standar",
        "turunan": true
      },
      {
        "kode": "3",
        "berkas": "[3] BAS Terakhir P Hadir & T Tidak Hadir - Saksi dan Putusan Verstek (2 Saksi).rtf",
        "ke": 0,
        "peran": "terakhir",
        "keterangan": "2 saksi",
        "asal": "derry",
        "turunan": false
      },
      {
        "kode": "3a",
        "berkas": "[3a] BAS Terakhir P Hadir & T Tidak Hadir - Saksi dan Putusan Verstek (3 Saksi).rtf",
        "ke": 0,
        "peran": "varian",
        "keterangan": "3 saksi",
        "asal": "derry",
        "turunan": false
      },
      {
        "kode": "3b",
        "berkas": "[3b] BAS Terakhir P Hadir & T Tidak Hadir - Saksi dan Putusan Verstek (4 Saksi).rtf",
        "ke": 0,
        "peran": "varian",
        "keterangan": "4 saksi",
        "asal": "derry",
        "turunan": false
      },
      {
        "kode": "3c",
        "berkas": "[3c] BAS Terakhir P Hadir & T Tidak Hadir - Saksi dan Putusan Verstek (5 Saksi).rtf",
        "ke": 0,
        "peran": "varian",
        "keterangan": "5 saksi",
        "asal": "derry",
        "turunan": false
      }
    ]
  },
  {
    "id": "alur-04",
    "nomor": 4,
    "nama": "Cerai Kontra Tertulis (Mediasi s.d. Putusan)",
    "folder": "derry_briantono/ALUR 04 Cerai Kontra Tertulis (Mediasi s.d. Putusan)",
    "menuId": 963,
    "jenisMin": 346,
    "jenisMaks": 347,
    "langkah": [
      {
        "kode": "1",
        "berkas": "[1] BAS 1 P & T Hadir - Mediasi.rtf",
        "ke": 1,
        "peran": "pertama",
        "keterangan": "mediasi",
        "asal": "derry",
        "turunan": false
      },
      {
        "kode": "2",
        "berkas": "[2] BAS 2 P & T Hadir - Laporan Mediasi dan Pemeriksaan Pokok Perkara.rtf",
        "ke": 2,
        "peran": "lanjutan",
        "keterangan": "",
        "asal": "derry",
        "turunan": false
      },
      {
        "kode": "3",
        "berkas": "[3] BAS 3 P & T Hadir - Jawaban (dan Gugatan Rekonvensi bila ada).rtf",
        "ke": 3,
        "peran": "lanjutan",
        "keterangan": "",
        "asal": "derry",
        "turunan": false
      },
      {
        "kode": "4",
        "berkas": "[4] BAS 4 P & T Hadir - Replik (dan Jawaban Rekonvensi bila ada).rtf",
        "ke": 4,
        "peran": "lanjutan",
        "keterangan": "",
        "asal": "derry",
        "turunan": false
      },
      {
        "kode": "5",
        "berkas": "[5] BAS 5 P & T Hadir - Duplik (dan Replik Rekonvensi bila ada).rtf",
        "ke": 5,
        "peran": "lanjutan",
        "keterangan": "",
        "asal": "derry",
        "turunan": false
      },
      {
        "kode": "5a",
        "berkas": "[5a] BAS 5a P & T Hadir - Duplik Rekonvensi.rtf",
        "ke": 5,
        "peran": "varian",
        "keterangan": "duplik rekonvensi",
        "asal": "derry",
        "turunan": false
      },
      {
        "kode": "6",
        "berkas": "[6] BAS 6 P & T Hadir - Pembuktian P.rtf",
        "ke": 6,
        "peran": "lanjutan",
        "keterangan": "",
        "asal": "derry",
        "turunan": false
      },
      {
        "kode": "6a",
        "berkas": "[6a] BAS 6 P & T Hadir - Pembuktian P (3 Saksi).rtf",
        "ke": 6,
        "peran": "varian",
        "keterangan": "3 saksi",
        "asal": "derry",
        "turunan": false
      },
      {
        "kode": "6b",
        "berkas": "[6b] BAS 6 P & T Hadir - Pembuktian P (4 Saksi).rtf",
        "ke": 6,
        "peran": "varian",
        "keterangan": "4 saksi",
        "asal": "derry",
        "turunan": false
      },
      {
        "kode": "6c",
        "berkas": "[6c] BAS 6 P & T Hadir - Pembuktian P (5 Saksi).rtf",
        "ke": 6,
        "peran": "varian",
        "keterangan": "5 saksi",
        "asal": "derry",
        "turunan": false
      },
      {
        "kode": "7",
        "berkas": "[7] BAS 7 P & T Hadir - Pembuktian T.rtf",
        "ke": 7,
        "peran": "lanjutan",
        "keterangan": "",
        "asal": "derry",
        "turunan": false
      },
      {
        "kode": "7a",
        "berkas": "[7a] BAS 7 P & T Hadir - Pembuktian T (3 Saksi).rtf",
        "ke": 7,
        "peran": "varian",
        "keterangan": "3 saksi",
        "asal": "derry",
        "turunan": false
      },
      {
        "kode": "7b",
        "berkas": "[7b] BAS 7 P & T Hadir - Pembuktian T (4 Saksi).rtf",
        "ke": 7,
        "peran": "varian",
        "keterangan": "4 saksi",
        "asal": "derry",
        "turunan": false
      },
      {
        "kode": "8",
        "berkas": "[8] BAS 8 P & T Hadir - Kesimpulan.rtf",
        "ke": 8,
        "peran": "lanjutan",
        "keterangan": "",
        "asal": "derry",
        "turunan": false
      },
      {
        "kode": "9",
        "berkas": "[9] BAS 9 P & T Hadir - Penyampaian Putusan.rtf",
        "ke": 0,
        "peran": "terakhir",
        "keterangan": "",
        "asal": "derry",
        "turunan": false
      },
      {
        "kode": "T",
        "berkas": "[T] BAS P & T Tidak Hadir - Tunda Panggil P & T (kapan saja).rtf",
        "ke": 0,
        "peran": "varian",
        "keterangan": "P dan T tidak hadir",
        "asal": "derry",
        "turunan": true
      }
    ]
  },
  {
    "id": "alur-05",
    "nomor": 5,
    "nama": "Cerai Kontra Lisan (Mediasi s.d. Putusan)",
    "folder": "derry_briantono/ALUR 05 Cerai Kontra Lisan (Mediasi s.d. Putusan)",
    "menuId": 964,
    "jenisMin": 346,
    "jenisMaks": 347,
    "langkah": [
      {
        "kode": "1",
        "berkas": "[1] BAS 1 P & T Hadir - Mediasi.rtf",
        "ke": 1,
        "peran": "pertama",
        "keterangan": "mediasi",
        "asal": "derry",
        "turunan": false
      },
      {
        "kode": "2",
        "berkas": "[2] BAS 2 P & T Hadir - Pembacaan Gugatan dan Jawab Menjawab Lisan, Tunda Pembuktian P.rtf",
        "ke": 2,
        "peran": "lanjutan",
        "keterangan": "",
        "asal": "derry-lama",
        "turunan": false
      },
      {
        "kode": "3",
        "berkas": "[3] BAS 3 P & T Hadir - Pembuktian P, Tunda Pembuktian T.rtf",
        "ke": 3,
        "peran": "lanjutan",
        "keterangan": "",
        "asal": "derry-lama",
        "turunan": false
      },
      {
        "kode": "3a",
        "berkas": "[3a] BAS 3 P & T Hadir - Pembuktian P dan T.rtf",
        "ke": 3,
        "peran": "varian",
        "keterangan": "pembuktian P dan T sekaligus",
        "asal": "derry-lama",
        "turunan": false
      },
      {
        "kode": "4",
        "berkas": "[4] BAS 4 P & T Hadir - Musyawarah Majelis dan Pembacaan Putusan.rtf",
        "ke": 0,
        "peran": "terakhir",
        "keterangan": "",
        "asal": "derry-lama",
        "turunan": false
      }
    ]
  },
  {
    "id": "alur-06",
    "nomor": 6,
    "nama": "Cerai T Hadir Mediasi lalu Tidak Hadir",
    "folder": "derry_briantono/ALUR 06 Cerai T Hadir Mediasi lalu Tidak Hadir",
    "menuId": 965,
    "jenisMin": 346,
    "jenisMaks": 347,
    "langkah": [
      {
        "kode": "1",
        "berkas": "[1] BAS 1 P & T Hadir - Mediasi.rtf",
        "ke": 1,
        "peran": "pertama",
        "keterangan": "mediasi",
        "asal": "derry",
        "turunan": false
      },
      {
        "kode": "2",
        "berkas": "[2] BAS 2 P Hadir & T Tidak Hadir - Laporan Mediasi, Tunda Panggil T.rtf",
        "ke": 2,
        "peran": "lanjutan",
        "keterangan": "laporan mediasi, T tidak hadir",
        "asal": "standar",
        "turunan": true
      },
      {
        "kode": "3",
        "berkas": "[3] BAS 3 P Hadir & T Tidak Hadir - Saksi dan Putusan (2 Saksi).rtf",
        "ke": 0,
        "peran": "terakhir",
        "keterangan": "2 saksi, putusan tanpa hadirnya T (kontradiktoir - T pernah hadir)",
        "asal": "derry",
        "turunan": true
      },
      {
        "kode": "3a",
        "berkas": "[3a] BAS 3 P Hadir & T Tidak Hadir - Saksi dan Putusan (3 Saksi).rtf",
        "ke": 0,
        "peran": "varian",
        "keterangan": "3 saksi, putusan tanpa hadirnya T (kontradiktoir - T pernah hadir)",
        "asal": "derry",
        "turunan": true
      },
      {
        "kode": "3b",
        "berkas": "[3b] BAS 3 P Hadir & T Tidak Hadir - Saksi dan Putusan (4 Saksi).rtf",
        "ke": 0,
        "peran": "varian",
        "keterangan": "4 saksi, putusan tanpa hadirnya T (kontradiktoir - T pernah hadir)",
        "asal": "derry",
        "turunan": true
      },
      {
        "kode": "3c",
        "berkas": "[3c] BAS 3 P Hadir & T Tidak Hadir - Saksi dan Putusan (5 Saksi).rtf",
        "ke": 0,
        "peran": "varian",
        "keterangan": "5 saksi, putusan tanpa hadirnya T (kontradiktoir - T pernah hadir)",
        "asal": "derry",
        "turunan": true
      }
    ]
  },
  {
    "id": "alur-07",
    "nomor": 7,
    "nama": "Cerai Gugur",
    "folder": "derry_briantono/ALUR 07 Cerai Gugur",
    "menuId": 966,
    "jenisMin": 346,
    "jenisMaks": 347,
    "langkah": [
      {
        "kode": "1",
        "berkas": "[1] BAS 1 P & T Tidak Hadir - Tunda Panggil P & T.rtf",
        "ke": 1,
        "peran": "pertama",
        "keterangan": "",
        "asal": "derry",
        "turunan": true
      },
      {
        "kode": "2",
        "berkas": "[2] BAS 2 P & T Tidak Hadir - Tunda Panggil P & T (bila masih dipanggil).rtf",
        "ke": 2,
        "peran": "lanjutan",
        "keterangan": "bila dipanggil lagi",
        "asal": "derry",
        "turunan": true
      },
      {
        "kode": "3",
        "berkas": "[3] BAS Putus P & T Tidak Hadir - Gugur.rtf",
        "ke": 0,
        "peran": "terakhir",
        "keterangan": "putus gugur",
        "asal": "derry-lama",
        "turunan": true
      }
    ]
  },
  {
    "id": "alur-08",
    "nomor": 8,
    "nama": "Cerai Dicabut",
    "folder": "derry_briantono/ALUR 08 Cerai Dicabut",
    "menuId": 967,
    "jenisMin": 346,
    "jenisMaks": 347,
    "langkah": [
      {
        "kode": "A",
        "berkas": "[A] BAS 1 P Hadir & T Tidak Hadir - Cabut di Sidang Pertama sebelum Mediasi.rtf",
        "ke": 1,
        "peran": "terakhir",
        "keterangan": "cabut di sidang pertama",
        "asal": "derry-lama",
        "turunan": false
      },
      {
        "kode": "B",
        "berkas": "[B] BAS Lanjutan P Hadir & T Tidak Hadir - Cabut karena Gugatan Salah.rtf",
        "ke": 0,
        "peran": "terakhir",
        "keterangan": "cabut di sidang lanjutan",
        "asal": "derry-lama",
        "turunan": false
      },
      {
        "kode": "C1",
        "berkas": "[C1] BAS 1 P & T Hadir - Mediasi.rtf",
        "ke": 1,
        "peran": "pertama",
        "keterangan": "mediasi",
        "asal": "derry",
        "turunan": false
      },
      {
        "kode": "C2",
        "berkas": "[C2] BAS Putus P & T Hadir - Cabut Perkara Damai dari Mediasi.rtf",
        "ke": 0,
        "peran": "terakhir",
        "keterangan": "cabut karena damai",
        "asal": "derry-lama",
        "turunan": false
      }
    ]
  },
  {
    "id": "alur-09",
    "nomor": 9,
    "nama": "Cerai Tidak Dapat Diterima (NO)",
    "folder": "derry_briantono/ALUR 09 Cerai Tidak Dapat Diterima (NO)",
    "menuId": 968,
    "jenisMin": 346,
    "jenisMaks": 347,
    "langkah": [
      {
        "kode": "1",
        "berkas": "[1] BAS 1 P Hadir & T Tidak Hadir - Tunda Panggil T (Alamat Tidak Jelas).rtf",
        "ke": 1,
        "peran": "pertama",
        "keterangan": "alamat tidak jelas",
        "asal": "derry",
        "turunan": false
      },
      {
        "kode": "2",
        "berkas": "[2] BAS Putus P Hadir & T Tidak Hadir - NO (Alamat T Salah).rtf",
        "ke": 0,
        "peran": "terakhir",
        "keterangan": "putus NO",
        "asal": "derry-lama",
        "turunan": false
      }
    ]
  },
  {
    "id": "alur-10",
    "nomor": 10,
    "nama": "Cerai Talak Sidang Ikrar Talak",
    "folder": "derry_briantono/ALUR 10 Cerai Talak Sidang Ikrar Talak",
    "menuId": 969,
    "jenisMin": 346,
    "jenisMaks": 346,
    "langkah": [
      {
        "kode": "1",
        "berkas": "[1] BAS Ikrar Talak - P Hadir & T Tidak Hadir.rtf",
        "ke": 0,
        "peran": "terakhir",
        "keterangan": "P hadir, T tidak hadir",
        "asal": "satker",
        "turunan": false
      },
      {
        "kode": "2",
        "berkas": "[2] BAS Ikrar Talak - P & T Hadir.rtf",
        "ke": 0,
        "peran": "varian",
        "keterangan": "P dan T hadir",
        "asal": "satker",
        "turunan": false
      },
      {
        "kode": "2a",
        "berkas": "[2a] BAS Ikrar Talak - P & T Hadir, Ada Beban.rtf",
        "ke": 0,
        "peran": "varian",
        "keterangan": "P dan T hadir, ada beban",
        "asal": "satker",
        "turunan": false
      },
      {
        "kode": "3",
        "berkas": "[3] BAS Ikrar Talak - P Tidak Hadir & T Hadir, Tunda Tenggang Waktu 6 Bulan.rtf",
        "ke": 0,
        "peran": "varian",
        "keterangan": "P tidak hadir, T hadir",
        "asal": "satker",
        "turunan": false
      }
    ]
  },
  {
    "id": "alur-11",
    "nomor": 11,
    "nama": "Itsbat Nikah 1 Sidang",
    "folder": "derry_briantono/ALUR 11 Itsbat Nikah 1 Sidang",
    "menuId": 970,
    "jenisMin": 360,
    "jenisMaks": 360,
    "langkah": [
      {
        "kode": "1",
        "berkas": "[1] BAS 1 IN - Kabul (1x Sidang).rtf",
        "ke": 1,
        "peran": "terakhir",
        "keterangan": "",
        "asal": "derry",
        "turunan": false
      },
      {
        "kode": "1a",
        "berkas": "[1a] BAS 1 IN - Kabul Syahadah Istifadhah (1x Sidang).rtf",
        "ke": 1,
        "peran": "varian",
        "keterangan": "syahadah istifadhah",
        "asal": "derry",
        "turunan": false
      }
    ]
  },
  {
    "id": "alur-12",
    "nomor": 12,
    "nama": "Dispensasi Kawin",
    "folder": "derry_briantono/ALUR 12 Dispensasi Kawin",
    "menuId": 971,
    "jenisMin": 362,
    "jenisMaks": 362,
    "langkah": [
      {
        "kode": "1",
        "berkas": "[1] BAS DK - Anak Perempuan Hamil.rtf",
        "ke": 1,
        "peran": "terakhir",
        "keterangan": "anak perempuan hamil",
        "asal": "derry-lama",
        "turunan": false
      },
      {
        "kode": "1a",
        "berkas": "[1a] BAS DK - Calon Istri Hamil (Anak Laki-laki).rtf",
        "ke": 1,
        "peran": "varian",
        "keterangan": "calon istri hamil",
        "asal": "derry-lama",
        "turunan": false
      },
      {
        "kode": "2",
        "berkas": "[2] BAS DK - Anak Perempuan Sudah Berhubungan Badan.rtf",
        "ke": 1,
        "peran": "varian",
        "keterangan": "anak perempuan sudah berhubungan badan",
        "asal": "derry-lama",
        "turunan": false
      },
      {
        "kode": "2a",
        "berkas": "[2a] BAS DK - Anak Laki-laki Sudah Berhubungan Badan.rtf",
        "ke": 1,
        "peran": "varian",
        "keterangan": "anak laki-laki sudah berhubungan badan",
        "asal": "derry-lama",
        "turunan": false
      }
    ]
  },
  {
    "id": "alur-13",
    "nomor": 13,
    "nama": "Asal Usul Anak",
    "folder": "derry_briantono/ALUR 13 Asal Usul Anak",
    "menuId": 972,
    "jenisMin": 358,
    "jenisMaks": 358,
    "langkah": [
      {
        "kode": "1",
        "berkas": "[1] BAS 1 Asal Usul Anak - Kabul.rtf",
        "ke": 1,
        "peran": "terakhir",
        "keterangan": "",
        "asal": "derry",
        "turunan": false
      }
    ]
  }
];

/* === S 13 Okt === */
/**
 * PADANAN BAS FOLDER LAMA -> FOLDER ALUR (paket ABT abt-blangko-derry-rapi, 13 Okt 2026).
 *
 * Paket itu menyembunyikan menu BAS lama Derry (951 "- BAS VERSTEK PERCERAIAN -", 952 CONTRA, 954 ITSTBAT, 955 ASAL USUL)
 * karena seluruh isinya sudah ada - bita demi bita (md5 server) - di folder ALUR. Berkasnya tetap di server dan katalog
 * BAS massal tetap membacanya, tetapi token ABT-nya tidak lagi dapat dipanen dari halaman ABT (menunya tidak tampil):
 * tombol "Buka di ABT" lalu memakai berkas PADANANNYA di folder ALUR. CONTRA [99] berbeda md5 dari VERSTEK [99] hanya
 * karena #6031# dan satu baris variabel kuasa tersembunyi - padanannya padanan VERSTEK [99]. Dibangkitkan dari
 * D:/aleta-dev/kerja/abt-blangko-derry-rapi/hasil/padanan-bas.json (alat/padanan_bas.py).
 */
export type PadananBas = { folder: string; berkas: string };

export const PADANAN_BAS_ARSIP: Record<string, PadananBas[]> = {
  "derry_briantono/- BAS ASAL USUL ANAK -/[01a] BAS 1 Asal Usul Anak - Kabul.rtf": [{ folder: "derry_briantono/ALUR 13 Asal Usul Anak", berkas: "[1] BAS 1 Asal Usul Anak - Kabul.rtf" }],
  "derry_briantono/- BAS CONTRA PERCERAIAN -/[02] BAS 1 P & T Hadir Mediasi P dan T PERMA 7 2022 & Keputusan Dirjen 1465.rtf": [{ folder: "derry_briantono/ALUR 04 Cerai Kontra Tertulis (Mediasi s.d. Putusan)", berkas: "[1] BAS 1 P & T Hadir - Mediasi.rtf" }, { folder: "derry_briantono/ALUR 05 Cerai Kontra Lisan (Mediasi s.d. Putusan)", berkas: "[1] BAS 1 P & T Hadir - Mediasi.rtf" }, { folder: "derry_briantono/ALUR 06 Cerai T Hadir Mediasi lalu Tidak Hadir", berkas: "[1] BAS 1 P & T Hadir - Mediasi.rtf" }, { folder: "derry_briantono/ALUR 08 Cerai Dicabut", berkas: "[C1] BAS 1 P & T Hadir - Mediasi.rtf" }],
  "derry_briantono/- BAS CONTRA PERCERAIAN -/[02] BAS 2 P & T Hadir Laporan Mediasi dan Pemeriksaan Pokok Perkara PERMA 7 2022 & Keputusan Dirjen 1465.rtf": [{ folder: "derry_briantono/ALUR 04 Cerai Kontra Tertulis (Mediasi s.d. Putusan)", berkas: "[2] BAS 2 P & T Hadir - Laporan Mediasi dan Pemeriksaan Pokok Perkara.rtf" }],
  "derry_briantono/- BAS CONTRA PERCERAIAN -/[02] BAS 3 P & T Hadir Jawaban dan (Apabila ada Gugatan Rekonvensi) PERMA 7 2022 & Keputusan Dirjen 1465.rtf": [{ folder: "derry_briantono/ALUR 04 Cerai Kontra Tertulis (Mediasi s.d. Putusan)", berkas: "[3] BAS 3 P & T Hadir - Jawaban (dan Gugatan Rekonvensi bila ada).rtf" }],
  "derry_briantono/- BAS CONTRA PERCERAIAN -/[02] BAS 4 P & T Hadir Replik dan (Apabila ada Jawaban Rekonvensi) PERMA 7 2022 & Keputusan Dirjen 1465.rtf": [{ folder: "derry_briantono/ALUR 04 Cerai Kontra Tertulis (Mediasi s.d. Putusan)", berkas: "[4] BAS 4 P & T Hadir - Replik (dan Jawaban Rekonvensi bila ada).rtf" }],
  "derry_briantono/- BAS CONTRA PERCERAIAN -/[02] BAS 5 P & T Hadir Duplik dan (Apabila ada Replik Rekonvensi) PERMA 7 2022 & Keputusan Dirjen 1465.rtf": [{ folder: "derry_briantono/ALUR 04 Cerai Kontra Tertulis (Mediasi s.d. Putusan)", berkas: "[5] BAS 5 P & T Hadir - Duplik (dan Replik Rekonvensi bila ada).rtf" }],
  "derry_briantono/- BAS CONTRA PERCERAIAN -/[02] BAS 5a P & T Hadir Duplik Rekonvensi PERMA 7 2022 & Keputusan Dirjen 1465.rtf": [{ folder: "derry_briantono/ALUR 04 Cerai Kontra Tertulis (Mediasi s.d. Putusan)", berkas: "[5a] BAS 5a P & T Hadir - Duplik Rekonvensi.rtf" }],
  "derry_briantono/- BAS CONTRA PERCERAIAN -/[02] BAS 6 P & T Hadir Pembuktian P PERMA 7 2022 & Keputusan Dirjen 1465 - (3 Saksi).rtf": [{ folder: "derry_briantono/ALUR 04 Cerai Kontra Tertulis (Mediasi s.d. Putusan)", berkas: "[6a] BAS 6 P & T Hadir - Pembuktian P (3 Saksi).rtf" }],
  "derry_briantono/- BAS CONTRA PERCERAIAN -/[02] BAS 6 P & T Hadir Pembuktian P PERMA 7 2022 & Keputusan Dirjen 1465 - (4 Saksi).rtf": [{ folder: "derry_briantono/ALUR 04 Cerai Kontra Tertulis (Mediasi s.d. Putusan)", berkas: "[6b] BAS 6 P & T Hadir - Pembuktian P (4 Saksi).rtf" }],
  "derry_briantono/- BAS CONTRA PERCERAIAN -/[02] BAS 6 P & T Hadir Pembuktian P PERMA 7 2022 & Keputusan Dirjen 1465 - (5 Saksi).rtf": [{ folder: "derry_briantono/ALUR 04 Cerai Kontra Tertulis (Mediasi s.d. Putusan)", berkas: "[6c] BAS 6 P & T Hadir - Pembuktian P (5 Saksi).rtf" }],
  "derry_briantono/- BAS CONTRA PERCERAIAN -/[02] BAS 6 P & T Hadir Pembuktian P PERMA 7 2022 & Keputusan Dirjen 1465.rtf": [{ folder: "derry_briantono/ALUR 04 Cerai Kontra Tertulis (Mediasi s.d. Putusan)", berkas: "[6] BAS 6 P & T Hadir - Pembuktian P.rtf" }],
  "derry_briantono/- BAS CONTRA PERCERAIAN -/[02] BAS 7 P & T Hadir Pembuktian T PERMA 7 2022 & Keputusan Dirjen 1465 - (3 Saksi).rtf": [{ folder: "derry_briantono/ALUR 04 Cerai Kontra Tertulis (Mediasi s.d. Putusan)", berkas: "[7a] BAS 7 P & T Hadir - Pembuktian T (3 Saksi).rtf" }],
  "derry_briantono/- BAS CONTRA PERCERAIAN -/[02] BAS 7 P & T Hadir Pembuktian T PERMA 7 2022 & Keputusan Dirjen 1465 - (4 Saksi).rtf": [{ folder: "derry_briantono/ALUR 04 Cerai Kontra Tertulis (Mediasi s.d. Putusan)", berkas: "[7b] BAS 7 P & T Hadir - Pembuktian T (4 Saksi).rtf" }],
  "derry_briantono/- BAS CONTRA PERCERAIAN -/[02] BAS 7 P & T Hadir Pembuktian T PERMA 7 2022 & Keputusan Dirjen 1465.rtf": [{ folder: "derry_briantono/ALUR 04 Cerai Kontra Tertulis (Mediasi s.d. Putusan)", berkas: "[7] BAS 7 P & T Hadir - Pembuktian T.rtf" }],
  "derry_briantono/- BAS CONTRA PERCERAIAN -/[02] BAS 8 P & T Hadir Kesimpulan PERMA 7 2022 & Keputusan Dirjen 1465.rtf": [{ folder: "derry_briantono/ALUR 04 Cerai Kontra Tertulis (Mediasi s.d. Putusan)", berkas: "[8] BAS 8 P & T Hadir - Kesimpulan.rtf" }],
  "derry_briantono/- BAS CONTRA PERCERAIAN -/[02] BAS 9 P & T Hadir Penyampaian Putusan PERMA 7 2022 & Keputusan Dirjen 1465.rtf": [{ folder: "derry_briantono/ALUR 04 Cerai Kontra Tertulis (Mediasi s.d. Putusan)", berkas: "[9] BAS 9 P & T Hadir - Penyampaian Putusan.rtf" }],
  "derry_briantono/- BAS CONTRA PERCERAIAN -/[99] BAS 1 P & T Tidak Hadir - Tunda Panggil P & T.rtf": [{ folder: "derry_briantono/ALUR 07 Cerai Gugur", berkas: "[1] BAS 1 P & T Tidak Hadir - Tunda Panggil P & T.rtf" }],
  "derry_briantono/- BAS CONTRA PERCERAIAN -/[99] BAS 1 P Hadir & T Tidak Hadir - Alamat Tidak Jelas Atau Luar Batas Antar.rtf": [{ folder: "derry_briantono/ALUR 02 Cerai Verstek 2 Sidang", berkas: "[1a] BAS 1 P Hadir & T Tidak Hadir - Alamat Tidak Jelas atau Luar Batas Antar.rtf" }, { folder: "derry_briantono/ALUR 03 Cerai Verstek 3 Sidang atau Lebih", berkas: "[1a] BAS 1 P Hadir & T Tidak Hadir - Alamat Tidak Jelas atau Luar Batas Antar.rtf" }, { folder: "derry_briantono/ALUR 09 Cerai Tidak Dapat Diterima (NO)", berkas: "[1] BAS 1 P Hadir & T Tidak Hadir - Tunda Panggil T (Alamat Tidak Jelas).rtf" }],
  "derry_briantono/- BAS CONTRA PERCERAIAN -/[99] BAS 2 P & T Tidak Hadir - Tunda Panggil P & T.rtf": [{ folder: "derry_briantono/ALUR 04 Cerai Kontra Tertulis (Mediasi s.d. Putusan)", berkas: "[T] BAS P & T Tidak Hadir - Tunda Panggil P & T (kapan saja).rtf" }, { folder: "derry_briantono/ALUR 07 Cerai Gugur", berkas: "[2] BAS 2 P & T Tidak Hadir - Tunda Panggil P & T (bila masih dipanggil).rtf" }],
  "derry_briantono/- BAS ITSTBAT NIKAH -/[01a] BAS 1 IN - Kabul.rtf": [{ folder: "derry_briantono/ALUR 11 Itsbat Nikah 1 Sidang", berkas: "[1] BAS 1 IN - Kabul (1x Sidang).rtf" }],
  "derry_briantono/- BAS ITSTBAT NIKAH -/[01ab] BAS 1 IN - Kabul Syahadah Istifadhah.rtf": [{ folder: "derry_briantono/ALUR 11 Itsbat Nikah 1 Sidang", berkas: "[1a] BAS 1 IN - Kabul Syahadah Istifadhah (1x Sidang).rtf" }],
  "derry_briantono/- BAS VERSTEK PERCERAIAN -/[01a] (E-Court) BAS 1 P Hadir & T Tidak Hadir - Tunda Panggil T.rtf": [{ folder: "derry_briantono/ALUR 02 Cerai Verstek 2 Sidang", berkas: "[1] BAS 1 P Hadir & T Tidak Hadir - Tunda Panggil T.rtf" }, { folder: "derry_briantono/ALUR 03 Cerai Verstek 3 Sidang atau Lebih", berkas: "[1] BAS 1 P Hadir & T Tidak Hadir - Tunda Panggil T.rtf" }],
  "derry_briantono/- BAS VERSTEK PERCERAIAN -/[01b] (E-Court) BAS 2 P Hadir & T Tidak Hadir Pokok Perkara - Putusan Verstek.rtf": [{ folder: "derry_briantono/ALUR 02 Cerai Verstek 2 Sidang", berkas: "[2] BAS 2 P Hadir & T Tidak Hadir - Saksi dan Putusan Verstek (2 Saksi).rtf" }, { folder: "derry_briantono/ALUR 03 Cerai Verstek 3 Sidang atau Lebih", berkas: "[3] BAS Terakhir P Hadir & T Tidak Hadir - Saksi dan Putusan Verstek (2 Saksi).rtf" }],
  "derry_briantono/- BAS VERSTEK PERCERAIAN -/[09] (E-Court) BAS 2 P Hadir & T Tidak Hadir - Putusan Verstek - (3 Saksi).rtf": [{ folder: "derry_briantono/ALUR 02 Cerai Verstek 2 Sidang", berkas: "[2a] BAS 2 P Hadir & T Tidak Hadir - Saksi dan Putusan Verstek (3 Saksi).rtf" }, { folder: "derry_briantono/ALUR 03 Cerai Verstek 3 Sidang atau Lebih", berkas: "[3a] BAS Terakhir P Hadir & T Tidak Hadir - Saksi dan Putusan Verstek (3 Saksi).rtf" }],
  "derry_briantono/- BAS VERSTEK PERCERAIAN -/[09] (E-Court) BAS 2 P Hadir & T Tidak Hadir - Putusan Verstek - (4 Saksi).rtf": [{ folder: "derry_briantono/ALUR 02 Cerai Verstek 2 Sidang", berkas: "[2b] BAS 2 P Hadir & T Tidak Hadir - Saksi dan Putusan Verstek (4 Saksi).rtf" }, { folder: "derry_briantono/ALUR 03 Cerai Verstek 3 Sidang atau Lebih", berkas: "[3b] BAS Terakhir P Hadir & T Tidak Hadir - Saksi dan Putusan Verstek (4 Saksi).rtf" }],
  "derry_briantono/- BAS VERSTEK PERCERAIAN -/[09] (E-Court) BAS 2 P Hadir & T Tidak Hadir - Putusan Verstek - (5 Saksi).rtf": [{ folder: "derry_briantono/ALUR 02 Cerai Verstek 2 Sidang", berkas: "[2c] BAS 2 P Hadir & T Tidak Hadir - Saksi dan Putusan Verstek (5 Saksi).rtf" }, { folder: "derry_briantono/ALUR 03 Cerai Verstek 3 Sidang atau Lebih", berkas: "[3c] BAS Terakhir P Hadir & T Tidak Hadir - Saksi dan Putusan Verstek (5 Saksi).rtf" }],
  "derry_briantono/- BAS VERSTEK PERCERAIAN -/[99] BAS 1 P & T Tidak Hadir - Tunda Panggil P & T.rtf": [{ folder: "derry_briantono/ALUR 07 Cerai Gugur", berkas: "[1] BAS 1 P & T Tidak Hadir - Tunda Panggil P & T.rtf" }],
  "derry_briantono/- BAS VERSTEK PERCERAIAN -/[99] BAS 1 P Hadir & T Tidak Hadir - Alamat Tidak Jelas Atau Luar Batas Antar.rtf": [{ folder: "derry_briantono/ALUR 02 Cerai Verstek 2 Sidang", berkas: "[1a] BAS 1 P Hadir & T Tidak Hadir - Alamat Tidak Jelas atau Luar Batas Antar.rtf" }, { folder: "derry_briantono/ALUR 03 Cerai Verstek 3 Sidang atau Lebih", berkas: "[1a] BAS 1 P Hadir & T Tidak Hadir - Alamat Tidak Jelas atau Luar Batas Antar.rtf" }, { folder: "derry_briantono/ALUR 09 Cerai Tidak Dapat Diterima (NO)", berkas: "[1] BAS 1 P Hadir & T Tidak Hadir - Tunda Panggil T (Alamat Tidak Jelas).rtf" }],
  "derry_briantono/- BAS VERSTEK PERCERAIAN -/[99] BAS 2 P & T Tidak Hadir - Tunda Panggil P & T.rtf": [{ folder: "derry_briantono/ALUR 04 Cerai Kontra Tertulis (Mediasi s.d. Putusan)", berkas: "[T] BAS P & T Tidak Hadir - Tunda Panggil P & T (kapan saja).rtf" }, { folder: "derry_briantono/ALUR 07 Cerai Gugur", berkas: "[2] BAS 2 P & T Tidak Hadir - Tunda Panggil P & T (bila masih dipanggil).rtf" }],
};

/**
 * F3 14 Okt: menu ALUR 960-972 juga disembunyikan paket abt-susunan-satu-folder (BAS disalin ke folder jenis). Padanan ini TETAP
 * dipakai untuk token ALUR yang sudah tersimpan; salinan di folder jenis dihitung lib/salinan-bas-jenis.ts (rantai: folder lama
 * -> padanan ALUR -> salinan) dan dikirim bersama pilihan BAS massal.
 */
/** Padanan ALUR untuk satu berkas BAS folder lama (kunci "folder/berkas", ".rtf" boleh ada atau tidak); [] bila tidak ada. */
export function padananBasArsip(folder: string, berkas: string): PadananBas[] {
  const b = String(berkas || "").trim();
  const k = `${String(folder || "").trim()}/${/\.rtf$/i.test(b) ? b : `${b}.rtf`}`;
  return PADANAN_BAS_ARSIP[k] ?? [];
}
/* === AKHIR S === */
