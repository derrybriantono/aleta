import type { AletaDatabase } from "@/server/db/client";

import { bacaRtfDariBita, tampakRtf } from "@/lib/baca-rtf";
import {
  isiMenunjukPerkara,
  kenaliNaskahBukanPutusan,
  nomorPerkaraDariIsi,
  pecahNaskahResmi,
} from "@/lib/naskah-putusan-resmi";
import { naskahDariKerangka, susunKerangka, type KunciBagian } from "@/lib/susunan-putusan";
import { getGatewayStatusPerkara } from "@/server/modules/aleta-bot/whatsapp-gateway-client";

import { simpanDraf, type HasilRakit } from "./perakit-putusan";

/**
 * MENERIMA NASKAH PUTUSAN YANG SUDAH JADI, DAN MENJADIKANNYA DRAF ALETA.
 *
 * ============================================================================
 * JALUR KEDUA, BUKAN JALUR PENGGANTI
 * ============================================================================
 *
 * rakitPutusan menyusun putusan DARI FAKTA - berkas perkara, BAS, pustaka
 * pertimbangan - dan itu jalur yang seharusnya. Tetapi hari ini naskah
 * putusan masih ditulis hakim di templat satker, dan yang ada di tangannya
 * adalah berkas RTF yang sudah lengkap.
 *
 * Menyuruhnya menyalin pertimbangan 8.000 aksara ke dalam CKEditor SIPP
 * dengan tangan - lalu amarnya, lalu amar anonimnya - bukan otomisasi apa
 * pun. Itu pekerjaan yang justru hendak dihapus.
 *
 * Maka ada jalur kedua: naskah yang SUDAH jadi dipecah menjadi bagian-bagian
 * yang dituntut borang SIPP, disimpan sebagai draf, lalu diisikan ekstensi.
 *
 * ============================================================================
 * TIDAK ADA SATU KATA PUN YANG DIKARANG DI SINI
 * ============================================================================
 *
 * Yang dikerjakan hanya MEMOTONG. Tidak ada kalimat yang ditambah, tidak ada
 * yang dirapikan, tidak ada model yang dipanggil. Naskah yang keluar dari
 * sini adalah naskah yang masuk, hanya terbagi menurut judul bagiannya.
 *
 * Itu syarat, bukan pilihan. Putusan yang bunyinya berubah antara berkas
 * hakim dan borang SIPP adalah putusan yang berbeda dari yang ditandatangani.
 *
 * ============================================================================
 * DRAF INI TIDAK PERNAH LAHIR "DITANDATANGANI"
 * ============================================================================
 *
 * Keadaannya selalu 'draf'. Berkas RTF yang lengkap memang membuat
 * siapDitandatangani bernilai benar - itu berarti LENGKAP, bukan BENAR - dan
 * penandatanganan tetap menuntut hakim menekannya sendiri lewat jalurnya.
 */

/** Bagian yang benar-benar dituntut borang Putusan Akhir SIPP. */
const DITUNTUT_SIPP: KunciBagian[] = ["pertimbangan", "amar"];

export type HasilUnggah = {
  ok: boolean;
  /**
   * Kode sebab untuk dibaca mesin (ekstensi), berdampingan dengan `sebab` yang
   * dibaca petugas. Hanya diisi pada penolakan yang punya kodenya sendiri.
   */
  alasan?: "nomor_isi_berbeda" | "bukan_putusan";
  sebab?: string;
  /**
   * Nomor perkara yang dibaca dari ISI naskah (nomor ber-"Pdt." terbanyak).
   * Kosong bila isinya tidak menyebut satu pun. Dipulangkan pada unggahan
   * yang diterima maupun yang ditolak karena nomornya berbeda.
   */
  nomorIsi?: string;
  drafId?: string;
  versi?: number;
  /** Panjang tiap bagian, untuk diperlihatkan sebelum apa pun diisikan. */
  bagian?: Array<{ kunci: KunciBagian; judul: string; aksara: number; halangan: string }>;
  /** Baris perabot halaman yang dibuang - dilaporkan, bukan didiamkan. */
  perabotDibuang?: number;
  siap?: boolean;
};

