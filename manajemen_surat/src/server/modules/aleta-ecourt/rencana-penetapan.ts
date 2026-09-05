import { type AletaDatabase } from "@/server/db/client";
import {
  type AkunSiapPakai,
  type JenisJabatan,
  bacaPemetaanJabatan,
  pilihAkunPejabat,
} from "@/server/modules/aleta-ecourt/pemetaan-jabatan";
import { pejabatBertugas, yangSedangCuti } from "@/server/modules/aleta-ecourt/pejabat-bertugas";
import { bacaPetaMedan } from "@/server/modules/aleta-ecourt/penunjukan-pengisian";

/**
 * Merakit RENCANA KERJA penetapan satu perkara: daftar langkah berurutan,
 * lengkap, tinggal dikerjakan.
 *
 * ============================================================================
 * INI OTAKNYA, BUKAN TANGANNYA
 * ============================================================================
 *
 * Yang menulis ke SIPP adalah ekstensi di peramban - hanya ia yang bisa
 * mengisi kotak formulir, berganti sesi, dan menekan Simpan. Modul ini tidak
 * menyentuh SIPP sama sekali. Ia hanya MEMUTUSKAN: langkah apa, urutannya,
 * akun siapa, nilai apa, dan bagaimana membuktikan hasilnya.
 *
 * Pemisahan ini disengaja. Keputusan dapat diuji tanpa peramban dan tanpa
 * menyentuh perkara sungguhan; tangannya tetap tipis dan tak berpikir. Bila
 * keliru menetapkan atas nama yang salah, kekeliruannya ada di sini - tempat
 * yang bisa diuji - bukan tersembunyi di dalam klik.
 *
 * ============================================================================
 * URUTAN TIDAK DAPAT DIBALIK
 * ============================================================================
 *
 * Data Umum -> PMH -> PPP -> PJS -> PHS. SIPP menolak PPP/PJS sebelum
 * majelisnya ada, dan PHS menetapkan hari sidang bagi majelis itu. Akun PHS
 * bahkan baru pasti SESUDAH PMH tersimpan - ketua majelisnya dibaca dari
 * perkara_hakim_pn, bukan ditebak dari usulan. Karena itu akun PHS di sini
 * ditandai "tentatif": ekstensi wajib membacanya ulang setelah PMH mendarat.
 */

export const URUTAN_LANGKAH = ["data-umum", "pmh", "ppp", "pjs", "phs"] as const;
export type JenisLangkah = (typeof URUTAN_LANGKAH)[number];

const SEBUTAN: Record<JenisLangkah, string> = {
  "data-umum": "Data Umum",
  pmh: "Penetapan Majelis Hakim",
  ppp: "Penetapan Panitera Pengganti",
  pjs: "Penetapan Juru Sita",
  phs: "Penetapan Hari Sidang",
};

/** Jabatan SIPP yang mengerjakan tiap langkah; null = akun operator sendiri. */
const JABATAN_LANGKAH: Record<JenisLangkah, JenisJabatan | "pimpinan" | null> = {
  "data-umum": null, // dikerjakan operator saat pendaftaran, akunnya sendiri
  pmh: "pimpinan", // Ketua/Wakil Ketua Pengadilan
  ppp: "panitera",
  pjs: "panitera",
  phs: "hakim", // ketua majelis perkara itu
};

/** Usulan yang sudah dinormalkan dari jawaban bot. */
export type UsulanPenetapan = {
  perkaraId: string;
  tanggalPenetapan: string;
  pmh: {
    bentuk: "majelis" | "tunggal" | "belum-tentu";
    majelisKode: string;
    ketuaHakimId: string;
    anggotaHakimId: string[];
    sebab: string;
  };
  ppp: { paniteraId: string; sebab: string };
  pjs: { jurusitaId: string; nama: string; dugaanBerhalangan: boolean; sebab: string };
  phs: { tanggalSidang: string; sebab: string };
  /**
   * Majelis yang SUDAH tercatat di perkara_hakim_pn - kosong selama PMH belum
   * tersimpan. Berbeda dari pmh di atas, yang baru usulan.
   */
  tercatat: { ada: boolean; ketuaHakimId: string; ketuaNama: string };
};

export type NilaiMedan = {
  medan: string;
  penunjuk: string;
  jenis: string;
  wajib: boolean;
  /** Nilai yang akan diisikan. "" berarti belum diketahui - operator isi sendiri. */
  nilai: string;
  /** Asal-usul nilai, dalam bahasa yang dapat dibaca operator. */
  asal: string;
};

export type AkunLangkah = {
  username: string;
  namaLengkap: string;
  grup: string;
  /** Sebutan jabatan yang menandatangani - Ketua, Wakil Ketua, PLH Ketua. */
  sebutan: string;
  siap: boolean;
  sebab: string;
  /** PHS: akun ini dugaan dari usulan; wajib dibaca ulang setelah PMH mendarat. */
  tentatif: boolean;
} | null;

