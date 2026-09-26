import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import {
  cariGatewayPerkara,
  getGatewayStatusPerkara,
} from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Galat habis waktu dari bot yang BELUM menerjemahkannya sendiri.
 *
 * Bot sejak 26 September 2026 mengirim kalimat Indonesia berkode
 * PENCARIAN_HABIS_WAKTU (galatPencarian di sippStatusPerkaraService.js). Bot
 * yang lebih lama meneruskan pesan driver mysql apa adanya - "Query
 * inactivity timeout" - dan kalimat itulah yang dulu tertulis di kotak galat
 * layar. Pola di bawah hanya mengenali pesan driver/peladen basis data yang
 * berarti habis waktu; pesan lain diteruskan tanpa diubah.
 */
const POLA_HABIS_WAKTU_MENTAH =
  /inactivity timeout|PROTOCOL_SEQUENCE_TIMEOUT|ETIMEDOUT|maximum statement execution time|max_statement_time|Query execution was interrupted/i;

// TIDAK diekspor: berkas rute Next.js hanya boleh mengekspor nama rute
// (GET, runtime, dynamic, ...) - ekspor lain ditolak saat next build.
const PESAN_HABIS_WAKTU_CARI =
  "Pencarian dihentikan karena terlalu lama membaca SIPP (melewati batas waktu kueri). Coba lagi, atau persempit dengan Saringan lain atau rentang waktu.";

function pesanGalatCari(pesan: string | undefined): string {
  const teks = String(pesan || "").trim();
  if (!teks) return "ALETA Bot belum dapat dihubungi.";
  if (!POLA_HABIS_WAKTU_MENTAH.test(teks)) return teks;
  // Pesan mentahnya tetap tercatat - yang diterjemahkan hanya yang dibaca orang.
  console.warn(`[status-perkara] pencarian habis waktu di bot: ${teks.slice(0, 200)}`);
  return PESAN_HABIS_WAKTU_CARI;
}