const JUDUL: Record<KunciBagian, string> = {
  kepala: "Kepala putusan",
  identitas: "Identitas para pihak",
  dudukPerkara: "Duduk perkara",
  pertimbangan: "Pertimbangan hukum",
  amar: "Amar putusan",
  penutup: "Penutup",
};

/**
 * Menebak bentuk berkas dari bitanya, bukan dari namanya.
 *
 * Nama berkas dapat diubah siapa saja; kepala berkasnya tidak. Petugas yang
 * menamai PDF-nya ".rtf" akan mendapat sebab yang tepat, bukan naskah yang
 * penuh sampah.
 *
 * Dipakai pula rute unggah-sipp: hanya RTF yang isinya diperiksa di sana.
 */
export function kenaliBentuk(bita: Uint8Array): "rtf" | "pdf" | "docx" | "doc" | "teks" {
  const kepala = String.fromCharCode(...bita.subarray(0, 8));
  if (kepala.startsWith("%PDF")) return "pdf";
  if (kepala.startsWith("PK")) return "docx";
  // Berkas .doc lama: tanda tangan OLE2.
  if (kepala.startsWith("ÐÏà")) return "doc";
  const awal = String.fromCharCode(...bita.subarray(0, 200));
  if (tampakRtf(awal)) return "rtf";
  return "teks";
}

/** Sebab yang menyebutkan jalan keluarnya, bukan sekadar menolak. */
const SEBAB_BENTUK: Record<"pdf" | "docx" | "doc", string> = {
  pdf:
    "Berkas ini PDF. PDF memecah tiap paragraf menjadi baris cetak dan membawa " +
    'perabot halaman ("1 dari 13 Halaman") ke tengah naskah, sehingga pertimbangan ' +
    "dapat tersambung salah. Kirim berkas RTF-nya - ia naskah aslinya, dan PDF ini " +
    "dicetak dari sana.",
  docx: "Berkas ini .docx. Simpan ulang sebagai Rich Text Format (.rtf), lalu kirim lagi.",
  doc: "Berkas ini .doc lama. Simpan ulang sebagai Rich Text Format (.rtf), lalu kirim lagi.",
};

/**
 * Membaca berkas naskah, memecahnya, dan menyimpannya sebagai draf.
 *
 * Naskah yang tidak memuat SATU PUN jangkar ditolak seluruhnya: ia bukan
 * putusan, dan menyimpannya sebagai draf kosong hanya menaruh sampah di
 * riwayat perkara yang kelak dikira draf sungguhan.
 */