export type LangkahPenetapan = {
  urutan: number;
  jenis: JenisLangkah;
  sebutan: string;
  /** null = dikerjakan operator dengan akunnya sendiri (Data Umum). */
  akun: AkunLangkah;
  medan: NilaiMedan[];
  /** Yang harus terbaca di SIPP setelah langkah ini, untuk membuktikan hasilnya. */
  verifikasi: { tabel: string; syarat: string };
  /** Peringatan/catatan yang perlu dilihat operator sebelum menjalankan langkah. */
  catatan: string[];
  /**
   * Bagian catatan yang menerangkan SIAPA YANG MENANDATANGANI - SK Plh yang
   * tidak terpakai, pimpinan yang berhalangan tanpa Plh, dan sejenisnya.
   *
   * Isinya juga ada di dalam `catatan`; dipisahkan supaya papan ekstensi dapat
   * menempelkannya pada baris penetap tanpa ikut menyalin catatan langkah yang
   * lain - misalnya peringatan tentatif PHS, yang di papan sudah punya
   * kalimatnya sendiri.
   */
  catatanPenetap: string[];
};

export type RencanaPenetapan = {
  ok: boolean;
  nomorPerkara: string;
  perkaraId: string;
  /** Seluruh langkah siap dijalankan tanpa perlu campur tangan lain. */
  bisaDijalankan: boolean;
  /** Hal-hal yang menghalangi, bila belum bisa dijalankan. */
  halangan: string[];
  langkah: LangkahPenetapan[];
};

/**
 * Menormalkan jawaban bot yang bertipe longgar menjadi bentuk yang pasti.
 *
 * Bot menjawab Record<string, unknown>; membiarkannya begitu berarti setiap
 * pembaca menebak-nebak bentuknya. Di sinilah tebakan itu dikurung sekali,
 * dengan nilai bawaan yang aman bila sebuah bagian hilang.
 */
export function normalisasiUsulan(raw: Record<string, unknown> | null | undefined): UsulanPenetapan | null {
  if (!raw || raw.ok === false) return null;

  const pmhRaw = (raw.pmh ?? {}) as Record<string, unknown>;
  const anggota = Array.isArray(pmhRaw.anggota) ? (pmhRaw.anggota as Array<Record<string, unknown>>) : [];
  const idAnggota = anggota
    .map((x) => String(x.hakimId ?? "").trim())
    .filter((x) => x.length > 0);

  const bentukRaw = String(pmhRaw.bentuk ?? "belum-tentu");
  const bentuk = bentukRaw === "majelis" || bentukRaw === "tunggal" ? bentukRaw : "belum-tentu";

  const pppRaw = (raw.ppp ?? {}) as Record<string, unknown>;
  const ppUsulan = (pppRaw.usulan ?? null) as Record<string, unknown> | null;
  // Diisi dari usulan giliran panitera pengganti (paling sedikit beban), sama
  // seperti juru sita. Kosong hanya bila gilirannya tak terbaca - lalu operator
  // memilih dari calon.
  const paniteraId = ppUsulan ? String(ppUsulan.paniteraId ?? ppUsulan.id ?? "").trim() : "";

  const pjsRaw = (raw.pjs ?? {}) as Record<string, unknown>;
  const jsUsulan = (pjsRaw.usulan ?? null) as Record<string, unknown> | null;

  const phsRaw = (raw.phs ?? {}) as Record<string, unknown>;

  // Bot lama belum mengirim bagian ini. Yang benar di situ adalah menganggap
  // majelisnya belum tercatat - PHS kembali ditandai tentatif seperti dulu,
  // bukan memakai usulan seolah-olah ia sudah pasti.
  const tercatatRaw = (raw.tercatat ?? {}) as Record<string, unknown>;
  const ketuaTercatat = String(tercatatRaw.ketuaHakimId ?? "").trim();

  return {
    perkaraId: String(raw.perkaraId ?? "").trim(),
    tanggalPenetapan: String(raw.tanggalPenetapan ?? "").trim(),
    pmh: {
      bentuk,
      majelisKode: String(pmhRaw.majelisKode ?? "").trim(),
      ketuaHakimId: idAnggota[0] ?? "",
      anggotaHakimId: idAnggota.slice(1),
      sebab: String(pmhRaw.sebab ?? "").trim(),
    },
    ppp: { paniteraId, sebab: String(pppRaw.sebab ?? "").trim() },
    pjs: {
      jurusitaId: jsUsulan ? String(jsUsulan.jurusitaId ?? "").trim() : "",
      nama: jsUsulan ? String(jsUsulan.nama ?? "").trim() : "",
      dugaanBerhalangan: Boolean(jsUsulan?.dugaanBerhalangan),
      sebab: String(pjsRaw.sebab ?? "").trim(),
    },
    phs: {
      tanggalSidang: String(phsRaw.usulan ?? "").trim(),
      sebab: String(phsRaw.sebab ?? "").trim(),
    },
    tercatat: {
      // "0" adalah jawaban bot untuk "tidak ada", bukan sebuah hakim_id.
      ada: Boolean(tercatatRaw.ada) && ketuaTercatat !== "" && ketuaTercatat !== "0",
      ketuaHakimId: ketuaTercatat === "0" ? "" : ketuaTercatat,
      ketuaNama: String(tercatatRaw.ketuaNama ?? "").trim(),
    },
  };
}

