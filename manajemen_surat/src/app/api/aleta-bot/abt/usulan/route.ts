import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { getGatewayAbtUsulan } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { kapabilitasPengguna, pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { requireActorUser } from "@/server/modules/organization/service";
import { roles as daftarPeran } from "@/lib/mock-data";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Usulan isian untuk blangko ABT.
 *
 * ============================================================================
 * MENGUSULKAN, TIDAK MENULIS
 * ============================================================================
 *
 * Rute ini tidak menyentuh satu pun berkas di folder APS Badilag - folder itu
 * hanya dibaca, dan aturan itu tidak berubah - dan tidak menulis ke basis data
 * aps_badilag. Ia menjawab dengan usulan; yang menuliskannya ke ABT adalah
 * ekstensi di peramban petugas, lewat rute simpan milik ABT sendiri
 * (abt/edit_data), dengan sesi petugas itu sendiri.
 *
 * Akibatnya penting dan disengaja: apa pun yang masuk ke ABT tetap tercatat
 * atas nama orang yang menekan tombolnya, lewat jalur yang sama dengan
 * pengisian tangan, dan tetap melewati pemeriksaan ABT sendiri.
 *
 * ============================================================================
 * ISI KETERANGAN SAKSI DIKIRIM DARI HALAMAN, BUKAN DIBACA DARI BASIS DATA
 * ============================================================================
 *
 * Keterangan saksi (variabel 2021 dan 2022) hidup di basis data aps_badilag,
 * yang tidak dibaca ALETA. Yang membacanya adalah ekstensi - dari halaman yang
 * sedang dibuka petugas - lalu mengirimkannya ke sini untuk diurai.
 *
 * Karena itu isinya diperlakukan sebagai MASUKAN, bukan sebagai kebenaran:
 * panjangnya dibatasi, dan tidak satu pun bagiannya dipakai menyusun kueri.
 */
const BATAS_TEKS = 20000;

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const body = await readJsonBody<{
      nomorPerkara?: unknown;
      sumber?: unknown;
      saksi1?: unknown;
      saksi2?: unknown;
      tanggalSidang?: unknown;
      pelaku?: unknown;
      lawan?: unknown;
      posita?: unknown;
      pemohon2?: unknown;
      templat?: unknown;
      alasan?: unknown;
    }>(request).catch(() => ({}) as Record<string, unknown>);

    const sumberMinta = String(body.sumber || "semua");

    // ========================================================================
    // "siapa" TIDAK MENUNTUT KEMAMPUAN BLANGKO
    // ========================================================================
    //
    // Ia hanya menanyakan siapa yang sedang masuk dan boleh apa - dan justru
    // yang TIDAK boleh memakai panel blangko paling perlu dijawab, supaya
    // panelnya dapat menyembunyikan tombol yang akan ditolak alih-alih
    // menawarkannya lalu gagal sesudah ditekan.
    //
    // Yang dijawab tetap tentang dirinya sendiri saja: namanya dan
    // kemampuannya. Tidak ada keterangan perkara, tidak ada daftar orang lain.
    if (sumberMinta === "siapa") {
      const dia = await requireActorUser(db, actorUserId);
      const peranDia = daftarPeran.find((x) => x.id === dia.roleId);
      return ok({
        available: true,
        message: "",
        pengguna: {
          nama: dia.name,
          peran: peranDia ? peranDia.name : String(dia.roleId || ""),
        },
        kapabilitas: await kapabilitasPengguna(db, { id: dia.id, roleId: String(dia.roleId) }),
        sipp: null,
        saksi: null,
        itsbat: null,
        saksiSdg: null,
      });
    }

    // Selain "siapa", seluruhnya menyentuh isi perkara dan menyiapkan tulisan
    // ke ABT - dan itu menuntut kemampuan blangko, bukan sekadar panel.
    const actor = await pastikanKapabilitas(db, actorUserId, "blangko-abt");
    const peran = daftarPeran.find((x) => x.id === actor.roleId);
    const pengguna = { nama: actor.name, peran: peran ? peran.name : String(actor.roleId || "") };

    const nomorPerkara = String(body.nomorPerkara || "").trim();
    if (!nomorPerkara) {
      return ok({ available: false, message: "Nomor perkara tidak terbaca dari halaman ABT." });
    }

    const SUMBER_DIKENAL = ["sipp", "saksi", "itsbat", "saksi-sdg"] as const;
    type Sumber = (typeof SUMBER_DIKENAL)[number] | "semua";
    const sumber: Sumber = (SUMBER_DIKENAL as readonly string[]).includes(sumberMinta)
      ? (sumberMinta as Sumber)
      : "semua";

    const hasil = await getGatewayAbtUsulan({
      nomorPerkara,
      sumber,
      saksi1: String(body.saksi1 || "").slice(0, BATAS_TEKS),
      saksi2: String(body.saksi2 || "").slice(0, BATAS_TEKS),
      // Tanggal sidang dibaca ekstensi dari halaman ABT itu sendiri
      // (variabel 0033). Dipakai menghitung ulang lama pisah: kalimat saksi
      // benar pada hari ia diperiksa, dan mulai keliru pada sidang berikutnya.
      tanggalSidang: String(body.tanggalSidang || "").slice(0, 40),
      // Sebutan pihak, dibaca ekstensi dari variabel 0047 dan 0046 di halaman
      // ABT: "Tergugat" pada cerai gugat, "Termohon" pada cerai talak. Kalimat
      // 5227 diawali pelakunya, jadi salah menyebutnya berarti salah menyebut
      // pihak di dalam putusan.
      pelaku: String(body.pelaku || "").slice(0, 40),
      lawan: String(body.lawan || "").slice(0, 40),
      // Gugatannya, dibaca ekstensi dari variabel 5125 di halaman ABT.
      //
      // Yang diperiksa dan diputus adalah DALIL GUGATAN; keterangan saksi
      // membuktikannya, bukan menambah dalil baru. Alasan yang terbukti di
      // persidangan tetapi tidak pernah didalilkan tidak dapat menjadi dasar
      // putusan - itu memutus melebihi yang dituntut.
      //
      // Diteruskan sebagai teks untuk dicocokkan kata kuncinya saja; tidak
      // disimpan di mana pun pada jalur ini.
      posita: String(body.posita || "").slice(0, BATAS_TEKS),
      pemohon2: String(body.pemohon2 || "").slice(0, 40),
      // Templat tanya-jawab, diambil ekstensi dari halaman penyunting ABT
      // (POST load_template) - ALETA tetap tidak membaca basis data ABT.
      // Dibatasi enam puluh baris dan panjang tiap ruasnya, sebab ia masukan.
      templat: Array.isArray(body.templat)
        ? (body.templat as unknown[]).slice(0, 60).map((b) => {
            const r = (b && typeof b === "object" ? b : {}) as Record<string, unknown>;
            return {
              no: String(r.no || "").slice(0, 4),
              tanya: String(r.tanya || "").slice(0, 600),
              jawab: String(r.jawab || "").slice(0, 2000),
            };
          })
        : undefined,
      alasan: Array.isArray(body.alasan)
        ? (body.alasan as unknown[]).slice(0, 12).map((x) => String(x).slice(0, 80))
        : undefined,
    });

    if (!hasil.ok) {
      return ok({
        available: false,
        message: hasil.error || "ALETA Bot belum dapat dihubungi.",
      });
    }

    return ok({
      available: true,
      message: "",
      // Diteruskan utuh, bukan disusun ulang medan demi medan. Rute massal
      // pernah menyusun ulang jawabannya begitu, dan medan yang lupa
      // didaftarkan hilang tanpa bunyi - empat kali dalam satu hari.
      pengguna,
      sipp: hasil.data?.sipp ?? null,
      saksi: hasil.data?.saksi ?? null,
      itsbat: hasil.data?.itsbat ?? null,
      saksiSdg: hasil.data?.saksiSdg ?? null,
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ABT_USULAN_FAILED",
      feature: "abt_usulan",
    });
  }
}
