/**
 * AMAR DIADU DENGAN PETITUM (F4).
 *
 * ============================================================================
 * YANG DIPERIKSA BUKAN "ADAKAH AMAR", MELAINKAN "ADAKAH YANG TIDAK TERJAWAB"
 * ============================================================================
 *
 * Amar wajib menjawab seluruh petitum, tidak kurang dan tidak lebih. Dua
 * kekeliruannya punya nama sendiri karena keduanya membatalkan putusan:
 *
 *   - infra petita  - ada tuntutan yang tidak dijawab sama sekali; dan
 *   - ultra petita  - ada yang dikabulkan padahal tidak pernah dituntut.
 *
 * Keduanya hampir tidak terlihat pada naskah yang rapi. Petitum keenam yang
 * terlewat tidak meninggalkan bekas apa pun di halaman - yang tampak hanyalah
 * amar berisi lima butir yang seluruhnya benar. Justru karena tidak
 * meninggalkan bekas itulah pemeriksaan ini dikerjakan mesin: ia menghitung
 * yang tidak ada, dan manusia membaca yang ada.
 *
 * ============================================================================
 * PADANAN YANG RAGU DINYATAKAN RAGU, BUKAN DIPUTUSKAN
 * ============================================================================
 *
 * Pemadanan di sini menghitung kata yang sama, bukan memahami kalimat. Itu
 * cukup untuk petitum yang memang dikutip ulang di amar - dan memang begitu
 * kebiasaannya. Untuk sisanya, ambang sengaja dibuat tinggi: padanan yang
 * lemah dilaporkan sebagai TIDAK berpadanan.
 *
 * Salah arah yang dipilih di sini disengaja. Petitum yang sebenarnya terjawab
 * tetapi dilaporkan belum akan dibaca petugas, dicocokkan, lalu dilewati -
 * biayanya satu menit. Petitum yang sebenarnya terlewat tetapi dilaporkan
 * terjawab akan lolos sampai ke tangan pembanding.
 *
 * ============================================================================
 * TIDAK ADA AMAR YANG DIKARANG DI BERKAS INI
 * ============================================================================
 *
 * Amar datang dari templat, dan templat datang dari SIPP. Bila tidak ada
 * templat yang cocok, hasilnya kosong beserta sebabnya - bukan kalimat amar
 * yang disusun sendiri. Mesin yang boleh mengarang amar adalah mesin yang
 * boleh memutus.
 */

export type Petitum = {
  nomor: number;
  teks: string;
};

export type ButirAmar = {
  nomor: number;
  teks: string;
  /** Diisi bila templat sudah menyebut petitum mana yang dijawabnya. */
  petitumKe?: number;
};

export type Keadaan = "dikabulkan" | "ditolak" | "tidakDiterima" | "takDikenali";

export type Padanan = {
  petitum: Petitum;
  amar: ButirAmar | null;
  keadaan: Keadaan;
  /** 0..1 - bagian kata isi petitum yang muncul kembali di amar. */
  skor: number;
  /** true bila padanan datang dari petitumKe, bukan dari hitungan kata. */
  disebutTemplat: boolean;
};

export type HasilAduan = {
  padanan: Padanan[];
  /** Petitum pokok tanpa amar - infra petita bila naskah tetap dicetak. */
  belumTerjawab: Petitum[];
  /** Amar tanpa petitum - ultra petita bila bukan amar baku. */
  amarTanpaPetitum: ButirAmar[];
  /** Petitum subsidair; tidak menuntut amar tersendiri. */
  subsidair: Petitum[];
  halangan: string[];
};

/**
 * Kata yang dibuang sebelum kemiripan dihitung.
 *
 * Isinya hanya dua macam: kata sambung, dan KATA KERJA AMAR. Kata kerja
 * dibuang karena ia menyatakan KEADAAN, bukan pokok yang dituntut -
 * "Mengabulkan gugatan" dan "Menolak gugatan" menjawab petitum yang SAMA,
 * dan yang membedakannya dibaca bacaKeadaan, bukan pemadan ini.
 *
 * Nama pihak dan kata "gugatan" sengaja TIDAK dibuang, meskipun muncul di
 * hampir semua petitum. Membuangnya pernah dicoba dan menghasilkan cacat yang
 * hanya terlihat lewat uji: petitum pertama yang lazim - "Mengabulkan gugatan
 * Penggugat seluruhnya" - kehilangan seluruh katanya, skornya menjadi nol,
 * dan ia dilaporkan terlewat pada hampir setiap perkara. Laporan palsu yang
 * muncul di setiap perkara lebih buruk daripada tidak ada laporan: ia
 * mengajari petugas melewati daftar halangan.
 *
 * Yang menjaga kata umum agar tidak memadankan sembarangan bukan daftar ini,
 * melainkan AMBANG_SKOR - yang dihitung sebagai bagian dari kata petitum itu
 * sendiri, sehingga satu kata yang kebetulan sama tidak pernah cukup.
 */