/** Jabatan yang menandatangani PMH, sebagaimana tercatat di tabel positions. */
export const JABATAN_KETUA = "pos-ketua";

/** Jabatan yang menandatangani PPP dan PJS, di tabel positions yang sama. */
export const JABATAN_PANITERA = "pos-panitera";

export type PilihanPenetap = {
  akun: AkunSiapPakai | null;
  /** Sebutan yang benar untuk yang menandatangani. */
  sebutan: string;
  /** Catatan yang harus terbaca petugas - misalnya SK Plh yang tidak terpakai. */
  catatan: string[];
};

export type KeadaanPejabat = {
  /** Id pengguna ALETA yang sedang cuti pada tanggal penetapan. */
  sedangCuti?: Set<string> | null;
  /** Pemegang PLH/PLT jabatan itu pada tanggal tersebut, bila ada. */
  penunjukan?: { userId: string; tipe: string } | null;
};

/** Nama lama, dari masa ketika hanya pimpinan yang mengenal penugasan. */
export type KeadaanPimpinan = KeadaanPejabat;

/**
 * Siapa yang menandatangani PMH.
 *
 * ============================================================================
 * KETUA - WAKIL - PLH, DALAM URUTAN ITU
 * ============================================================================
 *
 * Wakil Ketua TIDAK perlu diangkat sebagai Plh. Jabatannya sejajar dengan
 * Ketua; ketika Ketua tidak hadir, Wakil mengerjakannya SEBAGAI Wakil Ketua.
 * Menuntut SK Plh untuk itu berarti menuntut surat yang di praktiknya tidak
 * pernah dibuat, dan penetapan berhenti menunggu surat yang tidak akan datang.
 *
 * Plh baru dipakai ketika Ketua DAN Wakil sama-sama tidak ada - yang ditunjuk
 * biasanya seorang Hakim, dan bila hakim pun tidak ada barulah Panitera atau
 * Sekretaris. Karena itu Plh diperiksa PALING AKHIR.
 *
 * "Tidak ada" di sini berarti dua hal sekaligus: tidak punya akun SIPP yang
 * terpakai, ATAU sedang cuti pada tanggal penetapan. Keduanya sama-sama
 * menjadikan tanda tangannya mustahil, dan membedakannya tidak ada gunanya bagi
 * petugas yang sedang menunggu.
 */
export function akunPimpinan(akun: AkunSiapPakai[], keadaan?: KeadaanPimpinan | null): PilihanPenetap {
  const cuti = keadaan?.sedangCuti ?? new Set<string>();
  const penunjukan = keadaan?.penunjukan ?? null;
  const catatan: string[] = [];

  const hidup = (x: AkunSiapPakai) => !x.diblokir && !x.kedaluwarsa;
  const hadir = (x: AkunSiapPakai) => hidup(x) && !(x.pemilikUserId && cuti.has(x.pemilikUserId));

  const pimpinan = akun.filter((x) => x.jabatan === "hakim" && /ketua/i.test(x.grup));

  const ketua = pimpinan.find((x) => x.peranAleta === "ketua" && hadir(x));
  const wakil = pimpinan.find((x) => x.peranAleta === "wakil-ketua" && hadir(x));

  // Penunjukan yang tercatat tetapi tidak terpakai TETAP disebutkan. Diamnya
  // membuat petugas mengira SK-nya tidak terbaca sistem, lalu membatalkannya.
  const sebutPenunjukanTakTerpakai = () => {
    if (penunjukan) {
      catatan.push(
        `${penunjukan.tipe} Ketua tercatat pada tanggal ini, tetapi tidak dipakai karena pimpinan definitif masih dapat menandatangani.`
      );
    }
  };

  if (ketua) {
    sebutPenunjukanTakTerpakai();
    return { akun: ketua, sebutan: "Ketua Pengadilan", catatan };
  }

  if (wakil) {
    sebutPenunjukanTakTerpakai();
    // Sebutannya "Wakil Ketua Pengadilan" apa adanya - bukan "Plh". Ia
    // menandatangani atas jabatannya sendiri.
    return { akun: wakil, sebutan: "Wakil Ketua Pengadilan", catatan };
  }

  // Ketua dan Wakil sama-sama tidak ada. Barulah penunjukan berlaku - dan yang
  // ditunjuk dicari di SELURUH akun, tanpa menyaring grup SIPP-nya: seorang
  // Hakim, Panitera, atau Sekretaris yang ditunjuk Plh tidak akan pernah
  // bergrup "Ketua/Wakil Ketua".
  if (penunjukan) {
    const ditunjuk = akun.find((x) => hidup(x) && x.pemilikUserId === penunjukan.userId);
    if (ditunjuk) {
      return {
        akun: ditunjuk,
        sebutan: `${penunjukan.tipe} Ketua Pengadilan`,
        catatan,
      };
    }
    catatan.push(
      `${penunjukan.tipe} Ketua tercatat pada tanggal ini, tetapi orangnya belum punya akun SIPP yang terpakai.`
    );
  }

  // Tidak ada Ketua, tidak ada Wakil, tidak ada penunjukan yang dapat dipakai.
  // Yang tersisa disebutkan apa adanya supaya halangannya terbaca, bukan
  // diganti diam-diam dengan pimpinan yang sedang cuti.
  const cadangan = pimpinan.find(hidup) ?? null;
  if (cadangan) {
    catatan.push(
      "Ketua dan Wakil Ketua sedang tidak dapat menandatangani, dan belum ada PLH yang tercatat. Terbitkan PLH lebih dulu, atau tunda penetapannya."
    );
  }
  return { akun: cadangan, sebutan: "Ketua Pengadilan", catatan };
}