export async function unggahNaskahPutusan(
  db: AletaDatabase,
  aktor: string,
  masukan: {
    bita: Uint8Array;
    namaBerkas: string;
    perkaraId: string;
    nomorPerkara: string;
    jenisNaskah?: string;
  }
): Promise<HasilUnggah> {
  const nomorPerkara = String(masukan.nomorPerkara ?? "").trim();
  if (!nomorPerkara) return { ok: false, sebab: "Nomor perkara belum disebut." };

  // Berkasnya diperiksa LEBIH DULU daripada perkaranya ditanyakan ke SIPP:
  // penolakan karena isi (bentuk, bukan putusan, nomor berbeda) tidak butuh
  // gerbang, dan menanyakan perkara untuk berkas yang pasti ditolak hanya
  // menambah satu perjalanan ke bot.
  if (!masukan.bita || masukan.bita.length === 0) return { ok: false, sebab: "Berkasnya kosong." };

  const bentuk = kenaliBentuk(masukan.bita);
  if (bentuk === "pdf" || bentuk === "docx" || bentuk === "doc") {
    return { ok: false, sebab: SEBAB_BENTUK[bentuk] };
  }

  const teks = (
    bentuk === "rtf"
      ? bacaRtfDariBita(masukan.bita)
      : new TextDecoder("utf-8").decode(masukan.bita).replace(/\r\n/g, "\n").trim()
  )
    // ========================================================================
    // U+0000 TIDAK BOLEH SAMPAI KE POSTGRES - DARI JALUR MANA PUN
    // ========================================================================
    //
    // Kolom naskah bertipe text, dan Postgres menolak NUL di dalamnya dengan
    // 'invalid byte sequence for encoding "UTF8": 0x00'. Yang terjadi lalu:
    // rute menjawab 500, panel menerjemahkannya "server ALETA tidak
    // terjangkau", dan petugas memeriksa jaringan yang tidak ada salahnya.
    // Terjadi pada 204/Pdt.P/2026 dan 180/Pdt.P/2026 - NUL-nya dari definisi
    // daftar Word di dalam RTF. Pembaca RTF kini membuangnya di sumbernya;
    // baris ini menjaga jalur teks biasa, dan menjaga bila kelak pembaca lain
    // meloloskannya lagi.
    .replace(/\u0000/g, "");

  if (!teks) return { ok: false, sebab: "Tidak ada teks yang dapat dibaca dari berkas ini." };

  // ==========================================================================
  // BERITA ACARA, PENETAPAN HARI SIDANG, DAN RELAAS DITOLAK DENGAN NAMANYA
  // ==========================================================================
  //
  // Ketiganya memuat nomor perkara yang benar, dan PHS bahkan memuat
  // "MENETAPKAN" sehingga amarnya terpotong. Tanpa penolakan ini naskah itu
  // tersimpan sebagai draf putusan. Lihat kenaliNaskahBukanPutusan.
  const bukanPutusan = kenaliNaskahBukanPutusan(teks);
  if (bukanPutusan) {
    return {
      ok: false,
      alasan: "bukan_putusan",
      sebab:
        `Berkas ini ${bukanPutusan.nama} - judulnya "${bukanPutusan.judul.slice(0, 80)}" - ` +
        "bukan naskah putusan, jadi tidak dijadikan draf. Pilih berkas naskah putusannya.",
    };
  }

  // ==========================================================================
  // NOMOR PERKARA DARI ISI HARUS SAMA DENGAN NOMOR YANG DIMINTA
  // ==========================================================================
  //
  // Nomor permintaan datang dari halaman SIPP atau dari NAMA berkas; nomor isi
  // datang dari naskahnya sendiri (kepala "Nomor ...", atau nomor terbanyak;
  // 197 dari 197 naskah sungguhan cocok). Bila keduanya berbeda, yang terpilih
  // hampir pasti naskah perkara lain - dan draf itu kelak diisikan ke borang
  // perkara INI. Isi yang tidak menyebut nomor ber-"Pdt." tidak ditolak di
  // sini (naskah tempelan boleh tanpa kepala); nomorIsi-nya dipulangkan kosong.
  const dariIsi = nomorPerkaraDariIsi(teks);
  if (dariIsi.nomor && !isiMenunjukPerkara(dariIsi, nomorPerkara)) {
    return {
      ok: false,
      alasan: "nomor_isi_berbeda",
      nomorIsi: dariIsi.nomor,
      sebab:
        `Naskah ini menyebut nomor ${dariIsi.nomor} (${dariIsi.kali} kali), bukan ${nomorPerkara}. ` +
        `Berkasnya kemungkinan milik perkara lain; pilih naskah perkara ${nomorPerkara}.`,
    };
  }

  // perkara_id dipakai menomori versi draf. Ekstensi mengirimkannya bila
  // borang SIPP yang sedang terbuka memuatnya; bila tidak, ia ditanyakan ke
  // SIPP lewat gerbang - sekali per unggahan, bukan sekali per tampilan
  // halaman, jadi beratnya tidak pernah terasa petugas.
  let perkaraId = String(masukan.perkaraId ?? "").trim();
  if (!perkaraId) {
    const status = await getGatewayStatusPerkara(nomorPerkara);
    const identitas = (status.ok ? status.data?.identitas : null) as { perkaraId?: string } | null;
    perkaraId = String(identitas?.perkaraId ?? "").trim();
  }
  if (!perkaraId) {
    return {
      ok: false,
      nomorIsi: dariIsi.nomor,
      sebab: `Nomor perkara ${nomorPerkara} tidak ditemukan di SIPP, jadi drafnya tidak dapat ditautkan ke perkara mana pun.`,
    };
  }

  const { bagian, halangan, perabotDibuang } = pecahNaskahResmi(teks);

  if (Object.keys(bagian).length === 0) {
    return {
      ok: false,
      sebab:
        "Tidak satu pun judul bagian putusan ditemukan pada berkas ini - tidak ada " +
        '"PUTUSAN", "DUDUK PERKARA", "PERTIMBANGAN HUKUM", maupun "MENGADILI" yang ' +
        "berdiri pada barisnya sendiri. Pastikan yang dikirim naskah putusannya.",
    };
  }

  // Pertimbangan dan amar adalah dua isian yang dituntut borang SIPP. Draf
  // tanpa keduanya tidak dapat mengisi apa pun, dan menyimpannya hanya
  // menambah versi yang kelak membingungkan.
  const hilang = DITUNTUT_SIPP.filter((kunci) => !bagian[kunci]);
  if (hilang.length === DITUNTUT_SIPP.length) {
    return {
      ok: false,
      sebab: `Pertimbangan hukum dan amar tidak dapat dipotong dari berkas ini. ${
        halangan.pertimbangan ?? ""
      } ${halangan.amar ?? ""}`.trim(),
    };
  }

  const kerangka = susunKerangka(
    Object.fromEntries(
      (Object.keys(JUDUL) as KunciBagian[]).map((kunci) => [
        kunci,
        { isi: bagian[kunci] ?? "", halangan: halangan[kunci] ?? "" },
      ])
    )
  );

  const hasil: HasilRakit = {
    kerangka,
    naskah: naskahDariKerangka(kerangka),
    // Seluruhnya kosong, dan itu JUJUR: naskah ini tidak dirakit dari pustaka,
    // jadi tidak ada butir yang dipakai, tidak ada dasar hukum yang dibekukan,
    // dan tidak ada padanan amar-petitum yang dihitung.
    aduan: { padanan: [], belumTerjawab: [], amarTanpaPetitum: [], subsidair: [], halangan: [] },
    biaya: {
      ok: false,
      rincian: [],
      total: 0,
      totalRupiah: "",
      terbilang: "",
      panjar: 0,
      selisih: 0,
      arahSelisih: "",
      halangan: ["Naskah diterima sudah jadi; rincian biaya tidak dihitung ulang."],
    },
    butirDipakai: [],
    butirTertunda: [],
    faktaKurang: [],
    dasar: [],
    halangan: Object.values(halangan).filter(Boolean),
    siapDitandatangani: kerangka.siapDitandatangani,
  };

  const disimpan = await simpanDraf(db, aktor, {
    perkaraId,
    nomorPerkara,
    jenisNaskah: masukan.jenisNaskah,
    hasil,
    catatan: `Naskah diterima dari berkas "${String(masukan.namaBerkas ?? "").slice(0, 120)}" (${bentuk.toUpperCase()}). Dipotong menurut judul bagiannya; tidak ada kata yang diubah.`,
  });

  if (!disimpan.ok) return { ok: false, nomorIsi: dariIsi.nomor, sebab: disimpan.sebab };

  return {
    ok: true,
    nomorIsi: dariIsi.nomor,
    drafId: disimpan.drafId,
    versi: disimpan.versi,
    perabotDibuang,
    siap: kerangka.siapDitandatangani,
    bagian: kerangka.bagian.map((item) => ({
      kunci: item.kunci,
      judul: JUDUL[item.kunci],
      aksara: item.isi.length,
      halangan: item.halangan,
    })),
  };
}

