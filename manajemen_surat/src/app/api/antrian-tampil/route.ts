import { type NextRequest } from "next/server";

import { bawaanTampilAntrianPublik } from "@/lib/antrian-publik";
import {
  getGatewayAntrianSidang,
  getGatewayJadwalSidang,
} from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { bacaPengaturanAntrianPublik, pengaturanTertutup } from "@/server/modules/antrian-publik/service";
import { bacaSkorsBerlakuHariIni, keteranganSkorsPublik } from "@/server/modules/aleta-ecourt/skors-publik";
import { getDatabase } from "@/server/db/client";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ============================================================================
 * ANTRIAN SIDANG UNTUK ALAMAT TANPA LOGIN - ISINYA DIPUTUSKAN PIMPINAN
 * ============================================================================
 *
 * Diminta pengguna 23 September 2026: "buatkan link saja yang bisa langsung di
 * liat tanpa harus login untuk menampilkan antrian sidang, buat pengaturannya
 * juga di admin aleta untuk apa saja fitur yang bisa di tampilkan url antrian
 * sidang tanpa login ini, untuk defaultnya semua tampil".
 *
 * ============================================================================
 * KENAPA RUTE BARU, BUKAN MEMPERLUAS /api/antrian-ruang
 * ============================================================================
 *
 * /api/antrian-ruang menjawab EMPAT hal dan tidak pernah lebih: nomor antrian,
 * nomor ruang, keadaan, jam panggil. Batas itu bukan kelalaian - ia ditulis
 * panjang lebar di berkasnya sendiri, dan dipakai televisi ruang tunggu yang
 * sudah berjalan.
 *
 * Memperluasnya berarti seluruh pemakai lama ikut berubah isinya tanpa
 * diminta. Rute ini berdiri sendiri, menjawab sebanyak yang DIIZINKAN
 * pengaturannya, dan yang lama tetap sesempit sebelumnya.
 *
 * ============================================================================
 * DISARING DENGAN MENYUSUN, BUKAN DENGAN MENGHAPUS
 * ============================================================================
 *
 * Tiap ruas dimasukkan hanya bila izinnya menyala - objeknya disusun dari nol,
 * bukan disalin lalu dikurangi. Yang disusun ulang tidak dapat kebocoran ruas
 * baru yang suatu saat ditambahkan di hulu, dan ruas hulu memang bertambah
 * terus.
 *
 * ============================================================================
 * HANYA HARI INI
 * ============================================================================
 *
 * Rentangnya dikunci pada hari berjalan dan tidak dapat diminta lain dari
 * luar. Antrian hanya bermakna untuk sidang hari ini; membuka tanggal lain
 * mengubah layar ruang tunggu menjadi mesin penelusur register.
 */

function tanggalHariIni() {
  const sekarang = new Date();
  const bulan = String(sekarang.getMonth() + 1).padStart(2, "0");
  const hari = String(sekarang.getDate()).padStart(2, "0");
  return `${sekarang.getFullYear()}-${bulan}-${hari}`;
}

