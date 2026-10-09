import { NextResponse, type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanBolehUnggahPutusan } from "@/server/modules/aleta-ecourt/hak-putusan";
import {
  kenaliBentuk,
  periksaBerkasUnggahSipp,
  type SlotUnggahSipp,
} from "@/server/modules/aleta-ecourt/unggah-naskah-putusan";
import {
  gatewayUnggahPutusanSipp,
  getGatewaySippKonteks,
  getGatewayStatusPerkara,
} from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";
import { alamatIpPeramban } from "@/server/shared/request";

import { selaraskanPerkaraDariId } from "../perkara-dari-id";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Putusan yang khas di bawah 1 MB; batas ini longgar sepuluh kali lipat. */
const BATAS_SATU_BERKAS = 10 * 1024 * 1024;

/**
 * Mengunggah putusan akhir dan anonimisasinya ke SIPP sekaligus.
 *
 *   POST multipart: perkaraId, nomorPerkara, putusan?, anonimisasi?
 *
 * ============================================================================
 * INI MENULIS KE SIPP - DAN ITU DIBATASI KEWENANGANNYA
 * ============================================================================
 *
 * Berbeda dengan rute putusan yang lain di folder ini, yang ini benar-benar
 * MENULIS: berkas ke cakram SIPP, kolom dokumen pada perkara_putusan, baris
 * dirput_dokumen, dan antrean Direktori Putusan. Karena itu kewenangannya
 * PERAN: Super Admin, Admin, Hakim (termasuk Ketua/Wakil) - keputusan
 * 9 Okt 2026, lihat pastikanBolehUnggahPutusan. Peran lain ditolak 403.
 *
 * Portal tidak menyentuh SIPP sendiri; seluruhnya lewat gerbang bot, tempat
 * satu-satunya sambungan ke basis data SIPP berada.
 *
 * ============================================================================
 * SATU ATAU DUA SLOT, DAN ISINYA DIPERIKSA SEBELUM APA PUN DITULIS
 * ============================================================================
 *
 * Putusan saja, anonimisasi saja, atau keduanya - anonimisasi sering baru
 * siap sesudah putusannya terunggah, dan berkas yang keliru cukup diganti
 * satu tanpa mengirim ulang pasangannya. Isi RTF diperiksa di sini (periksaBerkasUnggahSipp): naskah yang bukan
 * putusan, nomor isi yang berbeda, dan slot anonimisasi yang masih memuat
 * nama inti pihak ditolak 409 beserta kalimatnya, SEBELUM gerbang dipanggil.
 * PDF/DOCX/DOC hanya diberi peringatan.
 *
 * Alamat IP peramban petugas diteruskan ke bot supaya baris audit yang
 * ditulis ALETA mencatat dari mana perintahnya datang - bukan kosong.
 * Alamatnya dibaca alamatIpPeramban: entri TERAKHIR X-Forwarded-For (yang
 * ditulis Apache), lalu X-Real-IP. Entri PERTAMA sengaja tidak dipakai -
 * peramban dapat mengarangnya, dan alamat karangan pada catatan audit lebih
 * buruk daripada alamat kosong.
 */
