/**
 * PEMERIKSAAN KELENGKAPAN - diadu sebelum dicetak, bukan sesudah.
 *
 * ============================================================================
 * YANG DIPERIKSA HANYA YANG BENAR-BENAR DAPAT DIPERIKSA
 * ============================================================================
 *
 * Pedoman Penyusunan BAS & Putusan Badilag masih berupa berkas PDF di folder
 * APS Badilag dan BELUM terbaca ALETA - itu pekerjaan Tahap 3. Modul ini
 * TIDAK berpura-pura sudah membacanya.
 *
 * Yang diperiksa di sini hanyalah yang dapat dipastikan dari bahan yang sudah
 * ada: penanda yang tersisa pada blangko, kelengkapan lembar saksi, jumlah
 * saksi yang dituntut blangko itu sendiri, dan sidang yang belum tercatat.
 * Pemeriksaan yang mengaku menegakkan pedoman padahal hanya memeriksa
 * kekosongan jauh lebih berbahaya daripada tidak ada pemeriksaan sama sekali:
 * yang membacanya akan berhenti memeriksa sendiri.
 *
 * ============================================================================
 * TIGA TINGKAT, DAN TIDAK SATU PUN MENGHALANGI UNDUHAN
 * ============================================================================
 *
 * Panitera kadang memang perlu mencetak naskah yang belum lengkap - untuk
 * dibawa ke ruang sidang dan diisi tangan. Yang dikerjakan pemeriksaan ini
 * adalah MEMBERI TAHU, bukan melarang. Alat yang melarang pada saat yang
 * salah akan ditinggalkan, dan yang ditinggalkan tidak memeriksa apa pun.
 */

export type TingkatTemuan = "halangan" | "peringatan" | "catatan";

export type Temuan = {
  tingkat: TingkatTemuan;
  hal: string;
  keterangan: string;
  /** Apa yang harus dikerjakan petugas - kosong bila tidak ada tindakan jelas. */
  tindakan: string;
};

export type LembarRingkas = {
  saksiKe: number;
  saksiNama: string;
  saksiUmur: string;
  saksiAgama: string;
  jumlahPertanyaan: number;
  jumlahTerjawab: number;
};

export type BahanPeriksa = {
  /** Penanda yang masih tersisa pada naskah setelah semuanya diisi. */
  tersisa: string[];
  /** Nama variabel ABT untuk penanda itu, supaya temuannya terbaca. */
  namaPenanda: Record<string, string>;
  /** Seluruh penanda yang ada di blangko - untuk mengetahui apa yang dituntutnya. */
  penandaBlangko: string[];
  lembar: LembarRingkas[];
  /** Nama berkas blangko - memuat "(3 Saksi)" dan sejenisnya. */
  namaBlangko: string;
  /** Sidang yang blangkonya dipilih, 0 bila blangko ini bukan BAS. */
  nomorSidang: number;
  /** Sidang itu tercatat di SIPP atau belum. */
  sidangTercatat: boolean;
  /** Kehadiran para pihak sudah dicatat panitera atau belum. */
  kehadiranTercatat: boolean;
  /** Blangko ini memuat penanda kehadiran (#1072#/#1073#) atau tidak. */
  blangkoMenanyakanKehadiran: boolean;
  /** Selisih antar sumber yang sudah ditemukan saat berkas dirakit. */
  selisih: Array<{ hal: string; keterangan: string }>;
};

/** Penanda tempat tanya-jawab tiap saksi - dari abt_variabel, bukan karangan. */
const PENANDA_TANYA_JAWAB: Record<string, number> = { "5058": 1, "5059": 2 };

/** Penanda sumpah saksi, yang lafalnya bergantung agama saksi. */
const PENANDA_SUMPAH: Record<string, number> = { "7029": 1, "7030": 2 };

function namaAtauNomor(noVar: string, nama: Record<string, string>): string {
  const terbaca = String(nama[noVar] ?? "").trim();
  return terbaca || `penanda ${noVar}`;
}

/**
 * Berapa saksi yang dituntut blangko ini.
 *
 * Dua sumber, dan yang terbesar yang dipakai: nama berkasnya sendiri sering
 * menyebut "(3 Saksi)", dan isinya menyediakan tempat tanya-jawab per saksi.
 * Mengambil yang terkecil berarti kekurangan saksi lolos tanpa disebut.
 */
export function saksiDituntut(namaBlangko: string, penandaBlangko: string[]): number {
  const dariNama = namaBlangko.match(/\((\d+)\s*saksi\)/i);
  const dariPenanda = penandaBlangko.reduce(
    (paling, noVar) => Math.max(paling, PENANDA_TANYA_JAWAB[noVar] ?? 0),
    0
  );
  return Math.max(dariNama ? Number(dariNama[1]) : 0, dariPenanda);
}

/**
 * Memeriksa kesiapan satu naskah sebelum diunduh.
 *
 * Urutannya disengaja: halangan lebih dulu, lalu peringatan, lalu catatan.
 * Daftar yang mencampur keduanya menuntut pembacanya menilai sendiri mana yang
 * penting - dan daftar yang menuntut penilaian akan dibaca sekilas lalu
 * dilewati.
 */
