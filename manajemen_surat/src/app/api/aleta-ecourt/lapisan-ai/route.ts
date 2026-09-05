import { randomUUID } from "node:crypto";

import { type NextRequest } from "next/server";

import { susunPerintah } from "@/lib/fakta-tak-berpola";
import { siapkanKiriman } from "@/lib/penjawab";
import { buatPenyamar } from "@/lib/penyamaran";
import { getDatabase } from "@/server/db/client";
import { pastikanAdminIstimewa, pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import {
  bukaPercakapan,
  catatPutaran,
  faktaPerkara,
  jawab,
  keadaanAi,
  simpanSaklar,
  periksaTarikan,
  periksaUsulan,
  pesanPercakapan,
  sahkanFakta,
  simpanFakta,
  usulkanButirKePustaka,
  type PemanggilModel,
} from "@/server/modules/aleta-ecourt/lapisan-ai";
import { bukaJangkar } from "@/server/modules/aleta-ecourt/pustaka-hukum";
import { jangkarRujukan, kenaliRujukan } from "@/server/modules/aleta-ecourt/pemecah-pertimbangan";
import { getAISettingsFromDb, resolveLiveAIConnectionForModule } from "@/server/modules/ai/service";
import { requestStructuredDataFromProvider } from "@/server/modules/ai/provider-client";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { getSearchParam } from "@/server/shared/request";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Lapisan AI (I1-I5).
 *
 *   GET ?percakapanId=...           pesan satu percakapan
 *   GET ?perkaraId=...&fakta=1      fakta tertarik perkara ini
 *
 *   POST {tindakan:"tanya"}         pustaka dulu, model terakhir (I5, I3)
 *   POST {tindakan:"tarikFakta"}    menarik fakta dari naskah tak berpola (I1)
 *   POST {tindakan:"sahkanFakta"}   menegaskan satu fakta
 *   POST {tindakan:"usulkanButir"}  memasukkan alinea model ke pustaka (I2, I4)
 *   POST {tindakan:"saklar"}        mematikan atau menyalakan AI (I6)
 *
 * ============================================================================
 * KEWENANGANNYA SAMA DENGAN MEMBUKA BERKAS, DAN ITU DISENGAJA
 * ============================================================================
 *
 * Tidak ada satu pun tindakan di sini yang mengubah putusan maupun pustaka
 * yang berlaku. Yang paling jauh adalah memasukkan alinea sebagai USULAN -
 * dan usulan hanya menjadi butir sesudah disahkan lewat jalur pustaka yang
 * menuntut Super Admin beserta atas perintah siapa.
 *
 * Karena itu kewenangannya cukup "berkas". Menuntut lebih akan membuat hakim
 * meminta dibukakan kewenangan admin untuk pekerjaan sehari-hari, dan
 * kewenangan yang diminta karena terpaksa tidak pernah dicabut kembali.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "berkas");

    const percakapanId = String(getSearchParam(request, "percakapanId") ?? "").trim();
    const perkaraId = String(getSearchParam(request, "perkaraId") ?? "").trim();

    if (percakapanId) {
      return ok({ ada: true, pesan: await pesanPercakapan(db, percakapanId) });
    }
    if (perkaraId) {
      return ok({ ada: true, fakta: await faktaPerkara(db, perkaraId) });
    }
    return ok({ ada: false, sebab: "Sebutkan percakapanId atau perkaraId." });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "LAPISAN_AI_BACA_FAILED",
      feature: "aleta_ecourt",
      entityId: "lapisan-ai",
    });
  }
}

