import { type NextRequest } from "next/server";

import { usulkanAlasanPerkara, susunTeksAlasan } from "@/lib/alasan-perkara-sipp";
import { petikDataNikah } from "@/lib/data-nikah-sipp";
import { usulkanObyekSengketa, type UsulanObyek } from "@/lib/obyek-sengketa-sipp";
import { saringMedanPilihan, type TipeUsulanMedan } from "@/lib/usulan-medan-putusan";
import { getDatabase } from "@/server/db/client";
import { getGatewaySippObyekSengketa } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { untukPortal } from "@/server/modules/aleta-ecourt/tipe-keluaran";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { readJsonBody } from "@/server/shared/request";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Usulan medan ALASAN pada layar Info Perkara Agama (Data Umum) SIPP.
 *
 *   POST { nomorPerkara?, teks: { posita, petitum }, medan: [{kunci,label,pilihan}] }
 *
 * ============================================================================
 * KENAPA TEKSNYA DATANG DARI EKSTENSI, BUKAN DIBACA DI SINI
 * ============================================================================
 *
 * Posita dan petitum sudah ada di layar yang sedang dibuka petugas - keduanya
 * CKEditor pada borang yang sama dengan medan alasannya. Membacanya lagi dari
 * basis data SIPP berarti satu pembacaan tambahan untuk memperoleh kalimat
 * yang sudah terpampang, dan - lebih buruk - berarti yang dinilai bukan yang
 * dilihat petugas: ia mungkin baru saja menyunting positanya dan belum
 * menyimpannya.
 *
 * Yang dinilai haruslah yang ADA DI LAYAR, sebab itulah yang akan tersimpan
 * bersama pilihan ini.
 *
 * ============================================================================
 * TEKS DARI HALAMAN TIDAK PERNAH MENJADI PERINTAH
 * ============================================================================
 *
 * Posita ditulis pihak berperkara dan disalin petugas; isinya kalimat orang
 * lain. Di sini ia hanya DICOCOKKAN dengan daftar pilihan yang juga dikirim
 * halaman, dan keluarannya tidak pernah lebih dari salah satu nilai dalam
 * daftar itu. Tidak ada satu pun kalimat posita yang tersimpan, dikirimkan
 * ulang, atau dijalankan.
 *
 * Rute ini pun tidak menulis apa pun - tidak ke ALETA, tidak ke SIPP. Yang
 * menekan Simpan tetap petugas, sesudah membaca tiap usulan.
 */

/** Batas wajar satu posita. Yang lebih panjang dipotong, bukan ditolak. */
const BATAS_TEKS = 200_000;
/** Layar Data Umum tidak pernah menampilkan sebanyak ini medan alasan. */
const BATAS_MEDAN = 20;

/**
 * Daftar tipe keluaran yang dibaca mesin usulan yang sama dengan borang
 * putusan (usulkanMedanPutusan lewat usulkanAlasanPerkara).
 */
const DAFTAR_TIPE_PUTUSAN = ["putusan.sumber-hukum.sebutan", "putusan.bawaan-medan"] as const;

/**
 * Daftar efektif APA ADANYA dari untukPortal. Galat yang lolos darinya tidak
 * menggagalkan usulan: tipe dikosongkan (konstanta kode yang berlaku) dan
 * sebabnya dipulangkan sebagai kabar - dicatat, tidak ditelan.
 */
