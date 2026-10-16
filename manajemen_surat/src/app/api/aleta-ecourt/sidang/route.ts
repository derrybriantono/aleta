import { type NextRequest } from "next/server";

import { keadaanPutusan, type MasukanKeadaanPutusan } from "@/lib/keadaan-putusan";
import { lengkapiPetaDariRekam, susunRekamAntrian } from "@/lib/rekam-antrian";
import { hitungTigaJarak, kunciWaktu, WAKTU_ANTRIAN_KOSONG } from "@/lib/tiga-jarak-sidang";
import { waktuPengadilan } from "@/lib/waktu-pengadilan";
import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { picuPindaiJawaban } from "@/server/modules/aleta-ecourt/penanda-jawaban";
import { bacaRekamAntrian, rekamAntrian } from "@/server/modules/aleta-ecourt/rekam-antrian";
import {
  getGatewayArsipRincian,
  getGatewayJadwalSidang,
  getGatewayKalenderSidang,
  getGatewayKesiapanBanyak,
  getGatewayKesiapanSatu,
  getGatewayRincianSidang,
  getGatewaySippKonteks,
} from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Jadwal perkara yang bersidang.
 *
 * ============================================================================
 * SATU RUTE, DUA KEDALAMAN
 * ============================================================================
 *
 *   tanpa ?nomor  - daftar sidang pada rentang tanggal, satu baris per sidang
 *   dengan ?nomor - seluruh keterangan satu sidang
 *
 * ============================================================================
 * TIGA SUMBER DISATUKAN DI SINI, BUKAN DI PERAMBAN
 * ============================================================================
 *
 * Rincian satu sidang memerlukan tiga hal yang tersimpan di tempat berbeda:
 *
 *   SIPP   - majelis, panitera, jurusita, saksi, relaas, dokumen perkara
 *   e-Court- berkas para pihak beserta keadaan verifikasi majelis
 *   SIPP   - identitas pihak, kuasa hukum, jenis dan kumulasi perkara
 *
 * Ketiganya diminta bersamaan dari server, bukan tiga permintaan berurutan
 * dari peramban. Petugas yang membuka satu sidang menunggu satu kali, bukan
 * tiga kali - dan halaman tidak menampilkan bagian yang muncul satu per satu.
 *
 * Tiap bagian gagal sendiri-sendiri: e-Court yang sedang tidak terbaca tidak
 * boleh menghilangkan majelis dan agenda yang sudah ada di SIPP.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);

    // Kemampuan yang sama dengan panel di halaman SIPP: layar ini menampilkan
    // keterangan perkara yang sama, hanya disusun menurut jadwal sidang.
    const actor = await pastikanKapabilitas(db, actorUserId, "panel");

    // Kalender diminta lebih dulu: ia hanya berisi hitungan per hari, dan
    // tidak memerlukan satu pun permintaan lain.
    const bulan = String(request.nextUrl.searchParams.get("kalender") || "").trim();
    if (bulan) {
      const kalender = await getGatewayKalenderSidang(bulan);
      if (!kalender.ok) {
        return ok({
          available: false,
          message: kalender.error || "ALETA Bot belum dapat dihubungi.",
          hari: [],
        });
      }
      return ok({
        available: true,
        bulan: kalender.data?.bulan ?? bulan,
        hari: kalender.data?.hari ?? [],
      });
    }

    const nomor = String(request.nextUrl.searchParams.get("nomor") || "").trim();

    if (nomor) {
      const sidangId = String(request.nextUrl.searchParams.get("sidangId") || "").trim();

      const [rincian, arsip, konteks, kesiapan] = await Promise.all([
        getGatewayRincianSidang(nomor, sidangId),
        getGatewayArsipRincian(nomor),
        getGatewaySippKonteks(nomor, actor.name),
        getGatewayKesiapanSatu({
          nomor,
          sidangId,
          tanggalSidang: String(request.nextUrl.searchParams.get("tanggalSidang") || ""),
          agenda: String(request.nextUrl.searchParams.get("agenda") || ""),
        }),
      ]);

      return ok({
        available: true,
        nomorPerkara: nomor,
        sipp: rincian.ok ? (rincian.data ?? null) : null,
        pesanSipp: rincian.ok ? "" : rincian.error || "Keterangan SIPP belum dapat dibaca.",
        ecourt: arsip.ok ? (arsip.data?.dokumen ?? []) : [],
        pesanEcourt: arsip.ok ? "" : arsip.error || "Arsip e-Court belum dapat dibaca.",
        // nomorPihak memuat pihak DAN kuasa hukumnya; identitas memuat jenis
        // perkara, kumulasi, dan ada tidaknya kuasa pada tiap sisi.
        pihak: konteks.ok ? (konteks.data?.nomorPihak ?? []) : [],
        identitas: konteks.ok ? (konteks.data?.identitas ?? null) : null,
        hakim: konteks.ok ? (konteks.data?.hakim ?? null) : null,
        kesiapan: kesiapan.ok ? (kesiapan.data?.kesiapan ?? null) : null,
      });
    }

    const hasil = await getGatewayJadwalSidang({
      dari: String(request.nextUrl.searchParams.get("dari") || ""),
      sampai: String(request.nextUrl.searchParams.get("sampai") || ""),
      cari: String(request.nextUrl.searchParams.get("cari") || ""),
      batas: Number(request.nextUrl.searchParams.get("batas")) || 200,
      // Hanya layar INI yang memakai waktu antrian (tiga jarak dan rekaman
      // berdetik). Rute lain yang memanggil jadwal yang sama - termasuk layar
      // publik yang memuat ulang berkala - tidak memintanya dan tidak
      // menanggung kuerinya. Temuan penelaah 27 September 2026.
      waktu: true,
    });

    if (!hasil.ok) {
      return ok({
        available: false,
        message: hasil.error || "ALETA Bot belum dapat dihubungi.",
        sidang: [],
      });
    }

    const sidang = hasil.data?.sidang ?? [];

    // Butir 4 (6 Okt 2026): baca jawaban/duplik Tergugat yang belum dibaca -
    // di LATAR, tidak ditunggu, berjeda semenit. Perkara yang tampil lebih dulu.
    // Hasilnya disinggahkan bot dan muncul pada pemuatan berikutnya.
    picuPindaiJawaban(sidang.map((baris) => String(baris.nomorPerkara ?? "")).filter(Boolean));

    // Skor dihitung hanya bila diminta. Menilai kesiapan menembakkan beberapa
    // kueri per sidang, dan pemuatan jadwal biasa tidak boleh menanggung
    // ongkosnya - petugas yang hanya ingin melihat jam sidang tidak perlu
    // menunggu penilaian puluhan perkara.
    let kesiapan: Record<string, unknown> = {};
    let kesiapanDinilai = 0;

    if (request.nextUrl.searchParams.get("kesiapan") === "1" && sidang.length > 0) {
      const hasilKesiapan = await getGatewayKesiapanBanyak(
        sidang.map((baris) => ({
          nomorPerkara: baris.nomorPerkara,
          sidangId: baris.sidangId,
          // Dikirim supaya bot dapat membaca keadaan panggilan SELURUH sidang
          // dengan satu kelompok kueri. Tanpa ini penilaiannya tetap benar,
          // hanya menembakkan tiga kueri per sidang alih-alih tiga untuk
          // lima puluh sidang sekaligus.
          perkaraId: baris.perkaraId,
          tanggalSidang: baris.tanggalSidang,
          agenda: baris.agenda,
        })),
        50
      );
      if (hasilKesiapan.ok) {
        kesiapan = hasilKesiapan.data?.kesiapan ?? {};
        kesiapanDinilai = hasilKesiapan.data?.dinilai ?? 0;
      }
    }

    // ========================================================================
    // REKAMAN ANTRIAN DITULIS DI SINI, BUKAN DARI PERAMBAN
    // ========================================================================
    //
    // Sebabnya dua.
    //
    // Pertama, tidak ada permintaan tambahan. Layar jadwal memuat ulang
    // sendiri secara berkala; satu permintaan rekam per pemuatan berarti
    // menggandakan lalu lintasnya seharian untuk catatan yang tidak dilihat
    // siapa pun saat itu.
    //
    // Kedua, yang direkam tidak berasal dari peramban. Angka yang dikirim
    // balik oleh halaman dapat disunting siapa saja yang membuka DevTools, dan
    // catatan pelayanan yang dapat disunting dari luar tidak berguna sebagai
    // catatan pelayanan.
    //
    // Gagalnya TIDAK menjatuhkan jadwalnya - lihat catatan pada rekamAntrian.
    //
    // ========================================================================
    // WAKTU ANTRIAN: TIGA JARAK DIHITUNG DI SINI DENGAN FUNGSI YANG SAMA
    // ========================================================================
    //
    // hitungTigaJarak dijalankan di peladen hanya untuk REKAMAN, atas baris
    // yang sama persis dengan yang dikirim ke peramban - sehingga angka yang
    // tersimpan adalah angka yang dilihat orang di layar. Yang masih berjalan
    // disimpan NULL: ia belum punya angka tetap.
    //
    // Hari lampau yang tidak punya sumber antrian sama sekali - tidak di
    // aplikasi antrian, tidak di buku waktu bot - TIDAK ditulis. Sampai 2.38
    // membuka jadwal hari lampau menimpa rekaman hari itu dengan nomor kosong,
    // sebab aplikasi antrian sudah tidak menyimpan baris hari tersebut.
    let rekam = { ditulis: 0, gagal: "" };
    const antrianData = hasil.data?.antrian;
    const waktuAntrian = hasil.data?.waktuAntrian ?? WAKTU_ANTRIAN_KOSONG;
    const langsungTerbaca = Boolean(antrianData?.terbaca);
    if ((langsungTerbaca || waktuAntrian.terbaca) && sidang.length > 0) {
      const hariIni = waktuAntrian.hariIni || waktuPengadilan().tanggal;
      const ruangSipp: Record<string, string> = {};
      for (const baris of sidang) {
        ruangSipp[kunciWaktu(String(baris.tanggalSidang ?? ""), String(baris.perkaraId ?? ""))] = String(
          baris.ruangan ?? ""
        );
      }
      const susunan = susunRekamAntrian(
        sidang.map((baris) => ({
          perkaraId: String(baris.perkaraId ?? ""),
          nomorPerkara: String(baris.nomorPerkara ?? ""),
          sidangId: String(baris.sidangId ?? ""),
          tanggalSidang: String(baris.tanggalSidang ?? ""),
          ruangan: String(baris.ruangan ?? ""),
        })),
        antrianData?.terbaca ? antrianData.peta : undefined,
        {
          terbaca: waktuAntrian.terbaca,
          baris: waktuAntrian.baris,
          tiga: waktuAntrian.terbaca
            ? hitungTigaJarak(waktuAntrian.baris, { hariIni, ruangSipp })
            : {},
          // Penentu baris hari lampau - yang hanya boleh BERTAMBAH lengkap,
          // tidak pernah dikosongkan (lihat gabungRekamLampau).
          hariIni,
        }
      );
      rekam = await rekamAntrian(
        db,
        susunan.filter(
          (baris) =>
            baris.bersumber ||
            // Hari INI tetap merekam yang belum mengambil nomor - itu
            // keterangan, bukan ketiadaan keterangan - selama aplikasi
            // antriannya sungguh terbaca.
            (langsungTerbaca && baris.tanggalSidang === hariIni)
        )
      );
    }

    // ========================================================================
    // NOMOR ANTRIAN HARI LAMPAU DARI REKAMAN ALETA (butir 32, 30 Sep 2026)
    // ========================================================================
    //
    // Aplikasi antrian hanya menyimpan hari ini; rekaman ALETA menyimpan
    // nomor tiap sidang. Sidang tanpa baris antrian langsung pada tanggalnya
    // diisi dari rekaman - lihat lengkapiPetaDariRekam. Gagal membaca
    // rekaman tidak menjatuhkan jadwalnya.
    let antrianKeluar = hasil.data?.antrian ?? {
      terbaca: false,
      alasan: "bot tidak mengirimkan keterangan antrian",
      tanggal: [],
      peta: {},
    };
    let dariRekam = 0;
    const dariMinta = String(hasil.data?.dari || request.nextUrl.searchParams.get("dari") || "");
    const sampaiMinta = String(hasil.data?.sampai || request.nextUrl.searchParams.get("sampai") || "") || dariMinta;
    if (sidang.length > 0 && dariMinta) {
      try {
        const tersimpan = await bacaRekamAntrian(db, dariMinta, sampaiMinta);
        const lengkap = lengkapiPetaDariRekam(
          (antrianKeluar.peta ?? {}) as Record<string, { tanggalSidang?: string }>,
          sidang.map((b) => ({
            perkaraId: String(b.perkaraId ?? ""),
            tanggalSidang: String(b.tanggalSidang ?? ""),
            sidangId: String(b.sidangId ?? ""),
          })),
          tersimpan
        );
        dariRekam = lengkap.ditambah;
        if (lengkap.ditambah > 0) {
          antrianKeluar = {
            ...antrianKeluar,
            terbaca: true,
            alasan: antrianKeluar.terbaca
              ? antrianKeluar.alasan
              : "nomor antrian dibaca dari rekaman ALETA - aplikasi antrian hanya menyimpan hari ini",
            tanggal: [...new Set([...(antrianKeluar.tanggal ?? []), ...lengkap.tanggal])].sort(),
            peta: lengkap.peta as typeof antrianKeluar.peta,
          };
        }
      } catch {
        // Rekaman tidak terbaca: kolom antrian tetap seperti jawaban bot.
      }
    }

    return ok({
      available: true,
      dari: hasil.data?.dari ?? "",
      sampai: hasil.data?.sampai ?? "",
      diperiksaPada: hasil.data?.diperiksaPada ?? "",
      // Q3 16 Okt: keadaan putusan tiap baris (mediasi sebagian, T tidak hadir setelah mediasi, ...) untuk pemilihan blangko putusan
      // per keadaan di ekstensi (lib/keadaan-putusan.ts). Ruas tambahan; ekstensi lama mengabaikannya.
      sidang: sidang.map((baris) => ({ ...baris, keadaanPutusan: keadaanPutusan(baris as unknown as MasukanKeadaanPutusan) })),
      kesiapan,
      kesiapanDinilai,
      // Disebutkan apa adanya. Rekaman yang diam-diam tidak pernah tertulis -
      // sebab migrasinya terlewat, misalnya - akan ditemukan berbulan-bulan
      // kemudian sebagai riwayat yang kosong, dan saat itu harinya sudah lewat.
      rekamAntrian: rekam,
      // Diteruskan apa adanya, termasuk saat tidak terbaca. Layar jadwal yang
      // menampilkan kolom antrian kosong tanpa sebab akan disangka rusak;
      // yang menyebutkan "sambungan antrian tidak terbaca" dapat ditindaklanjuti.
      antrian: { ...antrianKeluar, dariRekam },
      // Bahan tiga jarak waktu di layar, apa adanya - termasuk "sekarang"
      // menurut jam aplikasi antrian, patokan angka yang berjalan. Bot lama
      // yang tidak mengirimnya dijawab kosong beserta sebabnya.
      waktuAntrian: hasil.data?.waktuAntrian ?? {
        ...WAKTU_ANTRIAN_KOSONG,
        alasan: "bot tidak mengirimkan waktu antrian",
      },
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ECOURT_JADWAL_SIDANG_READ_FAILED",
      feature: "aleta_ecourt",
    });
  }
}
