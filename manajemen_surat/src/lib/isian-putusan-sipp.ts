import { pecahNaskahPutusan } from "@/lib/susunan-putusan";

/**
 * ============================================================================
 * ISIAN BORANG PUTUSAN SIPP - DISUSUN DI SINI, DIISIKAN EKSTENSI
 * ============================================================================
 *
 * Borang Putusan Akhir SIPP menuntut potongan yang terpisah-pisah:
 * Pertimbangan Hukum, Amar, Amar Anonim, status putusan, verstek, dan sumber
 * hukum. Draf ALETA menyimpannya sebagai satu naskah utuh.
 *
 * Berkas ini yang menjembatani keduanya, dan ia sengaja berada di portal -
 * bukan di dalam ekstensi. Ekstensi berjalan di halaman SIPP, di peramban
 * petugas, tanpa satu pun uji yang dapat menjalankannya; yang di sini diuji
 * tiap kali pemeriksaan berkala berjalan. Ekstensi hanya mengisi apa yang
 * sudah diputuskan di sini.
 *
 * ============================================================================
 * YANG TIDAK DIKERJAKAN DI SINI, DAN SEBABNYA
 * ============================================================================
 *
 * Tidak ada nomor status putusan yang ditulis tetap. Daftar pilihan pada
 * borang SIPP sudah disaring SIPP sendiri menurut jenis perkara dan alur
 * perkaranya - 132 baris status_putusan, hanya sebagian yang sah untuk satu
 * perkara. Ekstensi mencocokkan pada pilihan yang benar-benar ada di halaman,
 * dan berkas ini hanya menyebut NAMANYA. Menghafal nomornya di sini berarti
 * menebak apa yang sudah diketahui halamannya.
 *
 * Tombol Simpan tidak pernah ditekan. Yang disusun di sini usulan isian;
 * yang menandatangani putusan tetap manusia.
 */

export type PihakPerkara = {
  nama: string;
  /** 1 = penggugat/pemohon, 2 = tergugat/termohon. */
  pihakKe: number | null;
  /** "pihak" atau "kuasa". */
  jenis?: string;
};

export type IsianPutusanSipp = {
  /** Pertimbangan hukum, untuk CKEditor "perhum". */
  pertimbangan: string;
  /** Amar putusan, untuk CKEditor "amar". */
  amar: string;
  /** Amar yang sudah disamarkan namanya, untuk CKEditor "amar_anonim". */
  amarAnonim: string;
  /** Nama pihak yang disamarkan, supaya petugas dapat memeriksanya. */
  namaDisamarkan: Array<{ nama: string; menjadi: string }>;
  /** Keterangan yang harus dibaca petugas sebelum mengisi. */
  catatan: string[];
  /** Bagian wajib yang belum ada isinya pada draf. */
  belumTerisi: string[];
};

function bersih(nilai: unknown): string {
  return String(nilai ?? "").trim();
}

/**
 * Jenis perkara yang beracara sebagai PERMOHONAN.
 *
 * "Cerai talak" ada di dalamnya dan itu bukan kelalaian penulisan: di
 * Pengadilan Agama, suami mengajukan PERMOHONAN izin mengucapkan ikrar talak,
 * sehingga para pihaknya Pemohon dan Termohon - bukan Penggugat dan Tergugat.
 * Cerai gugat sebaliknya, dan karena itu "cerai" saja tidak pernah dijadikan
 * penanda di sini.
 *
 * Menyebutnya keliru pada amar anonim bukan sekadar salah kata: ia mengubah
 * jenis perkaranya di mata siapa pun yang membaca putusan itu kelak di
 * Direktori Putusan.
 */
const POLA_PERMOHONAN =
  /permohonan|cerai\s*talak|itsbat|isbat|dispensasi|wali\s*adhal|poligami|asal.?usul|perwalian|pengangkatan|penetapan ahli waris|p3hp/i;

/**
 * Sebutan acara untuk satu pihak.
 *
 * Perkara permohonan memakai Pemohon/Termohon, gugatan memakai
 * Penggugat/Tergugat. Salah menyebutnya pada amar anonim bukan sekadar salah
 * kata: ia mengubah jenis perkaranya di mata yang membaca.
 */
export function sebutanPihak(pihakKe: number | null | undefined, jenisPerkara: string, jenis?: string): string {
  const permohonan = POLA_PERMOHONAN.test(bersih(jenisPerkara));
  const pokok = Number(pihakKe) === 2 ? (permohonan ? "Termohon" : "Tergugat") : permohonan ? "Pemohon" : "Penggugat";
  return bersih(jenis).toLowerCase() === "kuasa" ? `Kuasa ${pokok}` : pokok;
}

