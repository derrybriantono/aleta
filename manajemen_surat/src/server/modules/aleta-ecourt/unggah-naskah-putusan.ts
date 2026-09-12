import type { AletaDatabase } from "@/server/db/client";

import { bacaRtfDariBita, tampakRtf } from "@/lib/baca-rtf";
import { pecahNaskahResmi } from "@/lib/naskah-putusan-resmi";
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
  sebab?: string;
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
 */
function kenaliBentuk(bita: Uint8Array): "rtf" | "pdf" | "docx" | "doc" | "teks" {
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
      sebab: `Nomor perkara ${nomorPerkara} tidak ditemukan di SIPP, jadi drafnya tidak dapat ditautkan ke perkara mana pun.`,
    };
  }
  if (!masukan.bita || masukan.bita.length === 0) return { ok: false, sebab: "Berkasnya kosong." };

  const bentuk = kenaliBentuk(masukan.bita);
  if (bentuk === "pdf" || bentuk === "docx" || bentuk === "doc") {
    return { ok: false, sebab: SEBAB_BENTUK[bentuk] };
  }

  const teks =
    bentuk === "rtf"
      ? bacaRtfDariBita(masukan.bita)
      : new TextDecoder("utf-8").decode(masukan.bita).replace(/\r\n/g, "\n").trim();

  if (!teks) return { ok: false, sebab: "Tidak ada teks yang dapat dibaca dari berkas ini." };

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

  if (!disimpan.ok) return { ok: false, sebab: disimpan.sebab };

  return {
    ok: true,
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