type Masukan = {
  tindakan?: string;
  percakapanId?: string;
  perkaraId?: string;
  nomorPerkara?: string;
  jenisPerkara?: string;
  pertanyaan?: string;
  fakta?: Record<string, unknown>;
  naskah?: string;
  sumberBerkas?: string;
  ruasDiminta?: string[];
  faktaId?: string;
  olehNama?: string;
  teks?: string;
  isu?: string;
  lingkup?: string;
  kunci?: string;
  menyala?: boolean;
  alasan?: string;
};

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "berkas");

    const masukan = (await request.json()) as Masukan;
    const aktor = String(actorUserId ?? "");

    switch (String(masukan.tindakan ?? "")) {
      case "tanya": {
        const { keadaan, panggil } = await siapkanModel(db, "aleta-ecourt", {
          peran: await peranAktor(db, aktor),
          perkaraId: String(masukan.perkaraId ?? ""),
        });
        const hasil = await jawab(db, {
          pertanyaan: String(masukan.pertanyaan ?? ""),
          jenisPerkara: String(masukan.jenisPerkara ?? ""),
          fakta: masukan.fakta ?? {},
          ai: keadaan,
          panggilModel: panggil,
        });

        // Percakapan dicatat hanya bila perkaranya disebut - pertanyaan lepas
        // tidak berhak membuat utas yang menempel pada perkara mana pun.
        let percakapanId = String(masukan.percakapanId ?? "").trim();
        if (!percakapanId && String(masukan.perkaraId ?? "").trim()) {
          percakapanId = await bukaPercakapan(db, {
            perkaraId: String(masukan.perkaraId ?? ""),
            nomorPerkara: String(masukan.nomorPerkara ?? ""),
            oleh: aktor,
          });
        }
        if (percakapanId) {
          await catatPutaran(db, {
            percakapanId,
            pertanyaan: String(masukan.pertanyaan ?? ""),
            hasil,
          });
        }

        return ok({
          ok: true,
          percakapanId,
          jawaban: hasil.jawaban,
          penyedia: hasil.penyedia,
          model: hasil.model,
          // Nama ruas saja - nilainya tidak dikembalikan ke layar sebagai
          // salinan kedua.
          ruasDikirim: Object.keys(hasil.kiriman?.isi ?? {}),
          ruasDitahan: (hasil.kiriman?.ditahan ?? []).map((item) => item.ruas),
        });
      }

      case "tarikFakta": {
        const naskah = String(masukan.naskah ?? "");
        const ruasDiminta = (masukan.ruasDiminta ?? []).map((item) => String(item ?? "").trim()).filter(Boolean);
        if (!naskah.trim() || !ruasDiminta.length) {
          return ok({ ok: false, sebab: "Naskah dan daftar ruas yang diminta wajib diisi." });
        }

        const { keadaan, panggil } = await siapkanModel(db, "aleta-ecourt", {
          peran: await peranAktor(db, aktor),
          perkaraId: String(masukan.perkaraId ?? ""),
        });
        if (!keadaan.menyala || !panggil) {
          return ok({ ok: false, sebab: keadaan.sebab || "AI sedang dimatikan." });
        }

        // Naskah utuh melewati saringan yang sama dengan kiriman lain (J5).
        //
        // Jalur ini sempat memanggil penyedia langsung tanpa saringan - lubang
        // di penjagaan yang justru paling perlu, sebab yang dikirimnya bukan
        // beberapa ruas melainkan SELURUH isi berkas.
        //
        // Bawaan "naskah" adalah terlarang, dan tidak dapat dilonggarkan
        // dengan menyamarkan: menarik tanggal nikah dari naskah yang
        // tanggalnya sudah menjadi [TANGGAL] tidak mungkin. Pengadilan yang
        // hendak memakai penarikan fakta harus menambah barisnya sendiri di
        // aleta_batas_data, dan baris itu mencatat siapa yang memutuskannya.
        const kiriman = siapkanKiriman({ naskah }, buatPenyamar(randomUUID()), await aturanBatas(db));
        if (!kiriman.boleh || !kiriman.isi.naskah) {
          return ok({
            ok: false,
            sebab:
              kiriman.sebab ||
              "Naskah berkas belum diizinkan keluar. Tambahkan aturan batas untuk ruas \"naskah\" di " +
                "Pembaruan Sistem sebelum memakai penarikan fakta.",
            ditahan: kiriman.ditahan.map((item) => item.ruas),
          });
        }

        const tanggapan = await panggil(susunPerintah(ruasDiminta), kiriman.isi);
        if (!tanggapan.ok) return ok({ ok: false, sebab: tanggapan.sebab || "Model tidak menjawab." });

        const dariModel = Array.isArray((tanggapan.data as { fakta?: unknown })?.fakta)
          ? ((tanggapan.data as { fakta: unknown[] }).fakta as MasukanDariModel[])
          : [];

        const hasil = periksaTarikan({ naskah, ruasDiminta, dariModel });
        const tersimpan = String(masukan.perkaraId ?? "").trim()
          ? await simpanFakta(db, {
              perkaraId: String(masukan.perkaraId ?? ""),
              sumberBerkas: String(masukan.sumberBerkas ?? ""),
              hasil,
              oleh: aktor,
              penyedia: tanggapan.penyedia,
              model: tanggapan.model,
            })
          : 0;

        return ok({ ok: true, ...hasil, tersimpan, penyedia: tanggapan.penyedia, model: tanggapan.model });
      }

      case "sahkanFakta":
        return ok(
          await sahkanFakta(db, {
            faktaId: String(masukan.faktaId ?? ""),
            olehNama: String(masukan.olehNama ?? ""),
          })
        );

      case "usulkanButir": {
        const teks = String(masukan.teks ?? "");
        // Jangkar dibuka SEKARANG, bukan dipercaya dari daftar tersimpan:
        // peraturan dapat dimuat maupun dicabut di antara dua permintaan.
        const terbukti = new Set<string>();
        for (const rujukan of kenaliRujukan(teks)) {
          const jangkar = jangkarRujukan(rujukan);
          if (jangkar && (await bukaJangkar(db, jangkar))) terbukti.add(jangkar);
        }

        const usulan = periksaUsulan({ teks, isu: String(masukan.isu ?? "") }, terbukti);
        if (!usulan.layakDiusulkan) {
          return ok({ ok: false, sebab: usulan.sebab, usulan });
        }

        const hasil = await usulkanButirKePustaka(db, {
          usulan,
          jenisPerkara: String(masukan.jenisPerkara ?? ""),
          penyedia: "",
          model: "",
        });
        return ok({ ...hasil, usulan });
      }

      case "saklar": {
        // Lingkup pengadilan dan peran menuntut admin - keduanya mengenai
        // orang lain. Lingkup perkara TIDAK: hakim yang menanganinya berhak
        // memutuskan tidak ada apa pun dari berkas itu yang keluar, dan
        // kehati-hatian yang menuntut izin berhenti dilakukan.
        if (String(masukan.lingkup ?? "") !== "perkara") {
          await pastikanAdminIstimewa(db, actorUserId, "mengubah saklar AI");
        }
        return ok(
          await simpanSaklar(db, {
            lingkup: String(masukan.lingkup ?? ""),
            kunci: String(masukan.kunci ?? ""),
            menyala: Boolean(masukan.menyala),
            alasan: String(masukan.alasan ?? ""),
            oleh: String(masukan.olehNama ?? "") || aktor,
          })
        );
      }

      default:
        return ok({ ok: false, sebab: "Tindakan tidak dikenali." });
    }
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "LAPISAN_AI_UBAH_FAILED",
      feature: "aleta_ecourt",
      entityId: "lapisan-ai",
    });
  }
}