/** Memasang tanda pelarian untuk dipakai di dalam ekspresi reguler. */
function lolos(teks: string): string {
  return teks.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Mengganti nama para pihak dengan sebutan acaranya.
 *
 * ============================================================================
 * YANG PANJANG LEBIH DULU
 * ============================================================================
 *
 * "SITI AMINAH" dan "SITI" dapat sama-sama muncul sebagai nama pihak. Bila
 * yang pendek diganti lebih dulu, sisa "AMINAH" tertinggal di naskah dan
 * anonimisasinya bocor pada nama yang justru paling mudah dikenali. Karena itu
 * nama diurutkan dari yang terpanjang.
 *
 * ============================================================================
 * INI BUKAN JAMINAN
 * ============================================================================
 *
 * Yang diganti hanya nama yang DIKETAHUI dari SIPP. Nama saksi, nama anak,
 * alamat, dan nomor identitas yang kebetulan tertulis di dalam amar tidak
 * ikut tersamar. Karena itu hasilnya selalu disertai catatan, dan petugas
 * tetap membacanya sebelum menekan Simpan. Menyebutnya "sudah anonim" tanpa
 * dibaca manusia adalah cara paling rapi untuk menerbitkan nama orang.
 */
export function anonimkanAmar(
  amar: string,
  pihak: PihakPerkara[],
  jenisPerkara = ""
): { teks: string; diganti: Array<{ nama: string; menjadi: string }> } {
  const teks = bersih(amar);
  if (!teks) return { teks: "", diganti: [] };

  const daftar = (Array.isArray(pihak) ? pihak : [])
    .map((satu) => ({ nama: bersih(satu?.nama), pihakKe: satu?.pihakKe ?? null, jenis: bersih(satu?.jenis) }))
    .filter((satu) => satu.nama.length >= 3)
    .sort((a, b) => b.nama.length - a.nama.length);

  let hasil = teks;
  const diganti: Array<{ nama: string; menjadi: string }> = [];

  for (const satu of daftar) {
    const menjadi = sebutanPihak(satu.pihakKe, jenisPerkara, satu.jenis);
    // Batas kata di kedua ujung: tanpa itu, nama yang kebetulan menjadi
    // bagian kata lain ikut terganti.
    const pola = new RegExp(`(^|[^A-Za-z])(${lolos(satu.nama)})(?=[^A-Za-z]|$)`, "gi");
    if (!pola.test(hasil)) continue;
    pola.lastIndex = 0;
    hasil = hasil.replace(pola, (_cocok, depan) => `${depan}${menjadi}`);
    diganti.push({ nama: satu.nama, menjadi });
  }

  return { teks: hasil, diganti };
}

/**
 * Menyusun usulan isian borang putusan SIPP dari draf ALETA.
 *
 * Bagian yang kosong pada draf dikembalikan kosong dan disebut pada
 * belumTerisi - bukan diisi kalimat penambal. Borang putusan yang terisi
 * kalimat penambal akan tersimpan dan tercetak persis seperti itu.
 */
export function susunIsianPutusanSipp(masukan: {
  naskah: string;
  pihak?: PihakPerkara[];
  jenisPerkara?: string;
  /** Keadaan draf; hanya yang sudah ditandatangani yang dianggap siap. */
  keadaanDraf?: string;
}): IsianPutusanSipp {
  const bagian = pecahNaskahPutusan(masukan.naskah || "");
  const pertimbangan = bersih(bagian.pertimbangan);
  const amar = bersih(bagian.amar);
  const jenisPerkara = bersih(masukan.jenisPerkara);
  const { teks: amarAnonim, diganti } = anonimkanAmar(amar, masukan.pihak ?? [], jenisPerkara);

  const catatan: string[] = [];
  const belumTerisi: string[] = [];

  if (!pertimbangan) belumTerisi.push("Pertimbangan hukum");
  if (!amar) belumTerisi.push("Amar putusan");

  const keadaan = bersih(masukan.keadaanDraf).toLowerCase();
  if (keadaan && keadaan !== "ditandatangani") {
    catatan.push(
      `Draf ini berkeadaan "${keadaan}", belum ditandatangani. Isinya boleh dipakai sebagai bahan, tetapi yang tersimpan di SIPP menjadi putusan resmi.`
    );
  }

  if (amar && diganti.length === 0) {
    catatan.push(
      "Tidak satu pun nama pihak ditemukan di dalam amar, jadi amar anonim sama dengan amarnya. Periksa sendiri sebelum menyimpan."
    );
  } else if (diganti.length > 0) {
    catatan.push(
      `Amar anonim disusun dengan mengganti ${diganti.length} nama pihak menjadi sebutan acaranya. Nama saksi, nama anak, alamat, dan nomor identitas TIDAK ikut tersamar - bacalah sebelum menyimpan.`
    );
  }

  catatan.push("Tombol Simpan di SIPP tidak ditekan ALETA. Periksa seluruh isian, lalu simpan sendiri.");

  return {
    pertimbangan,
    amar,
    amarAnonim,
    namaDisamarkan: diganti,
    catatan,
    belumTerisi,
  };
}