/**
 * Siapa yang menandatangani PPP dan PJS.
 *
 * ============================================================================
 * PANITERA - PLH. TANPA PERANTARA, DAN ITU DISENGAJA
 * ============================================================================
 *
 * Rantainya lebih pendek daripada rantai pimpinan, dan pendeknya bukan
 * kelalaian. Ketua punya Wakil Ketua yang jabatannya sejajar; PANITERA TIDAK.
 * Panitera Muda dan Panitera Pengganti bukan "wakil panitera" - mereka jabatan
 * lain dengan tugas lain, dan tidak satu pun di antaranya dengan sendirinya
 * berwenang menandatangani PPP ketika Panitera berhalangan.
 *
 * Karena itu bila Panitera tidak ada, yang berlaku HANYA penunjukan PLH/PLT
 * yang tercatat. Menebaknya dari Panitera Muda yang kebetulan punya akun SIPP
 * berarti ALETA mengarang kewenangan - dan penetapan yang lahir dari karangan
 * itu tetap tercatat di SIPP atas nama orang yang tidak pernah ditunjuk.
 *
 * Grup SIPP "Panitera/Wakil Panitera" tidak dapat dipakai membedakan: seluruh
 * pengguna kepaniteraan berbagi grup itu, termasuk yang bukan Panitera. Yang
 * membedakan adalah peran akun ALETA pemiliknya.
 *
 * ============================================================================
 * PEMASANGAN YANG KREDENSIALNYA BELUM DITAUTKAN
 * ============================================================================
 *
 * Di sana tidak ada peran sama sekali, dan akun kepaniteraan pertama dipakai
 * apa adanya - persis seperti sebelum rantai ini ada. Menuntut peran di situ
 * akan mematikan PPP/PJS yang selama ini berjalan, demi penjagaan yang memang
 * tidak dapat ditegakkan tanpa penautan.
 *
 * Yang TIDAK boleh: memakai pengganti itu ketika akun Panitera sudah dikenali
 * tetapi mati - diblokir karena mutasi, misalnya. Di situ kita TAHU siapa
 * Panitera, dan jawabannya bukan "pakai akun kepaniteraan pertama yang ketemu"
 * melainkan mengatakan bahwa akunnya tidak dapat dipakai. Itulah tepatnya cara
 * pemilihan yang lama menggeser tanda tangan tanpa SK.
 */