export async function GET(request: NextRequest) {
  try {
    const ruangDiminta = Number(request.nextUrl.searchParams.get("ruang") || 0);

    let pengaturan = pengaturanTertutup();
    try {
      const db = await getDatabase();
      pengaturan = await bacaPengaturanAntrianPublik(db);
    } catch {
      // Basis data tidak terbaca: yang berlaku bentuk paling sempit, bukan
      // bawaan "semua tampil". Ruas peka yang tampil karena kegagalan
      // pembacaan adalah ruas yang tidak pernah diputuskan siapa pun.
      pengaturan = pengaturanTertutup();
    }

    // Saklar induk mati: layarnya kosong seluruhnya, bukan kosong sebagian.
    if (!pengaturan.aktif) {
      return ok({
        available: false,
        message: "Layar antrian tanpa login sedang dimatikan.",
        ruang: ruangDiminta || null,
        tampil: {},
        baris: [],
      });
    }

    const tampil = pengaturan.tampil;
    const hasil = await getGatewayAntrianSidang();
    if (!hasil.ok || !hasil.data) {
      return ok({
        available: false,
        message: "Antrian belum dapat dibaca.",
        ruang: ruangDiminta || null,
        tampil,
        baris: [],
      });
    }

    // Nomor perkara, nama pihak, agenda, dan majelis TIDAK ada pada peta
    // antrian - ia berkunci perkara_id dan hanya memuat keterangan antrian.
    // Jadwal baru dibaca bila memang ada ruas yang membutuhkannya; perkara
    // yang tidak diizinkan tampil tidak perlu ditanyakan sama sekali.
    const perluJadwal =
      tampil.nomorPerkara || tampil.namaPihak || tampil.agenda || tampil.majelis;
    const petaJadwal = new Map<
      string,
      { nomorPerkara: string; pihak: string; agenda: string; majelis: string }
    >();
    if (perluJadwal) {
      const jadwal = await getGatewayJadwalSidang({
        dari: tanggalHariIni(),
        sampai: tanggalHariIni(),
        cari: "",
        batas: 500,
      });
      if (jadwal.ok && jadwal.data) {
        for (const baris of jadwal.data.sidang ?? []) {
          const penggugat = (baris.pihak?.penggugat ?? []).join(", ");
          const tergugat = (baris.pihak?.tergugat ?? []).join(", ");
          petaJadwal.set(String(baris.perkaraId), {
            nomorPerkara: String(baris.nomorPerkara || ""),
            pihak: [penggugat, tergugat].filter(Boolean).join(" lawan "),
            agenda: String(baris.agenda || ""),
            majelis: String(baris.majelisKode || ""),
          });
        }
      }
    }

    // ========================================================================
    // HANYA BARIS HARI INI - DAN TABELNYA SUNGGUH MEMUAT HARI LAIN
    // ========================================================================
    //
    // Tabel antrian milik aplikasi ruang tunggu berkunci perkara_id, bukan
    // tanggal, dan ia TERBUKTI memuat baris hari lain. Perkara
    // 216/Pdt.P/2026 memperlihatkannya: barisnya bertanggal 7 September
    // dengan pihak hadir pukul 08:43, dan angka itu ikut tergambar pada
    // jadwal 8 September sampai penjaga antrianUntuk() dipasang di layar
    // Jadwal Sidang.
    //
    // Pada rute lama /api/antrian-ruang akibatnya nomor antrian yang keliru
    // di televisi ruang tunggu. Di sini akibatnya lebih jauh: nomor perkara
    // dan nama para pihak dari hari lain terbaca siapa pun, tanpa login dan
    // tanpa jejak siapa yang membacanya.
    //
    // GAGAL-TERTUTUP: baris yang tanggalnya tidak terbaca DIBUANG, bukan
    // diloloskan. Yang tidak dapat dibuktikan milik hari ini tidak boleh
    // tampil di alamat yang terbuka.
    const hariIni = tanggalHariIni();
    // F3.1: perkara yang DISKORS tampil "Diskors, dilanjutkan sekitar 10.30" -
    // ikut izin ruas "keadaan". Urutan antrian TIDAK berubah (tetap nomor).
    const skorsBerlaku = tampil.keadaan ? await bacaSkorsBerlakuHariIni(hariIni) : new Map();
    const semua = Object.entries(hasil.data.peta || {})
      .filter(([, baris]) => String(baris.tanggalSidang || "").slice(0, 10) === hariIni)
      .map(([perkaraId, baris]) => {
        const tambahan = petaJadwal.get(String(perkaraId));
        const keluaran: Record<string, unknown> = {};
        if (tampil.nomorAntrian) keluaran.nomor = baris.nomor;
        if (tampil.noRuang) keluaran.noRuang = baris.noRuang;
        if (tampil.keadaan) {
          const skors = keteranganSkorsPublik(skorsBerlaku, perkaraId, baris.jamPanggil);
          keluaran.keadaan = skors ? "diskors" : baris.keadaan;
          if (skors) keluaran.keteranganSkors = skors;
        }
        if (tampil.jamPanggil) keluaran.jamPanggil = baris.jamPanggil;
        if (tampil.menitMenunggu) keluaran.menitMenunggu = baris.menitMenunggu ?? null;
        if (tampil.nomorPerkara) keluaran.nomorPerkara = tambahan?.nomorPerkara ?? "";
        if (tampil.namaPihak) keluaran.pihak = tambahan?.pihak ?? "";
        if (tampil.agenda) keluaran.agenda = tambahan?.agenda ?? "";
        if (tampil.majelis) keluaran.majelis = tambahan?.majelis ?? "";
        // Dipakai menyaring dan mengurutkan, TIDAK ikut keluar.
        return { keluaran, nomor: baris.nomor, noRuang: baris.noRuang };
      })
      .filter((x) => x.nomor !== null)
      .filter((x) => (ruangDiminta > 0 ? Number(x.noRuang) === ruangDiminta : true))
      .sort((a, b) => Number(a.nomor) - Number(b.nomor))
      .map((x) => x.keluaran);

    return ok({
      available: true,
      terbaca: hasil.data.terbaca,
      ruang: ruangDiminta || null,
      judul: pengaturan.judul,
      // Layarnya perlu tahu ruas mana yang ada supaya tidak menggambar kolom
      // kosong bagi ruas yang sengaja dimatikan.
      tampil,
      baris: semua,
    });
  } catch {
    // Tanpa login, galatnya tidak boleh menceritakan apa pun tentang dalamnya.
    return ok({
      available: false,
      message: "Antrian belum dapat dibaca.",
      ruang: null,
      tampil: bawaanTampilAntrianPublik(),
      baris: [],
    });
  }
}