export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    // Keputusan 9 Okt 2026: unggah putusan HANYA Super Admin, Admin, dan
    // Hakim (termasuk Ketua/Wakil). Bukan lagi kemampuan "penunjukan" - itu
    // gerbang PENETAPAN, dan menumpanginya membuat hak putusan ikut bergeser
    // tiap kali gerbang penetapan disunting (temuan uji U1).
    const { actor: aktor, peran: peranPenekan } = await pastikanBolehUnggahPutusan(db, actorUserId);
    // Uji rilis U1 (9 Okt 2026): akun ALETA yang menekan tombolnya untuk JEJAK
    // JUJUR aleta_bot_jejak_penetapan - sebelumnya tidak diteruskan, sehingga
    // baris "unggah edoc_putusan" di server (533, 561) berkolom operator kosong.
    // Diambil dari sesi, bukan dari badan permintaan; tidak pernah ditulis ke SIPP.
    const operator = String(aktor?.name || aktor?.email || actorUserId || "").trim();

    const formulir = await request.formData();
    let perkaraId = String(formulir.get("perkaraId") ?? "").trim();
    let nomorPerkara = String(formulir.get("nomorPerkara") ?? "").trim();
    const olehUsername = String(formulir.get("olehUsername") ?? "").trim();

    // perkara_id dari panel ABT diadu dengan nomornya, dan nomor yang tidak
    // terbaca di ABT ditanyakan ke SIPP (perbaikan 1 Okt, butir 11) - lihat
    // selaraskanPerkaraDariId.
    const selaras = await selaraskanPerkaraDariId({ perkaraId, nomorPerkara });
    if (!selaras.ok) return ok({ ok: false, alasan: selaras.alasan, sebab: selaras.sebab });
    perkaraId = selaras.perkaraId;
    nomorPerkara = selaras.nomorPerkara;

    // ========================================================================
    // perkara_id DITANYAKAN SENDIRI BILA EKSTENSI TIDAK MENYEBUTNYA
    // ========================================================================
    //
    // Sampai 22 September 2026 rute ini menolak di sini dengan "perkara_id
    // belum disebut." - dan penolakan itu terjadi pada SETIAP unggahan dari
    // halaman perkara agama, tanpa kecuali.
    //
    // Sebabnya bukan ekstensi yang lupa. perkaraIdDariHalaman() membaca
    // input[name="perkara_id"] di dalam #frm_putusan, dan medan itu TIDAK
    // PERNAH ADA di sana: SIPP mengenali perkara pada borang Putusan Akhir
    // lewat `enc` - nomor perkara tersandi - dan perkara_id hanya dipakai pada
    // borang grasi dan peninjauan kembali. Di halaman detil_perkara_agama,
    // #frm_putusan bahkan belum lahir sampai tingkapnya dibuka.
    //
    // Rute saudaranya, unggah-naskah, sudah lama punya jalan mundur ini -
    // hanya rute ini yang tidak pernah diberi. Itu sebabnya yang satu bekerja
    // dan yang lain selalu gagal dari halaman yang sama.
    //
    // Nomor perkara diperiksa LEBIH DULU: ia yang menjadi kunci pertanyaan ke
    // gerbang, dan menanyakan perkara tanpa nomor hanya menambah satu
    // perjalanan yang sudah pasti gagal.
    if (!nomorPerkara) return ok({ ok: false, sebab: "Nomor perkara belum disebut." });

    // Berkas dibaca LEBIH DULU daripada gerbang ditanya: ukurannya diperiksa
    // di sini tanpa perjalanan ke bot, dan bentuknya menentukan apakah nama
    // pihak perlu ditanyakan sama sekali.
    const bacaBerkas = async (nama: SlotUnggahSipp): Promise<Uint8Array | null> => {
      const berkas = formulir.get(nama);
      if (!(berkas instanceof File) || berkas.size === 0) return null;
      if (berkas.size > BATAS_SATU_BERKAS) {
        throw new Error(
          `Ukuran ${nama} melampaui ${Math.round(BATAS_SATU_BERKAS / 1024 / 1024)} MB. Putusan yang sebesar itu hampir pasti hasil pindaian, bukan PDF teks.`
        );
      }
      return new Uint8Array(await berkas.arrayBuffer());
    };

    const berkas: Array<{ slot: SlotUnggahSipp; bita: Uint8Array }> = [];
    try {
      for (const slot of ["putusan", "anonimisasi"] as const) {
        const bita = await bacaBerkas(slot);
        if (bita) berkas.push({ slot, bita });
      }
    } catch (galat) {
      return ok({ ok: false, sebab: String((galat as Error).message) });
    }

    // Satu slot saja sah: putusan saja, atau anonimisasi saja.
    if (berkas.length === 0) {
      return ok({ ok: false, sebab: "Belum ada berkas yang dipilih." });
    }

    // Nama pihak hanya dibutuhkan bila ada RTF yang dapat dibaca isinya. Ia
    // ditanyakan BERSAMAAN dengan perkara_id - dua bacaan yang tidak saling
    // menunggu tidak perlu dijalankan berurutan.
    const adaRtf = berkas.some((b) => kenaliBentuk(b.bita) === "rtf");
    const [status, konteks] = await Promise.all([
      perkaraId ? Promise.resolve(null) : getGatewayStatusPerkara(nomorPerkara),
      adaRtf ? getGatewaySippKonteks(nomorPerkara) : Promise.resolve(null),
    ]);

    if (status) {
      // Bot yang mati DIBEDAKAN dari perkara yang tidak ada. Menyamakan
      // keduanya mengirim petugas memeriksa nomor perkaranya - yang sudah
      // benar - sementara yang perlu diperiksa sambungan botnya.
      if (!status.ok) {
        return ok({
          ok: false,
          sebab: status.error || "ALETA Bot belum dapat dihubungi, jadi perkaranya belum dapat dikenali.",
        });
      }
      const identitas = (status.data?.identitas ?? null) as { perkaraId?: string } | null;
      perkaraId = String(identitas?.perkaraId ?? "").trim();
    }

    if (!perkaraId) {
      return ok({
        ok: false,
        sebab: `Nomor perkara ${nomorPerkara} tidak ditemukan di SIPP, jadi berkasnya tidak dapat ditautkan ke perkara mana pun.`,
      });
    }

    // Kuasa hukum TIDAK dipakai sebagai penanda: nama advokat lazim tetap
    // tertulis pada putusan anonimisasi. Yang disamarkan nama para pihak.
    let namaPihak: string[] | null = null;
    let sebabPihak = "";
    if (konteks) {
      if (konteks.ok) {
        namaPihak = (konteks.data?.nomorPihak ?? [])
          .filter((satu) => satu.jenis !== "kuasa")
          .map((satu) => satu.nama);
      } else {
        sebabPihak = konteks.error || "SIPP tidak terbaca.";
      }
    }

    const periksa = periksaBerkasUnggahSipp({ nomorPerkara, berkas, namaPihak, sebabPihak });
    if (periksa.tolak) {
      // 409: isinya bertentangan dengan perkara yang dituju. Bentuk badannya
      // memuat `data` seperti jawaban lain rute ini (ekstensi membaca
      // luar.data), dan `error.message` seperti galat portal lainnya.
      return NextResponse.json(
        {
          ok: false,
          error: { message: periksa.tolak.sebab },
          data: { ok: false, ...periksa.tolak, peringatan: periksa.peringatan },
        },
        { status: 409 }
      );
    }

    const bitaSlot = (slot: SlotUnggahSipp) => berkas.find((b) => b.slot === slot)?.bita;
    const putusan = bitaSlot("putusan");
    const anonimisasi = bitaSlot("anonimisasi");
    const hasil = await gatewayUnggahPutusanSipp({
      perkaraId,
      nomorPerkara,
      ...(putusan ? { putusanBase64: Buffer.from(putusan).toString("base64") } : {}),
      ...(anonimisasi ? { anonimisasiBase64: Buffer.from(anonimisasi).toString("base64") } : {}),
      // Akun SIPP yang sedang membuka halamannya - yang tercatat sebagai
      // pelaku di audit trail SIPP adalah dia, sebab yang menekan tombolnya
      // orang yang sedang masuk SIPP di layar itu. Bahwa tulisannya lewat
      // ALETA disebut bot pada judul dan deskripsi baris auditnya.
      olehUsername,
      // Pengguna ALETA yang menekan - hanya untuk jejak ALETA.
      operator,
      // Peran yang memberi hak unggah - gerbang bot menolak sendiri bila
      // kosong atau bukan Hakim/Admin/Super Admin (lapis kedua).
      peranPenekan,
      // Alamat peramban petugas itu, untuk kolom ipaddress baris audit SIPP.
      // Kosong bila tidak ada alamat IPv4 yang sah - tidak pernah dikarang.
      ip: alamatIpPeramban(request),
    });

    if (!hasil.ok) {
      return ok({
        ok: false,
        sebab: hasil.error || "ALETA Bot belum dapat dihubungi.",
        peringatan: periksa.peringatan,
      });
    }
    return ok({ ...hasil.data, nomorIsi: periksa.nomorIsi, peringatan: periksa.peringatan });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "PUTUSAN_UNGGAH_SIPP_GAGAL",
      feature: "aleta_ecourt",
      entityId: "putusan-unggah-sipp",
    });
  }
}