/**
 * ============================================================================
 * PEMERIKSAAN BERKAS SEBELUM DIUNGGAH KE SIPP (rute unggah-sipp)
 * ============================================================================
 *
 * Unggah e-Doc MENULIS ke SIPP dan tidak dapat diurungkan dari panel. Yang
 * diperiksa di sini hanya yang dapat dibaca PASTI dari isi RTF:
 *
 *   1. bukan Berita Acara, Penetapan Hari Sidang, atau Relaas;
 *   2. nomor perkara di isi sama dengan nomor perkara yang dituju;
 *   3. slot anonimisasi TIDAK memuat nama inti pihak dari SIPP.
 *
 * Aturan 3 diukur atas berkas sungguhan PA Donggala: putusan asli yang salah
 * ditaruh di slot anonimisasi tertangkap 39 dari 39; anonimisasi sungguhan
 * lolos 13 dari 15, dan 2 yang tertahan memang masih memuat nama pihak.
 *
 * PDF, DOCX, dan DOC tidak dibaca isinya - pembacanya belum terukur - jadi
 * bentuk itu hanya diberi PERINGATAN, tidak ditolak. Begitu pula bila nama
 * pihak tidak terbaca dari SIPP: aturan slot tidak dapat dijalankan, dan itu
 * dikatakan, bukan dianggap lolos diam-diam.
 */