export function akunPanitera(akun: AkunSiapPakai[], keadaan?: KeadaanPejabat | null): PilihanPenetap {
  const cuti = keadaan?.sedangCuti ?? new Set<string>();
  const penunjukan = keadaan?.penunjukan ?? null;
  const catatan: string[] = [];

  const hidup = (x: AkunSiapPakai) => !x.diblokir && !x.kedaluwarsa;
  const hadir = (x: AkunSiapPakai) => hidup(x) && !(x.pemilikUserId && cuti.has(x.pemilikUserId));

  const kepaniteraan = akun.filter((x) => x.jabatan === "panitera");

  // Akun Panitera dicari pada SELURUH akun kepaniteraan, termasuk yang sudah
  // mati. Mengetahui bahwa akunnya ADA tetapi diblokir adalah keterangan yang
  // menentukan: di situ kita TAHU siapa Panitera, dan justru karena itu tidak
  // boleh menggantinya dengan pegawai kepaniteraan lain.
  const bertanda = kepaniteraan.find((x) => x.peranAleta === "panitera") ?? null;
  const definitif = bertanda && hidup(bertanda) ? bertanda : null;

  // Tidak ada satu pun akun yang tertaut sebagai Panitera berarti penautannya
  // memang belum ada untuk dibaca - bukan berarti Panitera tidak ada. Akun
  // kepaniteraan pertama dipakai apa adanya, seperti sebelum rantai ini ada.
  const panitera = definitif ?? (bertanda ? null : kepaniteraan.find(hidup) ?? null);

  if (panitera && hadir(panitera)) {
    // Penunjukan yang tercatat tetapi tidak terpakai TETAP disebutkan - sama
    // seperti pada pimpinan. Diamnya membuat petugas mengira SK-nya tidak
    // terbaca sistem, lalu membatalkannya.
    if (penunjukan) {
      catatan.push(
        `${penunjukan.tipe} Panitera tercatat pada tanggal ini, tetapi tidak dipakai karena Panitera masih dapat menandatangani.`
      );
    }
    return { akun: panitera, sebutan: "Panitera", catatan };
  }

  // Panitera tidak ada - barulah penunjukan berlaku. Yang ditunjuk dicari di
  // SELURUH akun, tanpa menyaring jabatan SIPP-nya, karena yang menentukan
  // kewenangannya adalah SK-nya, bukan tabel tempat akunnya terdaftar.
  if (penunjukan) {
    const ditunjuk = akun.find((x) => hidup(x) && x.pemilikUserId === penunjukan.userId);
    if (ditunjuk) {
      // Formulir PPP/PJS hanya terbuka bagi pengguna kepaniteraan. SK-nya tetap
      // sah, tetapi akunnya belum tentu sampai ke formulirnya - dan itu lebih
      // baik terbaca sekarang daripada di tengah penetapan.
      if (ditunjuk.jabatan !== "panitera") {
        catatan.push(
          `${penunjukan.tipe} Panitera dijalankan ${ditunjuk.namaLengkap}, yang di SIPP bukan pengguna kepaniteraan - formulir PPP/PJS mungkin tidak terbuka pada akunnya.`
        );
      }
      return { akun: ditunjuk, sebutan: `${penunjukan.tipe} Panitera`, catatan };
    }
    catatan.push(
      `${penunjukan.tipe} Panitera tercatat pada tanggal ini, tetapi orangnya belum punya akun SIPP yang terpakai.`
    );
  }

  // Panitera berhalangan dan tidak ada penunjukan yang dapat dipakai. Yang
  // tersisa disebutkan apa adanya supaya halangannya terbaca - bukan diganti
  // diam-diam dengan Panitera yang sedang cuti, dan bukan pula dengan Panitera
  // Muda yang tidak pernah ditunjuk.
  if (panitera) {
    catatan.push(
      "Panitera sedang tidak dapat menandatangani, dan belum ada PLH Panitera yang tercatat. Terbitkan PLH lebih dulu, atau tunda penetapannya."
    );
  } else if (bertanda) {
    catatan.push(
      `Akun SIPP Panitera "${bertanda.username}" sedang diblokir atau kedaluwarsa, dan belum ada PLH Panitera yang tercatat. Perbarui akunnya di SIPP, atau terbitkan PLH Panitera - PPP/PJS tidak dialihkan sendiri ke pegawai kepaniteraan yang lain.`
    );
  }
  return { akun: panitera, sebutan: "Panitera", catatan };
}

function jadiAkunLangkah(akun: AkunSiapPakai | null, tentatif = false, sebutan = ""): AkunLangkah {
  if (!akun) return null;
  return {
    username: akun.username,
    namaLengkap: akun.namaLengkap,
    grup: akun.grup,
    sebutan,
    siap: akun.siap,
    sebab: akun.sebabBelumSiap,
    tentatif,
  };
}

type PetaMedan = { medan: string; penunjuk: string; jenis: string; wajib: boolean };