const KATA_UMUM = new Set([
  "bahwa", "yang", "dan", "atau", "untuk", "dengan", "dari", "pada", "atas", "oleh",
  "ini", "itu", "adalah", "kepada", "dalam", "para", "serta", "agar", "telah", "akan",
  "tersebut", "sebagai", "secara", "menurut", "guna", "maka", "terhadap", "di", "ke", "se",
  "mengabulkan", "menolak", "menyatakan", "menghukum", "memerintahkan", "menetapkan",
  "menjatuhkan",
]);

/** Ambang padanan. Di bawahnya, padanan dinyatakan tidak ada. */
const AMBANG_SKOR = 0.5;
const AMBANG_KATA = 2;

function kataIsi(teks: string): string[] {
  return String(teks ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((kata) => kata.length > 2 && !KATA_UMUM.has(kata));
}

/** Petitum subsidair tidak menuntut amar tersendiri, dan tidak boleh dihitung terlewat. */
export function adalahSubsidair(teks: string): boolean {
  const isi = String(teks ?? "").toLowerCase();
  return (
    /seadil[- ]?adilnya/.test(isi) ||
    /ex\s*aequo\s*et\s*bono/.test(isi) ||
    /\bsubsidair\b/.test(isi) ||
    /putusan\s+yang\s+seadil/.test(isi)
  );
}

/**
 * Keadaan dibaca dari kata kerja amarnya sendiri.
 *
 * "tidak dapat diterima" diperiksa LEBIH DULU daripada "menolak", karena
 * kalimatnya kerap memuat keduanya dan yang menentukan adalah yang pertama.
 */
export function bacaKeadaan(teksAmar: string): Keadaan {
  const isi = String(teksAmar ?? "").toLowerCase();
  if (/tidak\s+dapat\s+diterima|niet\s*ontvankelijk/.test(isi)) return "tidakDiterima";
  if (/^\s*menolak\b|\bmenolak\s+(gugatan|permohonan|selebihnya)/.test(isi)) return "ditolak";
  if (/mengabulkan|menyatakan|menghukum|memerintahkan|menetapkan/.test(isi)) return "dikabulkan";
  return "takDikenali";
}

function skorPadanan(petitum: string, amar: string): number {
  const kataPetitum = kataIsi(petitum);
  if (!kataPetitum.length) return 0;
  const kataAmar = new Set(kataIsi(amar));
  const sama = kataPetitum.filter((kata) => kataAmar.has(kata));
  if (sama.length < AMBANG_KATA) return 0;
  return sama.length / kataPetitum.length;
}

/**
 * Mengadu petitum dengan amar.
 *
 * Satu butir amar hanya boleh menjawab satu petitum. Tanpa aturan itu, satu
 * amar bertele-tele dapat "menjawab" lima petitum sekaligus dan seluruh
 * pemeriksaan kehilangan gunanya.
 */
export function adukan(petitum: Petitum[], amar: ButirAmar[]): HasilAduan {
  const daftarPetitum = [...(petitum ?? [])].sort((a, b) => a.nomor - b.nomor);
  const daftarAmar = [...(amar ?? [])].sort((a, b) => a.nomor - b.nomor);
  const terpakai = new Set<number>();
  const padanan: Padanan[] = [];
  const subsidair: Petitum[] = [];
  const belumTerjawab: Petitum[] = [];

  for (const butir of daftarPetitum) {
    if (adalahSubsidair(butir.teks)) {
      subsidair.push(butir);
      continue;
    }

    const disebut = daftarAmar.find(
      (item) => Number(item.petitumKe) === butir.nomor && !terpakai.has(item.nomor)
    );
    if (disebut) {
      terpakai.add(disebut.nomor);
      padanan.push({
        petitum: butir,
        amar: disebut,
        keadaan: bacaKeadaan(disebut.teks),
        skor: 1,
        disebutTemplat: true,
      });
      continue;
    }

    let terbaik: ButirAmar | null = null;
    let skorTerbaik = 0;
    for (const item of daftarAmar) {
      if (terpakai.has(item.nomor)) continue;
      const skor = skorPadanan(butir.teks, item.teks);
      if (skor > skorTerbaik) {
        skorTerbaik = skor;
        terbaik = item;
      }
    }

    if (terbaik && skorTerbaik >= AMBANG_SKOR) {
      terpakai.add(terbaik.nomor);
      padanan.push({
        petitum: butir,
        amar: terbaik,
        keadaan: bacaKeadaan(terbaik.teks),
        skor: skorTerbaik,
        disebutTemplat: false,
      });
    } else {
      belumTerjawab.push(butir);
      padanan.push({
        petitum: butir,
        amar: null,
        keadaan: "takDikenali",
        skor: skorTerbaik,
        disebutTemplat: false,
      });
    }
  }

  const amarTanpaPetitum = daftarAmar.filter((item) => !terpakai.has(item.nomor) && !amarBaku(item.teks));

  const halangan: string[] = [];
  for (const butir of belumTerjawab) {
    halangan.push(`Petitum ${butir.nomor} belum terjawab amar: "${ringkas(butir.teks)}".`);
  }
  for (const butir of amarTanpaPetitum) {
    halangan.push(`Amar ${butir.nomor} tidak menjawab satu pun petitum: "${ringkas(butir.teks)}".`);
  }
  if (!daftarPetitum.length) halangan.push("Petitum belum tercatat, sehingga amar tidak dapat diperiksa.");
  if (!daftarAmar.length) halangan.push("Amar belum tersusun.");

  return { padanan, belumTerjawab, amarTanpaPetitum, subsidair, halangan };
}

/**
 * Amar baku yang memang tidak menjawab petitum tertentu.
 *
 * Biaya perkara dijatuhkan karena undang-undang, bukan karena diminta - maka
 * kehadirannya tanpa petitum bukan ultra petita. Daftarnya sengaja pendek:
 * tiap tambahan di sini adalah satu hal yang berhenti diperiksa.
 */
function amarBaku(teks: string): boolean {
  const isi = String(teks ?? "").toLowerCase();
  return /biaya\s+perkara/.test(isi);
}

function ringkas(teks: string): string {
  const isi = String(teks ?? "").trim().replace(/\s+/g, " ");
  return isi.length > 90 ? `${isi.slice(0, 87)}...` : isi;
}

export type TemplatAmar = {
  id: string;
  nama: string;
  jenisPerkara: string;
  /** "dikabulkan", "ditolak", "tidakDiterima", atau kosong untuk semua. */
  keadaan: string;
  aktif: boolean;
  isi: string;
};

export type PilihanTemplat = {
  templat: TemplatAmar | null;
  sebab: string;
};

/**
 * Memilih templat amar.
 *
 * Templat yang tidak aktif tidak dipakai meskipun ia satu-satunya yang cocok.
 * Templat dimatikan karena ada yang salah padanya, dan "satu-satunya yang ada"
 * bukan alasan untuk memakai yang sudah dinyatakan tidak boleh dipakai.
 */
export function pilihTemplatAmar(
  daftar: TemplatAmar[],
  fakta: { jenisPerkara: string; keadaan: string }
): PilihanTemplat {
  const aktif = (daftar ?? []).filter((item) => item.aktif);
  if (!aktif.length) {
    return { templat: null, sebab: "Tidak ada satu pun templat amar yang aktif di SIPP." };
  }

  const jenis = String(fakta.jenisPerkara ?? "").trim().toLowerCase();
  const keadaan = String(fakta.keadaan ?? "").trim().toLowerCase();

  const seJenis = aktif.filter((item) => item.jenisPerkara.trim().toLowerCase() === jenis);
  if (!seJenis.length) {
    return { templat: null, sebab: `Tidak ada templat amar untuk jenis perkara "${fakta.jenisPerkara}".` };
  }

  const cocok = seJenis.filter((item) => {
    const punya = item.keadaan.trim().toLowerCase();
    return !punya || punya === keadaan;
  });
  if (!cocok.length) {
    return { templat: null, sebab: `Tidak ada templat amar "${fakta.keadaan}" untuk ${fakta.jenisPerkara}.` };
  }

  // Yang menyebut keadaannya dipilih lebih dulu daripada yang berlaku umum.
  const khusus = cocok.filter((item) => item.keadaan.trim());
  const pilih = (khusus.length ? khusus : cocok).sort((a, b) => a.nama.localeCompare(b.nama));

  if (pilih.length > 1) {
    return {
      templat: pilih[0],
      sebab: `${pilih.length} templat sama-sama cocok; dipakai "${pilih[0].nama}". Periksa sebelum ditandatangani.`,
    };
  }
  return { templat: pilih[0], sebab: "" };
}