/**
 * Aturan batas tersimpan MENAMBAH aturan bawaan, tidak menggantikannya.
 *
 * Baris tersimpan diletakkan lebih dulu supaya keputusan pengadilan menang
 * atas bawaan pada ruas yang disebutnya - tetapi ruas yang tidak disebutnya
 * tetap tunduk pada bawaan yang ketat.
 */
async function aturanBatas(db: Awaited<ReturnType<typeof getDatabase>>) {
  const baris = await db.queryAll<Record<string, unknown>>(
    `SELECT ruas, batas, sebab FROM aleta_batas_data ORDER BY ruas ASC`
  );
  const tersimpan = baris.map((item) => ({
    ruas: String(item.ruas ?? "").trim(),
    batas: (String(item.batas ?? "terlarang") || "terlarang") as "bebas" | "samar" | "terlarang",
    sebab: String(item.sebab ?? "").trim(),
  }));
  const { BATAS_BAWAAN } = await import("@/lib/batas-data");
  return [...tersimpan, ...BATAS_BAWAAN];
}

/**
 * Peran aktor, untuk saklar lingkup peran.
 *
 * Gagal membacanya mengembalikan kosong, dan kosong TIDAK cocok dengan saklar
 * peran mana pun - artinya kegagalan membaca peran tidak pernah mematikan AI
 * bagi orang yang perannya tidak sedang dimatikan, dan tidak pernah pula
 * menyalakannya bagi yang dimatikan lewat lingkup lain.
 */