/**
 * Status satu perkara, dari pendaftaran sampai produk pengadilan.
 *
 * ============================================================================
 * DUA KEDALAMAN, SATU RUTE
 * ============================================================================
 *
 *   ?cari=419   - daftar perkara yang cocok, untuk dipilih
 *   ?nomor=...  - seluruh keadaan satu perkara
 *
 * Pencarian mengembalikan DAFTAR, bukan langsung membuka yang pertama. Nomor
 * urut saja dapat cocok pada beberapa perkara - Pdt.G, Pdt.P, tahun berbeda -
 * dan membuka salah satunya begitu saja berarti menampilkan perkara yang keliru
 * tanpa ada yang menyadarinya.
 *
 * ============================================================================
 * KEMAMPUAN YANG SAMA DENGAN PANEL SIPP
 * ============================================================================
 *
 * Isinya keterangan perkara yang sama dengan panel di halaman SIPP, hanya
 * disusun menurut perkaranya. Karena itu memakai kemampuan panel yang sudah
 * diatur per peran.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");

    // Pencarian dijalankan bila ADA salah satu isian - bukan hanya kata cari.
    // Menuntut kata cari akan membuat "seluruh perkara cerai gugat 2025 yang
    // belum putus" mustahil ditanyakan, padahal itu pertanyaan yang lazim.
    const p = request.nextUrl.searchParams;
    const saringan = {
      cari: String(p.get("cari") || "").trim(),
      jenisPerkara: String(p.get("jenisPerkara") || "").trim(),
      status: String(p.get("status") || "").trim(),
      tahun: String(p.get("tahun") || "").trim(),
      alurPerkaraId: Number(p.get("alurPerkaraId")) || 0,
      sejak: String(p.get("sejak") || "").trim(),
      sampai: String(p.get("sampai") || "").trim(),
      namaPihak: String(p.get("namaPihak") || "").trim(),
      petugas: String(p.get("petugas") || "").trim(),
      hakim: String(p.get("hakim") || "").trim(),
      panitera: String(p.get("panitera") || "").trim(),
      jurusita: String(p.get("jurusita") || "").trim(),
      statusPutusan: String(p.get("statusPutusan") || "").trim(),
      pertimbangan: String(p.get("pertimbangan") || "").trim(),
      amar: String(p.get("amar") || "").trim(),
      verstek: String(p.get("verstek") || "").trim(),
      alamatPihak: String(p.get("alamatPihak") || "").trim(),
      kua: String(p.get("kua") || "").trim(),
      relaas: String(p.get("relaas") || "").trim(),
      putusSejak: String(p.get("putusSejak") || "").trim(),
      putusSampai: String(p.get("putusSampai") || "").trim(),
      umur: String(p.get("umur") || "").trim(),
      ecourt: String(p.get("ecourt") || "").trim(),
      // Bawaan 25 baris; pagunya (500) dijaga bot, bukan di sini, supaya
      // angka itu hanya tertulis di satu tempat.
      batas: Number(p.get("batas")) || 25,
      // Halaman berikutnya: lewati = lewati + batas. Nilai buruk menjadi 0.
      lewati: Math.max(0, Math.floor(Number(p.get("lewati")) || 0)),
      // Tag dan lingkup waktunya. Kunci tag yang tidak ada di katalog dibuang
      // oleh bot - tidak ada potongan SQL yang datang dari peramban.
      tag: String(p.get("tag") || "").trim(),
      dasarTanggal: String(p.get("dasarTanggal") || "").trim(),
      periode: String(p.get("periode") || "").trim(),
      acuan: String(p.get("acuan") || "").trim(),
      tagDari: String(p.get("tagDari") || "").trim(),
      tagSampai: String(p.get("tagSampai") || "").trim(),
    };

    const adaSaringan =
      Boolean(saringan.cari) ||
      Boolean(saringan.jenisPerkara) ||
      Boolean(saringan.status) ||
      Boolean(saringan.tahun) ||
      saringan.alurPerkaraId > 0 ||
      Boolean(saringan.sejak) ||
      Boolean(saringan.sampai) ||
      Boolean(saringan.namaPihak) ||
      Boolean(saringan.petugas) ||
      Boolean(saringan.hakim) ||
      Boolean(saringan.panitera) ||
      Boolean(saringan.jurusita) ||
      Boolean(saringan.statusPutusan) ||
      Boolean(saringan.pertimbangan) ||
      Boolean(saringan.amar) ||
      Boolean(saringan.verstek) ||
      Boolean(saringan.alamatPihak) ||
      Boolean(saringan.kua) ||
      Boolean(saringan.relaas) ||
      Boolean(saringan.putusSejak) ||
      Boolean(saringan.putusSampai) ||
      Boolean(saringan.umur) ||
      Boolean(saringan.ecourt) ||
      Boolean(saringan.tag) ||
      // Rentang waktu sendirian sudah merupakan pertanyaan yang utuh -
      // "yang diputus triwulan ini" tidak menuntut tag apa pun.
      (Boolean(saringan.periode) && saringan.periode !== "total");

    if (adaSaringan) {
      const hasil = await cariGatewayPerkara(saringan);
      if (!hasil.ok) {
        return ok({
          available: false,
          message: pesanGalatCari(hasil.error),
          perkara: [],
        });
      }
      return ok({
        available: true,
        perkara: hasil.data?.perkara ?? [],
        // Keterangan halaman. Bot lama yang belum mengenal halaman TIDAK
        // mengirim adaLagi - dan itu diteruskan sebagai null ("tidak
        // diketahui"), BUKAN dikarang menjadi false. Dulu di sini "?? false":
        // bot lama yang memotong di 100 baris terbaca "tidak ada lagi", tombol
        // Muat lebih banyak tidak muncul, dan cadangan layar untuk bot lama
        // (halaman penuh dianggap mungkin bersambung) tidak pernah berjalan.
        adaLagi: typeof hasil.data?.adaLagi === "boolean" ? hasil.data.adaLagi : null,
        lewati: hasil.data?.lewati ?? saringan.lewati,
        batas: hasil.data?.batas ?? saringan.batas,
        lapis: hasil.data?.lapis ?? "",
        // Bagian yang gagal dibaca bot. Diteruskan supaya kolom yang kosong
        // karena gagal dapat dibedakan dari yang memang kosong.
        ruasTakTerbaca: hasil.data?.ruasTakTerbaca ?? [],
        pilihanStatus: hasil.data?.pilihanStatus ?? [],
        pilihanAlur: hasil.data?.pilihanAlur ?? [],
        // Berapa yang sungguh cocok dengan tagnya, dan tag mana yang daftarnya
        // terpotong. Tanpa keduanya, batas baris memotong dalam diam.
        tagDipakai: hasil.data?.tagDipakai ?? [],
        jumlahTag: hasil.data?.jumlahTag ?? null,
        tagDipotong: hasil.data?.tagDipotong ?? [],
        batasId: hasil.data?.batasId ?? null,
      });
    }

    const nomor = String(request.nextUrl.searchParams.get("nomor") || "").trim();
    if (!nomor) {
      return ok({ available: true, status: null, alasan: "nomor_perkara_kosong" });
    }

    const hasil = await getGatewayStatusPerkara(nomor);
    if (!hasil.ok) {
      return ok({
        available: false,
        message: hasil.error || "ALETA Bot belum dapat dihubungi.",
        status: null,
      });
    }

    if (!hasil.data?.ok) {
      return ok({
        available: true,
        status: null,
        alasan: String(hasil.data?.alasan || "perkara_tidak_ditemukan"),
      });
    }

    return ok({ available: true, status: hasil.data });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "SIPP_STATUS_PERKARA_READ_FAILED",
      feature: "aleta_ecourt",
    });
  }
}