export type SlotUnggahSipp = "putusan" | "anonimisasi";

export type TolakUnggahSipp = {
  alasan: "bukan_putusan" | "nomor_isi_berbeda" | "nomor_isi_tidak_ada" | "slot_anonim_memuat_nama";
  slot: SlotUnggahSipp;
  sebab: string;
  nomorIsi?: string;
  /** Nama inti pihak yang ditemukan di slot anonimisasi. */
  nama?: string[];
};

export type PemeriksaanUnggahSipp = {
  tolak: TolakUnggahSipp | null;
  peringatan: string[];
  /** Nomor perkara dari isi tiap slot RTF yang terbaca. */
  nomorIsi: Partial<Record<SlotUnggahSipp, string>>;
  /** Slot yang isinya benar-benar diperiksa (RTF yang terbaca). */
  diperiksa: SlotUnggahSipp[];
};

const NAMA_SLOT: Record<SlotUnggahSipp, string> = {
  putusan: "Berkas putusan",
  anonimisasi: "Berkas anonimisasi",
};

/**
 * Nama inti: bagian nama sebelum "bin", "binti", atau "alias". Nama ayah
 * bukan nama pihak, dan "alias" sesudahnya sering ejaan lain dari nama yang
 * sama - keduanya tidak dipakai sebagai penanda.
 */
export function namaIntiPihak(nama: string): string {
  return String(nama ?? "")
    .split(/\s+(?:bin|binti|alias)\s+/i)[0]
    .replace(/\s+/g, " ")
    .trim();
}

/** Nama pendek (di bawah empat huruf) terlalu mudah muncul sebagai kata lain. */
const PANJANG_NAMA_INTI_MIN = 4;

/**
 * Nama inti pihak yang TERTULIS di naskah - berbatas kata, tanpa peduli
 * besar-kecil huruf. Berbatas kata supaya "Rina" tidak ditemukan di dalam
 * "Marina", dan "Untung" tidak di dalam "keuntungan".
 */
export function namaIntiDalamNaskah(naskah: string, namaPihak: string[]): string[] {
  const teks = String(naskah ?? "");
  const inti = [
    ...new Set(namaPihak.map(namaIntiPihak).filter((n) => n.length >= PANJANG_NAMA_INTI_MIN)),
  ];
  return inti.filter((nama) => {
    const lolos = nama.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s+");
    return new RegExp(`(?<![\\p{L}\\p{N}])${lolos}(?![\\p{L}\\p{N}])`, "iu").test(teks);
  });
}