async function peranAktor(db: Awaited<ReturnType<typeof getDatabase>>, aktor: string): Promise<string> {
  if (!aktor) return "";
  try {
    const baris = await db.queryOne<Record<string, unknown>>(`SELECT role_id FROM users WHERE id = ?`, [aktor]);
    return String(baris?.role_id ?? "").trim();
  } catch {
    return "";
  }
}

type MasukanDariModel = { nama?: string; jenis?: string; nilai?: string; kutipan?: string; halaman?: number };

/**
 * Menyiapkan pemanggil model dari setelan yang berlaku.
 *
 * Bila AI dimatikan - global maupun per modul - `panggil` dikembalikan
 * undefined, bukan fungsi yang gagal saat dipanggil. Penjawab kemudian memilih
 * "tidak dijawab" tanpa pernah menyentuh jaringan, sehingga saklar mati
 * benar-benar berarti tidak ada yang keluar.
 */
async function siapkanModel(
  db: Awaited<ReturnType<typeof getDatabase>>,
  moduleKey: string,
  konteks: { peran: string; perkaraId: string }
): Promise<{ keadaan: { menyala: boolean; sebab: string }; panggil?: PemanggilModel }> {
  try {
    const setelan = await getAISettingsFromDb(db);
    const sambungan = resolveLiveAIConnectionForModule(setelan, moduleKey);

    // Saklar dibaca SETIAP KALI, tidak disinggahkan. Saklar mati yang baru
    // berlaku sesudah singgahan kedaluwarsa bukan saklar mati - dan sepuluh
    // menit sudah cukup untuk beberapa pertanyaan.
    const saklar = await keadaanAi(db, konteks, setelan.enabled);
    if (!saklar.menyala) {
      return { keadaan: { menyala: false, sebab: saklar.sebab } };
    }
    if (!sambungan) {
      return { keadaan: { menyala: false, sebab: "Belum ada penyedia AI yang tersetel untuk modul ini." } };
    }

    const panggil: PemanggilModel = async (perintah, isi) => {
      const hasil = await requestStructuredDataFromProvider<Record<string, unknown>>({
        providerId: String(sambungan.providerId ?? ""),
        modelId: String(sambungan.modelId ?? ""),
        apiKey: sambungan.apiKey ?? "",
        endpointUrl: sambungan.endpointUrl ?? null,
        systemPrompt: perintah,
        userPrompt: JSON.stringify(isi),
        fallback: {},
      });
      return {
        ok: hasil.ok,
        teks: hasil.rawText,
        data: hasil.data,
        penyedia: String(sambungan.providerId ?? ""),
        model: String(hasil.providerModelId || sambungan.modelId || ""),
        sebab: hasil.message,
      };
    };

    return { keadaan: { menyala: true, sebab: "" }, panggil };
  } catch {
    return { keadaan: { menyala: false, sebab: "Setelan AI tidak terbaca." } };
  }
}