async function bacaTipePutusan(
  db: Awaited<ReturnType<typeof getDatabase>>
): Promise<{ tipe: TipeUsulanMedan | null; kabar: string[] }> {
  try {
    const hasil = await untukPortal(db, DAFTAR_TIPE_PUTUSAN);
    const tipe: TipeUsulanMedan = {};
    for (const kunci of DAFTAR_TIPE_PUTUSAN) {
      if (Array.isArray(hasil.daftar[kunci])) tipe[kunci] = hasil.daftar[kunci];
    }
    return { tipe, kabar: hasil.kabar };
  } catch (galat) {
    console.error("[ALASAN PERKARA] Tipe keluaran tidak terbaca; memakai bawaan kode.", galat);
    const pesan = galat instanceof Error ? galat.message : String(galat);
    return { tipe: null, kabar: [`Tipe keluaran tidak terbaca - memakai bawaan: ${pesan}`] };
  }
}

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    // Kewenangan "panel", sama dengan borang putusan: yang mengisi Data Umum
    // adalah petugas meja dan panitera muda, bukan admin.
    await pastikanKapabilitas(db, actorUserId, "panel");

    const badan = await readJsonBody<{
      nomorPerkara?: string;
      teks?: { posita?: string; petitum?: string };
      medan?: unknown;
      /** Halaman menampilkan kotak Obyek Sengketa - kebiasaan satker diminta. */
      mintaObyek?: boolean;
      /**
       * Dari mana positanya dibaca: layar SIPP, atau berkas gugatan di arsip
       * ALETA. Tidak mengubah satu pun hitungan di sini - dicatat supaya
       * ketepatan usulan yang disusun dari berkas dapat diukur terpisah dari
       * yang disusun dari layar. Keduanya belum tentu setepat yang lain.
       */
      asalPosita?: string;
    }>(request);

    // Nilai yang SUDAH terpilih di layar (terpilih, kontrak K9) ikut diterima:
    // alasan yang sudah dipilih petugas didahulukan, kecuali naskah tegas
    // menyebut yang lain - lihat hormatiTerpilih.
    const medan = saringMedanPilihan(badan?.medan, { medan: BATAS_MEDAN });

    const teks = {
      posita: String(badan?.teks?.posita ?? "").slice(0, BATAS_TEKS),
      petitum: String(badan?.teks?.petitum ?? "").slice(0, BATAS_TEKS),
    };

    const dasar = susunTeksAlasan(teks);
    if (!dasar) {
      return ok({
        ada: false,
        sebab:
          "Posita dan petitum di halaman ini masih kosong, jadi tidak ada kalimat yang dapat dibaca. " +
          "Isi positanya dulu, lalu minta usulan lagi.",
      });
    }

    // ────────────────────────────────────────────────────────────────────
    // DUA HAL YANG BERBEDA SIFATNYA, SATU PERMINTAAN
    // ────────────────────────────────────────────────────────────────────
    //
    // "usulan" adalah PENILAIAN: posita menyebut banyak hal dan salah satunya
    // dipilih. "nikah" adalah KUTIPAN: nomor akta dan tanggalnya tertulis apa
    // adanya, dan yang dikerjakan hanya menyalin dengan teliti.
    //
    // Keduanya berasal dari teks yang sama dan dipakai pada layar yang sama,
    // jadi memisahkannya menjadi dua rute hanya membuat petugas menekan dua
    // tombol untuk satu pekerjaan.
    //
    // Yang ketiga, "obyekSengketa", berbeda lagi sifatnya - lihat di bawah.

    // ────────────────────────────────────────────────────────────────────
    // OBYEK SENGKETA - KEBIASAAN SATKER, DIBACA LEWAT GERBANG BOT
    // ────────────────────────────────────────────────────────────────────
    //
    // Satu-satunya isian di layar ini yang tidak berasal dari posita. Hanya
    // dibaca bila halamannya memang menampilkan kotaknya, dan gagal
    // membacanya TIDAK menggagalkan petikan dan usulan yang lain: sebabnya
    // dipulangkan apa adanya di tempat kotak itu.
    let obyekSengketa: (UsulanObyek & { jenisPerkara: string; sebab: string }) | null = null;
    const nomorPerkara = String(badan?.nomorPerkara ?? "").trim();
    if (badan?.mintaObyek && nomorPerkara) {
      const jawab = await getGatewaySippObyekSengketa(nomorPerkara);
      obyekSengketa = jawab.ok
        ? { ...usulkanObyekSengketa(jawab.data.baris), jenisPerkara: jawab.data.jenisPerkara, sebab: "" }
        : { total: 0, yakin: false, usulan: [], jenisPerkara: "", sebab: jawab.error || "SIPP tidak terbaca." };
    }

    // Tipe keluaran hanya dibaca bila ada medan yang akan diusulkan.
    const { tipe, kabar } = medan.length > 0 ? await bacaTipePutusan(db) : { tipe: null, kabar: [] as string[] };

    return ok({
      ada: true,
      nomorPerkara,
      panjangTeks: dasar.length,
      usulan: medan.length > 0 ? usulkanAlasanPerkara(teks, medan, { tipe }) : [],
      // Hanya muncul bila ada yang perlu dikatakan - lihat rute isian-sipp.
      ...(kabar.length ? { kabarTipeKeluaran: kabar } : {}),
      nikah: petikDataNikah(String(badan?.teks?.posita ?? "").slice(0, BATAS_TEKS)),
      obyekSengketa,
      asalPosita: String(badan?.asalPosita ?? "").slice(0, 160),
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ALASAN_PERKARA_USULAN_GAGAL",
      feature: "aleta_ecourt",
      entityId: "alasan-perkara",
    });
  }
}
