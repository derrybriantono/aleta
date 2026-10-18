import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { getGatewayAbtUsulan } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { kapabilitasPengguna, pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { bolehUnggahPutusan } from "@/server/modules/aleta-ecourt/hak-putusan";
import { bolehKasir } from "@/lib/kasir-jurnal";
import { golonganMenuEkstensi } from "@/lib/matriks-peran";
import { untukBot } from "@/server/modules/aleta-ecourt/tipe-keluaran";
import { requireActorUser } from "@/server/modules/organization/service";
import { roles as daftarPeran } from "@/lib/mock-data";
import { tambahUsulanAlamat } from "@/lib/alamat-pihak";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { ok } from "@/server/shared/http";

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

/**
 * Batas muatan permintaan (kontrak K6). Diperiksa atas badan mentah SEBELUM
 * diurai dan sebelum bot dipanggil - yang lebih besar dijawab 413. Templat 27
 * kumpulan ABT, dua keterangan saksi, dan posita sungguhan jauh di bawahnya.
 */
const BATAS_MUATAN = 64 * 1024;
// 12 Okt 2026: sampai 5 saksi Penggugat + 4 saksi Tergugat (dahulu 6 seluruhnya) - cermin BATAS_SAKSI_SDG di bot & ekstensi.
const BATAS_SAKSI = 9;

type BadanUsulan = {
  nomorPerkara?: unknown;
  /** Butir 28: nilai variabel 1268 dan keadaan mediasi. */
  upayaDamai?: unknown;
  mediasi?: unknown;
  sumber?: unknown;
  saksi1?: unknown;
  saksi2?: unknown;
  tanggalSidang?: unknown;
  pelaku?: unknown;
  lawan?: unknown;
  posita?: unknown;
  pemohon?: unknown;
  pemohon2?: unknown;
  templat?: unknown;
  alasan?: unknown;
  modus?: unknown;
  kodeKumpulan?: unknown;
  jenisPerkara?: unknown;
  alur?: unknown;
  saksi?: unknown;
  /** Sumber 'pertanyaan-saksi' (12 Okt 2026): { aksi: daftar|ambil, namaSet, pihak, huruf[], tambahan[] }. */
  pertanyaanSaksi?: unknown;
};

/** Set pertanyaan saksi baku - bentuknya dibatasi di sini, disaring lagi di bot. */
function saringPertanyaanSaksi(x: unknown) {
  if (!x || typeof x !== "object") return undefined;
  const r = x as Record<string, unknown>;
  const daftar = (v: unknown, batas: number, panjang: number) =>
    Array.isArray(v) ? (v as unknown[]).slice(0, batas).map((a) => String(a).slice(0, panjang)) : undefined;
  return {
    aksi: r.aksi === "ambil" ? ("ambil" as const) : ("daftar" as const),
    namaSet: String(r.namaSet || "").slice(0, 80),
    pihak: String(r.pihak || "").slice(0, 1).toUpperCase(),
    huruf: daftar(r.huruf, 8, 1),
    tambahan: daftar(r.tambahan, 6, 80),
  };
}

/** Modus satu saksi - dibatasi bentuknya di sini, dan disaring sekali lagi di bot. */
function saringModus(x: unknown) {
  const r = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
  return {
    modus: String(r.modus || "").slice(0, 20),
    sumber: String(r.sumber || "").slice(0, 20),
    // Sebutan pihak yang bercerita, dikirim ekstensi apa adanya. Dahulu
    // dibuang di sini, dan bot jatuh ke tafsiran kodenya: "cerita dari
    // Penggugat" tercetak "Tergugat bercerita".
    sumberNama: String(r.sumberNama || "").slice(0, 40),
    alasan: Array.isArray(r.alasan) ? (r.alasan as unknown[]).map((a) => String(a).slice(0, 80)).slice(0, 12) : [],
  };
}

/** Saksi N (K6) - sampai enam. Pihak dan urutannya diperiksa ketat di bot. */
function saringSaksi(x: unknown) {
  if (!Array.isArray(x)) return undefined;
  return (x as unknown[]).slice(0, BATAS_SAKSI).map((s) => {
    const r = (s && typeof s === "object" ? s : {}) as Record<string, unknown>;
    return {
      ke: Number(r.ke) || 0,
      pihak: String(r.pihak || "").slice(0, 1).toUpperCase(),
      ...saringModus(r),
    };
  });
}

function pesanGalat(galat: unknown) {
  return galat instanceof Error ? galat.message : String(galat);
}

/**
 * Pengaturan tipe keluaran untuk bot (K6), dari basis data portal.
 *
 * Yang dikirim hanya bila tabelnya SUNGGUH terbaca. Bila tidak - galat, atau
 * tabel tak terbaca sehingga yang ada hanya cermin kode - tidak ada yang
 * dikirim, bot memakai konstanta tertanamnya, dan sebabnya ikut dijawab
 * sebagai kabar. Keluarannya sama; yang berbeda hanya asalnya, dan asal itu
 * disebut jujur.
 */
async function tipeKeluaranBot(db: Awaited<ReturnType<typeof getDatabase>>) {
  try {
    const efektif = await untukBot(db);
    if (efektif.asal !== "basis-data") {
      return { tipeKeluaran: undefined, kabar: efektif.kabar };
    }
    return { tipeKeluaran: { versi: efektif.versi, daftar: efektif.daftar }, kabar: efektif.kabar };
  } catch (galat) {
    console.error("[ABT USULAN] Pengaturan tipe keluaran tidak terbaca; bot memakai kalimat tertanam.", galat);
    return {
      tipeKeluaran: undefined,
      kabar: [`Pengaturan tipe keluaran tidak terbaca - bot memakai kalimat tertanam: ${pesanGalat(galat)}`],
    };
  }
}

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const mentah = await request.text();
    const ukuran = Buffer.byteLength(mentah, "utf8");
    if (ukuran > BATAS_MUATAN) {
      throw new ApiError(
        413,
        `Muatan permintaan ${Math.ceil(ukuran / 1024)} KB melebihi batas ${BATAS_MUATAN / 1024} KB - tidak diteruskan ke ALETA Bot.`
      );
    }
    // Badan yang bukan JSON dijawab 400 dengan sebabnya - bukan diperlakukan
    // diam-diam sebagai permintaan kosong.
    let urai: unknown;
    try {
      urai = JSON.parse(mentah || "{}");
    } catch {
      throw new ApiError(400, "Badan permintaan usulan ABT bukan JSON yang sah.");
    }
    const body: BadanUsulan = urai && typeof urai === "object" && !Array.isArray(urai) ? (urai as BadanUsulan) : {};

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
          bolehUnggahPutusan: bolehUnggahPutusan(dia),
          // HAK-PERAN 12 Okt: ABT kini juga tahu jabatan & peran tambahan.
          bolehKasir: bolehKasir(dia),
          peranTambahan: dia.additionalRoleIds ?? [],
          golonganMenu: golonganMenuEkstensi(dia),
        },
        kapabilitas: await kapabilitasPengguna(db, { id: dia.id, roleId: String(dia.roleId), additionalRoleIds: dia.additionalRoleIds ?? [], positionId: dia.positionId, actingAssignment: dia.actingAssignment }),
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
    const pengguna = { nama: actor.name, peran: peran ? peran.name : String(actor.roleId || ""), bolehUnggahPutusan: bolehUnggahPutusan(actor) };

    const nomorPerkara = String(body.nomorPerkara || "").trim();
    if (!nomorPerkara) {
      return ok({ available: false, message: "Nomor perkara tidak terbaca dari halaman ABT." });
    }

    // "alasan-posita" (butir 12, 6 Okt 2026): alasan yang terbaca dari posita,
    // untuk centang modus saksi "Hanya sebagian alasan" sebelum disusun.
    const SUMBER_DIKENAL = ["sipp", "saksi", "itsbat", "saksi-sdg", "posita-lain", "alasan-posita", "pertanyaan-saksi"] as const;
    type Sumber = (typeof SUMBER_DIKENAL)[number] | "semua";
    const sumber: Sumber = (SUMBER_DIKENAL as readonly string[]).includes(sumberMinta)
      ? (sumberMinta as Sumber)
      : "semua";

    const tipe = await tipeKeluaranBot(db);

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
      // Sebutan pemohon (variabel 0046). Itsbat dahulu memakai `pelaku`
      // (0047 = Termohon) sebagai sebutan pemohon, sehingga labelnya
      // "Status Termohon sebelum nikah".
      pemohon: String(body.pemohon || "").slice(0, 40),
      pemohon2: String(body.pemohon2 || "").slice(0, 40),
      // Kode kumpulan templat dan jenis perkara - penentu varian kalimat dan
      // penentu aturan perkara lain.
      kodeKumpulan: String(body.kodeKumpulan || "").slice(0, 20),
      jenisPerkara: String(body.jenisPerkara || "").slice(0, 80),
      // Alur perkara - syarat bentuk bergender (data.syarat.alur).
      alur: String(body.alur || "").slice(0, 20),
      // Modus keterangan tiap saksi - dibatasi bentuknya di sini, dan disaring
      // sekali lagi di bot. Dua pagar untuk masukan yang datang dari peramban.
      modus:
        body.modus && typeof body.modus === "object"
          ? (() => {
              const m = body.modus as Record<string, unknown>;
              return { saksi1: saringModus(m.saksi1), saksi2: saringModus(m.saksi2) };
            })()
          : undefined,
      saksi: saringSaksi(body.saksi),
      pertanyaanSaksi: saringPertanyaanSaksi(body.pertanyaanSaksi),
      tipeKeluaran: tipe.tipeKeluaran,
      // Blangko tanya jawab, diambil ekstensi dari halaman penyunting ABT
      // (POST load_template) - ALETA tetap tidak membaca basis data ABT.
      // Dibatasi enam puluh baris dan panjang tiap ruasnya, sebab ia masukan.
      templat: Array.isArray(body.templat)
        ? (body.templat as unknown[]).slice(0, 60).map((b) => {
            const r = (b && typeof b === "object" ? b : {}) as Record<string, unknown>;
            return {
              no: String(r.no || "").slice(0, 4),
              tanya: String(r.tanya || "").slice(0, 600),
              jawab: String(r.jawab || "").slice(0, 2000),
              // Jawaban templat sebelum variabelnya diganti ABT ("#1241# / #1242#").
              // Tanpa ruas ini bot hanya dapat MENEBAK hubungan dua saksi dari
              // teks yang sudah terganti. Dahulu dibuang di sini tanpa bunyi.
              ...(r.jawabMentah !== undefined && r.jawabMentah !== null
                ? { jawabMentah: String(r.jawabMentah).slice(0, 2000) }
                : {}),
            };
          })
        : undefined,
      alasan: Array.isArray(body.alasan)
        ? (body.alasan as unknown[]).slice(0, 12).map((x) => String(x).slice(0, 80))
        : undefined,
      // Butir 28 (30 Sep 2026): nilai variabel 1268 (Upaya Damai Keluarga) dari
      // halaman ABT, dan keadaan mediasi bila ekstensi mengetahuinya - sumber
      // jawaban pertanyaan upaya rukun. Tanpa mediasi, bot membacanya dari SIPP.
      upayaDamai: String(body.upayaDamai || "").slice(0, 600),
      mediasi:
        body.mediasi && typeof body.mediasi === "object"
          ? {
              selesai: (body.mediasi as Record<string, unknown>).selesai === true,
              berhasil: (body.mediasi as Record<string, unknown>).berhasil === true,
            }
          : undefined,
    });

    if (!hasil.ok) {
      return ok({
        available: false,
        message: hasil.error || "ALETA Bot belum dapat dihubungi.",
      });
    }

    // Asal pengaturan yang SUNGGUH dipakai: 'portal' hanya bila bot
    // mengakui menerimanya. Bot lama mengabaikan tipeKeluaran tanpa bunyi -
    // dan itu harus terlihat, bukan dilaporkan sebagai 'portal'.
    const diterima = Boolean(tipe.tipeKeluaran) && hasil.data?.tipeKeluaranDiterima === true;
    const kabar = [...tipe.kabar];
    if (tipe.tipeKeluaran && !diterima) {
      kabar.push("ALETA Bot belum mengenal pengaturan tipe keluaran - kalimat tertanam yang dipakai.");
    }
    const ditolak = hasil.data?.tipeKeluaranDitolak ?? [];
    if (ditolak.length) {
      kabar.push(`${ditolak.length} entri pengaturan tipe keluaran ditolak penyaring bot dan tidak dipakai.`);
    }

    return ok({
      tipeKeluaranAsal: diterima ? ("portal" as const) : ("tertanam" as const),
      tipeKeluaranVersi: diterima && tipe.tipeKeluaran ? tipe.tipeKeluaran.versi : null,
      tipeKeluaranDitolak: ditolak,
      saksiDitolak: hasil.data?.saksiDitolak ?? [],
      kabar,
      positaLain: hasil.data?.positaLain ?? null,
      alasanPosita: hasil.data?.alasanPosita ?? null,
      available: true,
      message: "",
      // Diteruskan utuh, bukan disusun ulang medan demi medan. Rute massal
      // pernah menyusun ulang jawabannya begitu, dan medan yang lupa
      // didaftarkan hilang tanpa bunyi - empat kali dalam satu hari.
      pengguna,
      // Butir 9 (1.189.x): usulan "Alamat Putusan" (8548/8549) dari alamat
      // SIPP yang dirapikan + Domisili Elektronik - SIPP sendiri tidak diubah.
      sipp: tambahUsulanAlamat(hasil.data?.sipp ?? null),
      saksi: hasil.data?.saksi ?? null,
      itsbat: hasil.data?.itsbat ?? null,
      saksiSdg: hasil.data?.saksiSdg ?? null,
      pertanyaanSaksi: hasil.data?.pertanyaanSaksi ?? null,
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
