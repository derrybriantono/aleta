
import { sebutanSatuPihak, type BahanSebutan } from "@/lib/sebutan-pihak";
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
// Pola lama ditulis di sini dan salah pada 3.999 dari 10.120 perkara satker,
// sebagian besar hanya karena SIPP menulis "Istbat" sedangkan polanya
// "itsbat". Aturannya kini satu tempat - lihat src/lib/sebutan-pihak.ts,
// yang memakai alur_perkara_id dan jenis_perkara_id lebih dulu dan menyimpan
// pencocokan kata sebagai cadangan terakhir.

/**
 * Sebutan acara untuk satu pihak.
 *
 * Perkara permohonan memakai Pemohon/Termohon, gugatan memakai
 * Penggugat/Tergugat. Salah menyebutnya pada amar anonim bukan sekadar salah
 * kata: ia mengubah jenis perkaranya di mata yang membaca.
 */
export function sebutanPihak(
  pihakKe: number | null | undefined,
  jenisPerkara: string,
  jenis?: string,
  bahanTambahan?: BahanSebutan
): string {
  return sebutanSatuPihak(pihakKe, { ...(bahanTambahan ?? {}), jenisPerkaraNama: jenisPerkara }, jenis);
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
/**
 * ============================================================================
 * TIAP BUTIR AMAR BERDIRI SEBAGAI PARAGRAFNYA SENDIRI
 * ============================================================================
 *
 * Amar putusan dibaca sebagai daftar, bukan sebagai alinea. Empat butir yang
 * mengalir menjadi satu blok - "1. Menyatakan ... tidak hadir; 2. Mengabulkan
 * ... 3. Menjatuhkan ..." - memaksa pembacanya mencari nomornya di tengah
 * kalimat, dan itulah bentuk yang tampil di CKEditor selama ini.
 *
 * Dikeluarkan sebagai <p> per butir, bukan sebagai baris baru. Yang diterima
 * CKEditor diurai sebagai HTML: baris baru di dalamnya runtuh menjadi satu
 * spasi, dan tidak satu pun jarak yang terlihat. Kolom amar_putusan di SIPP
 * memang menyimpan HTML - putusan yang sudah ada di sana pun begitu.
 *
 * Penomorannya TIDAK diubah, ditambah, maupun diurutkan ulang. Yang dikerjakan
 * hanya memberi tiap butir paragrafnya sendiri.
 */
export function paragrafButir(teks: string): string {
  const bersihTeks = bersih(teks);
  if (!bersihTeks) return "";

  let butir = bersihTeks
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((satu) => satu.trim())
    // ========================================================================
    // BARIS HAMPA DIBUANG - IA MENJADI BARIS KOSONG DI DOKUMEN CETAK
    // ========================================================================
    //
    // filter(Boolean) menangkap baris yang benar-benar kosong, tetapi TIDAK
    // menangkap baris yang isinya hanya &nbsp; - dan naskah yang pernah lewat
    // penyunting kerap membawanya, terutama sebagai penutup tiap blok
    // keterangan saksi. Satu baris semacam itu menjadi <p>&nbsp;</p>, lalu
    // \par tersendiri di dokumen cetak: satu baris kosong yang berdiri tanpa
    // isi antara keterangan saksi dan alinea berikutnya.
    //
    // Spasi tak-putus juga dibuang, sebab ia yang dihasilkan penyunting yang
    // sama dan lolos dari trim().
    .filter((satu) => satu.replace(/&nbsp;| /gi, "").trim().length > 0);

  // Naskah yang butirnya terlanjur mengalir dalam satu baris dipecah pada
  // penomorannya - tetapi hanya penomoran yang MENGAWALI butir, yakni yang
  // berdiri sesudah titik koma atau titik. "Pasal 19 huruf (b)" di tengah
  // kalimat tidak pernah mengawali apa pun.
  if (butir.length === 1) {
    butir = butir[0]
      .split(/(?<=[.;])\s+(?=(?:\d{1,2}|[a-z])[.)]\s)/i)
      .map((satu) => satu.trim())
      .filter(Boolean);
  }

  const aman = (satu: string) =>
    satu.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return butir.map((satu) => `<p>${aman(satu)}</p>`).join("");
}

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
    // Pertimbangan hukum adalah rangkaian alinea "Menimbang, bahwa ..." yang
    // masing-masing berdiri sebagai satu pertimbangan tersendiri. Mengalir
    // menjadi satu blok, ia terbaca sebagai satu kalimat sepanjang delapan
    // ribu aksara - dan yang memeriksanya kehilangan batas antar alinea,
    // yakni satu-satunya tanda di mana satu pertimbangan berakhir.
    pertimbangan: paragrafButir(pertimbangan),
    // Paragraf dibentuk PALING AKHIR, sesudah nama pihak disamarkan.
    // Menyisipkan tanda HTML lebih dahulu berarti nama yang kebetulan berdiri
    // di tepi paragraf terpotong tandanya dan luput tersamar.
    amar: paragrafButir(amar),
    amarAnonim: paragrafButir(amarAnonim),
    namaDisamarkan: diganti,
    catatan,
    belumTerisi,
  };
}