/** Mengisi nilai + asal untuk tiap kolom borang, dari usulan. */
function isiMedanPenetapan(
  jenis: JenisLangkah,
  peta: PetaMedan[],
  usulan: UsulanPenetapan,
  dataUmum: Record<string, { nilai: string; asal: string }>
): NilaiMedan[] {
  const kosong = (m: PetaMedan, catatan = ""): NilaiMedan => ({
    ...m,
    nilai: "",
    asal: catatan || "Diisi operator",
  });
  const isi = (m: PetaMedan, nilai: string, asal: string): NilaiMedan => ({ ...m, nilai, asal });

  return peta.map((m) => {
    if (jenis === "data-umum") {
      const d = dataUmum[m.medan];
      return d ? isi(m, d.nilai, d.asal) : kosong(m, "Belum terbaca dari berkas gugatan");
    }

    if (jenis === "pmh") {
      if (m.medan === "tgl_penetapan_majelis") return isi(m, usulan.tanggalPenetapan, "Tanggal penetapan majelis");
      if (m.medan === "pilihan_majelis") {
        if (usulan.pmh.bentuk === "belum-tentu") return kosong(m, "Bentuk majelis belum tentu - " + usulan.pmh.sebab);
        return isi(m, usulan.pmh.bentuk, usulan.pmh.sebab);
      }
      if (m.medan === "hakim_ketua" && usulan.pmh.bentuk === "majelis")
        return isi(m, usulan.pmh.ketuaHakimId, `Ketua Majelis ${usulan.pmh.majelisKode}`);
      if (m.medan === "hakim_tunggal" && usulan.pmh.bentuk === "tunggal")
        return isi(m, usulan.pmh.ketuaHakimId, "Hakim tunggal - " + usulan.pmh.sebab);
      const cocokAnggota = m.medan.match(/^hakim_anggota(\d+)$/);
      if (cocokAnggota && usulan.pmh.bentuk === "majelis") {
        const idx = Number(cocokAnggota[1]) - 1;
        const id = usulan.pmh.anggotaHakimId[idx];
        return id ? isi(m, id, `Anggota Majelis ${usulan.pmh.majelisKode}`) : kosong(m, "Tidak dipakai pada susunan ini");
      }
      return kosong(m);
    }

    if (jenis === "ppp") {
      if (m.medan === "tgl_penunjukan_panitera") return isi(m, usulan.tanggalPenetapan, "Setanggal dengan PMH");
      if (m.medan === "panitera1") {
        return usulan.ppp.paniteraId
          ? isi(m, usulan.ppp.paniteraId, usulan.ppp.sebab)
          : kosong(m, usulan.ppp.sebab || "Panitera pengganti dipilih operator");
      }
      return kosong(m);
    }

    if (jenis === "pjs") {
      if (m.medan === "tgl_penunjukan_juru_sita") return isi(m, usulan.tanggalPenetapan, "Setanggal dengan PMH");
      if (m.medan === "juru_sita1") {
        return usulan.pjs.jurusitaId
          ? isi(m, usulan.pjs.jurusitaId, "Giliran juru sita - " + usulan.pjs.sebab)
          : kosong(m, usulan.pjs.sebab || "Juru sita dipilih operator");
      }
      return kosong(m);
    }

    // phs
    if (m.medan === "tgl_penetapan_sidang_pertama") return isi(m, usulan.tanggalPenetapan, "Setanggal dengan PMH");
    if (m.medan === "tgl_sidang_pertama")
      return usulan.phs.tanggalSidang
        ? isi(m, usulan.phs.tanggalSidang, usulan.phs.sebab)
        : kosong(m, usulan.phs.sebab || "Hari sidang belum dapat dihitung");
    return kosong(m);
  });
}

const VERIFIKASI: Record<JenisLangkah, { tabel: string; syarat: string }> = {
  "data-umum": { tabel: "perkara, perkara_data_pernikahan, perkara_obyek_sengketa", syarat: "ketiga baris terisi" },
  pmh: { tabel: "perkara_hakim_pn, perkara_smartmajelis", syarat: "baris hakim ada, diinput_oleh = akun pimpinan" },
  ppp: { tabel: "perkara_panitera_pn", syarat: "diinput_oleh = akun Panitera" },
  pjs: { tabel: "perkara_jurusita", syarat: "diinput_oleh = akun Panitera" },
  phs: { tabel: "perkara_jadwal_sidang, perkara_penetapan.sidang_pertama", syarat: "baris jadwal baru, diinput_oleh = akun Hakim Ketua" },
};

/**
 * Merakit rencana dari bahan yang sudah terkumpul - fungsi murni, tanpa I/O.
 *
 * Dipisah dari pengambilan datanya supaya dapat diuji langsung: beri usulan,
 * peta medan, dan pemetaan akun, lalu periksa rencananya. Tidak ada peramban,
 * tidak ada SIPP, tidak ada perkara sungguhan yang tersentuh.
 */