export function periksaKesiapan(bahan: BahanPeriksa): Temuan[] {
  const temuan: Temuan[] = [];
  const lembar = [...bahan.lembar].sort((a, b) => a.saksiKe - b.saksiKe);

  // --- Saksi ---
  const dituntut = saksiDituntut(bahan.namaBlangko, bahan.penandaBlangko);
  const terisi = lembar.filter((item) => item.jumlahTerjawab > 0);

  if (dituntut > 0 && terisi.length < dituntut) {
    temuan.push({
      tingkat: "halangan",
      hal: "Keterangan saksi belum lengkap",
      keterangan: `Blangko ini menyediakan tempat untuk ${dituntut} saksi, sementara yang sudah terisi ${terisi.length}.`,
      tindakan: "Isi lembar tanya-jawab untuk saksi yang belum ada.",
    });
  }

  for (const item of lembar) {
    if (item.jumlahTerjawab === 0) continue;

    const kurang: string[] = [];
    if (!item.saksiNama) kurang.push("nama");
    if (!item.saksiUmur) kurang.push("umur");
    if (!item.saksiAgama) kurang.push("agama");

    if (kurang.length > 0) {
      temuan.push({
        tingkat: "halangan",
        hal: `Jati diri saksi ke-${item.saksiKe} belum lengkap`,
        keterangan: `Belum terisi: ${kurang.join(", ")}.`,
        tindakan: "Lengkapi pada lembar tanya-jawab saksi ke-" + item.saksiKe + ".",
      });
    }

    // Lafal sumpah mengikuti agama saksi. Blangko yang memuat penanda sumpah
    // tetapi agamanya kosong akan dicetak dengan sumpah yang belum dipilih.
    const penandaSumpah = Object.entries(PENANDA_SUMPAH).find(([, ke]) => ke === item.saksiKe)?.[0];
    if (penandaSumpah && bahan.penandaBlangko.includes(penandaSumpah) && !item.saksiAgama) {
      temuan.push({
        tingkat: "peringatan",
        hal: `Lafal sumpah saksi ke-${item.saksiKe} belum dapat ditentukan`,
        keterangan: "Blangko ini memuat sumpah saksi, dan lafalnya mengikuti agama saksi yang belum terisi.",
        tindakan: "Isi agama saksi pada lembarnya.",
      });
    }

    if (item.jumlahTerjawab < item.jumlahPertanyaan) {
      temuan.push({
        tingkat: "peringatan",
        hal: `Pertanyaan saksi ke-${item.saksiKe} belum semua terjawab`,
        keterangan: `${item.jumlahTerjawab} dari ${item.jumlahPertanyaan} pertanyaan sudah dijawab.`,
        tindakan: "Lanjutkan pengisian lembarnya, atau abaikan bila pertanyaan itu memang tidak diajukan.",
      });
    }
  }

  // --- Kehadiran ---
  //
  // Diperiksa hanya bila blangkonya memang menanyakannya. Blangko putusan
  // tidak memuat penanda kehadiran, dan memperingatkan kekosongan yang memang
  // tidak diminta hanya menambah bunyi pada daftar yang harus dibaca.
  if (bahan.blangkoMenanyakanKehadiran && !bahan.kehadiranTercatat) {
    temuan.push({
      tingkat: "halangan",
      hal: "Kehadiran para pihak belum dicatat",
      keterangan:
        "Blangko ini menanyakan siapa yang hadir, dan SIPP hanya mencatat jumlahnya - tidak menyebut Penggugat sendiri, kuasanya, atau keduanya.",
      tindakan: "Catat kehadiran pada kartu Sidang Hari Ini.",
    });
  }

  // --- Sidang ---
  if (bahan.nomorSidang > 0 && !bahan.sidangTercatat) {
    temuan.push({
      tingkat: "peringatan",
      hal: `Sidang ke-${bahan.nomorSidang} belum tercatat di SIPP`,
      keterangan: "Hari dan tanggal sidang tidak dapat diisi dari SIPP, sehingga tetap bertanda pada naskah.",
      tindakan: "Catat jadwal sidangnya di SIPP, lalu unduh ulang.",
    });
  }

  // --- Selisih antar sumber ---
  for (const item of bahan.selisih) {
    temuan.push({
      tingkat: "peringatan",
      hal: item.hal,
      keterangan: item.keterangan,
      tindakan: "Periksa sumbernya sebelum naskah ditandatangani.",
    });
  }

  // --- Penanda tersisa ---
  if (bahan.tersisa.length > 0) {
    const nama = bahan.tersisa.slice(0, 6).map((noVar) => namaAtauNomor(noVar, bahan.namaPenanda));
    const sisanya = bahan.tersisa.length - nama.length;
    temuan.push({
      tingkat: "catatan",
      hal: `${bahan.tersisa.length} bagian masih perlu Anda isi sendiri`,
      keterangan: nama.join(", ") + (sisanya > 0 ? `, dan ${sisanya} lainnya` : "") + ".",
      tindakan: "Bagian ini tetap bertanda pada naskah, dan diisi di Word.",
    });
  }

  const urutan: Record<TingkatTemuan, number> = { halangan: 0, peringatan: 1, catatan: 2 };
  return temuan.sort((a, b) => urutan[a.tingkat] - urutan[b.tingkat]);
}

/** Kalimat pendek untuk kepala kartu - tanpa menyebut angka yang tidak berarti. */
export function ringkasPemeriksaan(temuan: Temuan[]): string {
  const halangan = temuan.filter((item) => item.tingkat === "halangan").length;
  const peringatan = temuan.filter((item) => item.tingkat === "peringatan").length;

  if (halangan > 0) return `${halangan} hal perlu dibereskan sebelum naskah ini ditandatangani.`;
  if (peringatan > 0) return `${peringatan} hal perlu Anda periksa.`;
  return "Tidak ada yang menghalangi. Bagian yang tersisa memang diisi tangan.";
}