export function periksaBerkasUnggahSipp(masukan: {
  nomorPerkara: string;
  berkas: Array<{ slot: SlotUnggahSipp; bita: Uint8Array }>;
  /** Nama pihak dari SIPP; null berarti tidak terbaca (sebabnya di sebabPihak). */
  namaPihak: string[] | null;
  sebabPihak?: string;
}): PemeriksaanUnggahSipp {
  const peringatan: string[] = [];
  const nomorIsi: Partial<Record<SlotUnggahSipp, string>> = {};
  const diperiksa: SlotUnggahSipp[] = [];
  const terbaca: Array<{ slot: SlotUnggahSipp; teks: string }> = [];
  const selesai = (tolak: TolakUnggahSipp | null): PemeriksaanUnggahSipp => ({
    tolak,
    peringatan,
    nomorIsi,
    diperiksa,
  });
  const nomorPerkara = String(masukan.nomorPerkara ?? "").trim();

  for (const { slot, bita } of masukan.berkas) {
    const bentuk = kenaliBentuk(bita);
    if (bentuk !== "rtf") {
      peringatan.push(
        `${NAMA_SLOT[slot]} berbentuk ${bentuk === "teks" ? "tidak dikenal" : bentuk.toUpperCase()}: ` +
          `isinya tidak diperiksa, jadi nomor perkara${slot === "anonimisasi" ? " dan nama pihak" : ""} ` +
          "di dalamnya belum dipastikan. Hanya RTF yang dapat dibaca isinya."
      );
      continue;
    }

    let teks = "";
    try {
      teks = bacaRtfDariBita(bita).replace(/\u0000/g, "");
    } catch (galat) {
      peringatan.push(
        `${NAMA_SLOT[slot]} tidak dapat dibaca isinya (${String((galat as Error)?.message ?? galat).slice(0, 120)}), ` +
          "jadi tidak diperiksa."
      );
      continue;
    }
    diperiksa.push(slot);

    const bukan = kenaliNaskahBukanPutusan(teks);
    if (bukan) {
      return selesai({
        alasan: "bukan_putusan",
        slot,
        sebab:
          `${NAMA_SLOT[slot]} adalah ${bukan.nama} - judulnya "${bukan.judul.slice(0, 80)}" - bukan naskah ` +
          "putusan. Tidak ada berkas yang dikirim ke SIPP.",
      });
    }

    const dariIsi = nomorPerkaraDariIsi(teks);
    nomorIsi[slot] = dariIsi.nomor;
    if (!dariIsi.nomor) {
      return selesai({
        alasan: "nomor_isi_tidak_ada",
        slot,
        nomorIsi: "",
        sebab:
          `${NAMA_SLOT[slot]} tidak menyebut satu pun nomor perkara ber-"Pdt." di isinya, jadi tidak dapat ` +
          `dipastikan milik perkara ${nomorPerkara}. Tidak ada berkas yang dikirim ke SIPP.`,
      });
    }
    if (!isiMenunjukPerkara(dariIsi, nomorPerkara)) {
      return selesai({
        alasan: "nomor_isi_berbeda",
        slot,
        nomorIsi: dariIsi.nomor,
        sebab:
          `${NAMA_SLOT[slot]} menyebut nomor ${dariIsi.nomor} (${dariIsi.kali} kali), bukan ${nomorPerkara}. ` +
          "Berkasnya kemungkinan milik perkara lain. Tidak ada berkas yang dikirim ke SIPP.",
      });
    }
    terbaca.push({ slot, teks });
  }

  if (terbaca.length === 0) return selesai(null);

  const nama = (masukan.namaPihak ?? []).filter(Boolean);
  const adaNamaInti = nama.some((n) => namaIntiPihak(n).length >= PANJANG_NAMA_INTI_MIN);
  if (!masukan.namaPihak || !adaNamaInti) {
    peringatan.push(
      `Nama pihak tidak terbaca dari SIPP${masukan.sebabPihak ? ` (${masukan.sebabPihak})` : ""}, jadi ` +
        "kebocoran nama pada berkas anonimisasi dan tertukarnya slot belum diperiksa."
    );
    return selesai(null);
  }

  for (const { slot, teks } of terbaca) {
    const temu = namaIntiDalamNaskah(teks, nama);
    if (slot === "anonimisasi" && temu.length > 0) {
      return selesai({
        alasan: "slot_anonim_memuat_nama",
        slot,
        nama: temu,
        sebab:
          `Berkas anonimisasi masih memuat nama pihak: ${temu.join(", ")}. Berkas inilah yang terbit di ` +
          "Direktori Putusan. Periksa apakah berkasnya tertukar dengan putusan asli, atau samarkan nama itu " +
          "lebih dulu. Tidak ada berkas yang dikirim ke SIPP.",
      });
    }
    if (slot === "putusan" && temu.length === 0) {
      peringatan.push(
        "Berkas putusan tidak memuat satu pun nama pihak dari SIPP. Periksa apakah yang terpilih justru " +
          "berkas anonimisasinya."
      );
    }
  }
  return selesai(null);
}