export function rakitRencana(args: {
  nomorPerkara: string;
  usulan: UsulanPenetapan;
  petaMedan: Record<string, PetaMedan[]>;
  akunPemetaan: AkunSiapPakai[];
  dataUmum?: Record<string, { nilai: string; asal: string }>;
  /** Keadaan pimpinan pada tanggal penetapan: siapa cuti, siapa ditunjuk PLH. */
  keadaanPimpinan?: KeadaanPejabat | null;
  /**
   * Keadaan Panitera pada tanggal yang sama. Dipisah dari keadaan pimpinan
   * karena penunjukannya memang penunjukan yang lain - PLH Ketua tidak
   * menjadikan siapa pun PLH Panitera. Daftar cutinya boleh sama; ia memang
   * daftar yang sama untuk seluruh pengadilan pada tanggal itu.
   */
  keadaanPanitera?: KeadaanPejabat | null;
}): RencanaPenetapan {
  const { nomorPerkara, usulan, petaMedan, akunPemetaan } = args;
  const dataUmum = args.dataUmum ?? {};

  const pilihan = akunPimpinan(akunPemetaan, args.keadaanPimpinan);
  const pimpinan = pilihan.akun;
  const pilihanPanitera = akunPanitera(akunPemetaan, args.keadaanPanitera);
  const panitera = pilihanPanitera.akun;
  // ------------------------------------------------------------------------
  // PELAKSANA PHS: YANG TERCATAT MENGALAHKAN YANG DIUSULKAN
  // ------------------------------------------------------------------------
  //
  // PHS dikerjakan ketua majelis perkara itu, dengan akunnya sendiri. Selama
  // PMH belum tersimpan, ketuanya memang BELUM ADA - yang ada baru usulan, dan
  // usulan boleh berubah: majelisnya diganti sebelum ditetapkan, hakimnya
  // berhalangan, isbat terpadu memakai susunan lain.
  //
  // Karena itu begitu perkara_hakim_pn terisi, dari sanalah pelaksananya
  // dibaca - dan tanda "tentatif" gugur. Selama belum terisi, tandanya tetap
  // menyala dan yang tertulis di papan disebut apa adanya sebagai dugaan.
  const idKetuaTercatat = usulan.tercatat.ada ? usulan.tercatat.ketuaHakimId : "";
  const idKetuaPhs = idKetuaTercatat || usulan.pmh.ketuaHakimId;
  const phsTentatif = idKetuaTercatat === "";
  const ketuaMajelis = idKetuaPhs ? pilihAkunPejabat(akunPemetaan, "hakim", idKetuaPhs) : null;

  const langkah: LangkahPenetapan[] = URUTAN_LANGKAH.map((jenis, i) => {
    const peta = petaMedan[jenis] ?? [];
    const catatan: string[] = [];

    // Catatan dari pemilihan penetap - di situlah tertulis mengapa yang
    // menandatangani bukan pejabat definitifnya.
    const catatanPenetap: string[] = [];

    let akun: AkunLangkah = null;
    if (JABATAN_LANGKAH[jenis] === "pimpinan") {
      akun = jadiAkunLangkah(pimpinan, false, pilihan.sebutan);
      if (!pimpinan) catatan.push("Belum ada akun SIPP pimpinan (Ketua/Wakil Ketua).");
      for (const c of pilihan.catatan) catatanPenetap.push(c);
    } else if (JABATAN_LANGKAH[jenis] === "panitera") {
      akun = jadiAkunLangkah(panitera, false, pilihanPanitera.sebutan);
      if (!panitera) catatan.push("Belum ada akun SIPP Panitera.");
      for (const c of pilihanPanitera.catatan) catatanPenetap.push(c);
    } else if (JABATAN_LANGKAH[jenis] === "hakim") {
      akun = jadiAkunLangkah(ketuaMajelis, phsTentatif, "Ketua Majelis");
      if (phsTentatif) {
        catatan.push("Akun PHS ini dugaan dari usulan. Dipastikan sendiri dari perkara_hakim_pn begitu PMH tersimpan.");
        if (!ketuaMajelis) catatan.push("Belum ada akun SIPP untuk ketua majelis usulan.");
      } else {
        catatanPenetap.push(
          `Ketua majelis dibaca dari majelis yang tercatat pada perkara ini${
            usulan.tercatat.ketuaNama ? ` - ${usulan.tercatat.ketuaNama}` : ""
          }, bukan dari usulan.`
        );
        if (!ketuaMajelis) {
          catatan.push(
            `Belum ada akun SIPP untuk ketua majelis yang tercatat (hakim_id ${idKetuaPhs}). Akun lamanya mungkin sudah diblokir karena mutasi.`
          );
        }
        // Usulan dan yang tercatat boleh berbeda - penetapan yang menyimpang
        // dari smart majelis memang terjadi, dan itu sah. Yang tidak boleh
        // adalah selisihnya lewat tanpa terbaca, sebab PHS-nya dikerjakan
        // orang yang berbeda dari yang tertulis di papan sebelumnya.
        if (usulan.pmh.ketuaHakimId && usulan.pmh.ketuaHakimId !== idKetuaTercatat) {
          catatanPenetap.push(
            "Majelis yang ditetapkan berbeda dari usulan - PHS mengikuti yang tercatat."
          );
        }
      }
    }

    // Catatan penetap tetap masuk ke catatan langkah - pembaca yang sudah ada
    // membacanya dari sana, dan tidak ada yang perlu tahu pemisahan ini.
    for (const c of catatanPenetap) catatan.push(c);

    if (akun && !akun.siap) catatan.push(akun.sebab);

    return {
      urutan: i + 1,
      jenis,
      sebutan: SEBUTAN[jenis],
      akun,
      medan: isiMedanPenetapan(jenis, peta, usulan, dataUmum),
      verifikasi: VERIFIKASI[jenis],
      catatan,
      catatanPenetap,
    };
  });

  // ---- gerbang kesiapan --------------------------------------------------
  const halangan: string[] = [];
  if (usulan.pmh.bentuk === "belum-tentu") {
    halangan.push(`Bentuk majelis belum tentu: ${usulan.pmh.sebab}`);
  }
  for (const l of langkah) {
    if (l.jenis === "data-umum") continue; // akun operator sendiri
    if ((petaMedan[l.jenis] ?? []).length === 0) {
      halangan.push(`Peta kolom ${l.sebutan} belum diisi.`);
    }
    // Akun tentatif (PHS) tidak menghalangi perakitan - ia diperiksa ulang saat jalan.
    if (l.akun && !l.akun.siap && !l.akun.tentatif) {
      halangan.push(`${l.sebutan}: akun ${l.akun.username} belum siap - ${l.akun.sebab}`);
    }
    // Sudah lewat "continue" untuk data-umum di atas, jadi langkah di sini
    // selalu penetapan - akun kosong berarti pelaksananya memang belum ada.
    if (!l.akun) {
      halangan.push(`${l.sebutan}: akun pelaksananya belum ada.`);
    }
  }

  return {
    ok: true,
    nomorPerkara,
    perkaraId: usulan.perkaraId,
    bisaDijalankan: halangan.length === 0,
    halangan,
    langkah,
  };
}

