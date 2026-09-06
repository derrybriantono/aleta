import { type NextRequest } from "next/server";

import {
  getGatewayAntrianSidang,
  getGatewayJadwalSidang,
} from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ============================================================================
 * PAPAN PINTU RUANG SIDANG - SATU RUANG, DUA PERKARA
 * ============================================================================
 *
 * Layar yang dipasang di depan pintu ruang sidang, menghadap orang yang
 * menunggu gilirannya di koridor. Yang dijawab hanya DUA perkara: yang sedang
 * bersidang, dan yang berikutnya.
 *
 * ============================================================================
 * MENGAPA DI SINI NAMA PIHAK BOLEH TAMPIL, SEDANGKAN DI /api/antrian-ruang TIDAK
 * ============================================================================
 *
 * Keduanya tanpa login, tetapi menjawab pertanyaan yang berbeda.
 *
 * /api/antrian-ruang menjawab "nomor berapa sekarang" untuk SELURUH ruang
 * sekaligus. Ia dapat diminta tanpa menyebut apa pun, jadi yang dikeluarkan
 * dibatasi angka - kalau tidak, satu alamat sudah cukup untuk mengunduh
 * keadaan seluruh persidangan hari itu.
 *
 * Rute ini menuntut NOMOR RUANG yang disebut tegas, dan menjawab paling banyak
 * dua perkara dari ruang itu saja. Yang dikeluarkan sepadan dengan yang sudah
 * terpampang di papan pengumuman pengadilan dan diumumkan lewat pengeras suara
 * ruang tunggu: nomor perkara dan nama para pihak yang giliran sidangnya
 * sedang berlangsung.
 *
 * Yang TETAP tidak pernah keluar dari sini: agenda sidang, majelis dan
 * petugasnya, keterangan kehadiran, alamat pihak, dan seluruh perkara lain di
 * ruang yang sama. Papan pintu bukan tempat membaca register.
 *
 * Tanpa nomor ruang, jawabannya kosong - bukan seluruh ruang.
 */

function tanggalHariIni() {
  const sekarang = new Date();
  const bulan = String(sekarang.getMonth() + 1).padStart(2, "0");
  const hari = String(sekarang.getDate()).padStart(2, "0");
  return `${sekarang.getFullYear()}-${bulan}-${hari}`;
}

/** "Ruang Sidang 2" menjadi 2. SIPP menyimpan ruangan sebagai teks. */
function nomorRuang(teks: unknown) {
  const angka = String(teks || "").match(/\d+/);
  return angka ? Number(angka[0]) : 0;
}

type PerkaraPapan = {
  nomorPerkara: string;
  jenisPerkara: string;
  jamSidang: string;
  nomorAntrian: number | null;
  jamPanggil: string;
  penggugat: string;
  tergugat: string;
  /** "lawan" untuk gugatan, "dan" untuk permohonan - mengikuti kebiasaan. */
  penghubung: string;
};

export async function GET(request: NextRequest) {
  try {
    const ruang = Number(request.nextUrl.searchParams.get("ruang") || 0);

    // Tanpa ruang yang disebut tegas, tidak ada yang dijawab. Inilah penjaga
    // yang membedakan papan pintu dari daftar seluruh persidangan.
    if (!Number.isFinite(ruang) || ruang <= 0) {
      return ok({
        available: true,
        ruang: null,
        pesan: "Nomor ruang sidang wajib disebutkan.",
        sekarang: null,
        berikutnya: null,
      });
    }

    const hari = tanggalHariIni();
    const [jadwal, antrian] = await Promise.all([
      getGatewayJadwalSidang({ dari: hari, sampai: hari, cari: "", batas: 200 }),
      getGatewayAntrianSidang(),
    ]);

    if (!jadwal.ok || !jadwal.data) {
      return ok({
        available: false,
        ruang,
        pesan: "Jadwal sidang belum dapat dibaca.",
        sekarang: null,
        berikutnya: null,
      });
    }

    const petaAntrian = antrian.ok && antrian.data ? antrian.data.peta || {} : {};

    // Disusun ulang menjadi objek baru, bukan disaring dari yang lama - yang
    // disusun ulang tidak dapat kebocoran medan baru yang suatu saat
    // ditambahkan di hulu.
    const seruang = (jadwal.data.sidang || [])
      .filter((satu) => nomorRuang(satu.ruangan) === ruang)
      .map((satu) => {
        const antre = petaAntrian[String(satu.perkaraId || "")];
        const penggugat = Array.isArray(satu.pihak?.penggugat) ? satu.pihak.penggugat : [];
        const tergugat = Array.isArray(satu.pihak?.tergugat) ? satu.pihak.tergugat : [];

        const perkara: PerkaraPapan & { keadaan: string } = {
          nomorPerkara: String(satu.nomorPerkara || ""),
          jenisPerkara: String(satu.jenisPerkara || ""),
          jamSidang: String(satu.jamSidang || ""),
          nomorAntrian: antre?.nomor ?? null,
          jamPanggil: String(antre?.jamPanggil || ""),
          penggugat: penggugat.join("; "),
          tergugat: tergugat.join("; "),
          // Gugatan mempertemukan dua pihak yang berhadapan; permohonan tidak.
          // Menyebut "lawan" pada permohonan keliru menurut hukum acaranya.
          penghubung: /\/Pdt\.G/i.test(String(satu.nomorPerkara || "")) ? "lawan" : "dan",
          keadaan: String(antre?.keadaan || ""),
        };
        return perkara;
      });

    // Yang SEDANG bersidang: dipanggil, dengan jam panggil paling akhir.
    const dipanggil = seruang
      .filter((x) => x.keadaan === "dipanggil")
      .sort((a, b) => String(a.jamPanggil).localeCompare(String(b.jamPanggil)));
    const sekarang = dipanggil[dipanggil.length - 1] || null;

    // Yang BERIKUTNYA: nomor antrian terkecil yang masih menunggu. Perkara
    // yang belum ada pihaknya datang tidak bernomor, dan tidak dapat disebut
    // "berikutnya" - nomornya belum terbit.
    const menunggu = seruang
      .filter((x) => x.keadaan === "menunggu" && x.nomorAntrian !== null)
      .sort((a, b) => Number(a.nomorAntrian) - Number(b.nomorAntrian));
    const berikutnya = menunggu[0] || null;

    const buang = (x: (PerkaraPapan & { keadaan: string }) | null): PerkaraPapan | null => {
      if (!x) return null;
      const { keadaan: _keadaan, ...sisa } = x;
      return sisa;
    };

    return ok({
      available: true,
      ruang,
      pesan: "",
      jumlahSidang: seruang.length,
      sisaMenunggu: menunggu.length,
      sekarang: buang(sekarang),
      berikutnya: buang(berikutnya),
    });
  } catch {
    // Tanpa login, galatnya tidak boleh menceritakan apa pun tentang dalamnya.
    return ok({
      available: false,
      ruang: null,
      pesan: "Papan ruang sidang belum dapat dibaca.",
      sekarang: null,
      berikutnya: null,
    });
  }
}