/**
 * Merakit rencana untuk sebuah perkara: mengambil peta medan dan pemetaan akun
 * dari basis data, lalu menyerahkannya ke rakitRencana.
 *
 * Usulan penetapannya diambil pemanggil dari bot (getGatewayPenunjukanUsulan)
 * lalu dinormalkan dengan normalisasiUsulan - supaya modul ini tidak terikat
 * pada jalur gateway dan tetap mudah diuji.
 */
export async function rencanaUntukPerkara(
  db: AletaDatabase,
  args: {
    nomorPerkara: string;
    usulan: UsulanPenetapan;
    dataUmum?: Record<string, { nilai: string; asal: string }>;
  }
): Promise<RencanaPenetapan> {
  const pemetaan = await bacaPemetaanJabatan(db);
  if (!pemetaan.ok) {
    return {
      ok: false,
      nomorPerkara: args.nomorPerkara,
      perkaraId: args.usulan.perkaraId,
      bisaDijalankan: false,
      halangan: [`Pemetaan jabatan tidak terbaca: ${pemetaan.galat}`],
      langkah: [],
    };
  }

  const petaMedan: Record<string, PetaMedan[]> = {};
  for (const jenis of URUTAN_LANGKAH) {
    const rows = await bacaPetaMedan(db, jenis);
    petaMedan[jenis] = rows.map((r) => ({
      medan: r.medan,
      penunjuk: r.penunjuk,
      jenis: r.jenis,
      wajib: r.wajib,
    }));
  }

  // Penugasan dibaca pada TANGGAL PENETAPAN, bukan pada hari ini: rencana yang
  // dirakit untuk penetapan bertanggal mundur harus menyebut siapa yang
  // berwenang pada tanggal itu.
  //
  // Penunjukan Ketua dan penunjukan Panitera dibaca TERPISAH. PLH Ketua tidak
  // menjadikan siapa pun PLH Panitera - keduanya SK yang berbeda, untuk jabatan
  // yang berbeda, dan tidak jarang hanya salah satunya yang ada.
  const tanggal = args.usulan.tanggalPenetapan || new Date().toISOString().slice(0, 10);
  const [penunjukan, penunjukanPanitera, sedangCuti] = await Promise.all([
    pejabatBertugas(db, JABATAN_KETUA, tanggal),
    pejabatBertugas(db, JABATAN_PANITERA, tanggal),
    yangSedangCuti(db, tanggal),
  ]);

  return rakitRencana({
    nomorPerkara: args.nomorPerkara,
    usulan: args.usulan,
    petaMedan,
    akunPemetaan: pemetaan.akun,
    dataUmum: args.dataUmum,
    keadaanPimpinan: { penunjukan, sedangCuti },
    keadaanPanitera: { penunjukan: penunjukanPanitera, sedangCuti },
  });
}
