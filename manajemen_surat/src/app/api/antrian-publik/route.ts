import { type NextRequest } from "next/server";

import {
  catatKehadiranAntrian,
  getGatewayAntrianSidang,
  getGatewayJadwalSidang,
  getGatewayPeranAntrian,
} from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ============================================================================
 * MENGAMBIL ANTRIAN SIDANG - TANPA LOGIN, DAN KARENA ITU SANGAT DIBATASI
 * ============================================================================
 *
 * Yang memakai rute ini orang yang baru datang ke pengadilan dan berdiri di
 * depan layar sentuh ruang tunggu. Menuntut mereka login berarti antriannya
 * tidak akan pernah dipakai - dan itu persis cara aplikasi antrian yang sudah
 * ada bekerja: cari perkaranya, tekan hadir, ambil nomor.
 *
 * ============================================================================
 * TIDAK ADA DAFTAR TANPA DICARI
 * ============================================================================
 *
 * Inilah penjaga yang paling menentukan. Permintaan tanpa kata cari dijawab
 * KOSONG, bukan dijawab seluruh sidang hari itu. Tanpa penjaga ini, siapa pun
 * di jaringan pengadilan dapat mengunduh seluruh daftar perkara hari itu
 * beserta nama para pihaknya hanya dengan membuka satu alamat - dan daftar
 * itu memang ada, hanya saja tempatnya di balik login.
 *
 * Kata carinya juga dituntut cukup panjang. Satu huruf akan mencocokkan
 * hampir semua orang, dan itu daftar juga - hanya dengan cara yang lebih
 * lambat.
 *
 * ============================================================================
 * YANG DIJAWAB, DAN YANG TIDAK
 * ============================================================================
 *
 * Dijawab  : nomor perkara, jenis, jam, ruang, agenda, nama para pihak,
 *            nomor antrian dan siapa yang sudah hadir.
 * TIDAK    : alamat pihak, nama majelis dan petugas, berkas, catatan SIPP,
 *            kesiapan, dan seluruh keterangan lain yang ada di portal.
 *
 * Nama para pihak memang dijawab: orang harus dapat mengenali perkaranya
 * sendiri sebelum menekan hadir, dan aplikasi antrian yang sudah ada pun
 * menampilkannya di layar sentuh yang sama. Yang dijaga adalah tidak adanya
 * cara MENDAFTAR - keterangan itu hanya keluar untuk perkara yang sudah
 * ditemukan lewat kata cari yang cukup pasti.
 *
 * ============================================================================
 * HANYA HARI INI
 * ============================================================================
 *
 * Rentangnya dikunci pada hari berjalan, tidak dapat diminta lain dari luar.
 * Antrian hanya bermakna untuk sidang hari ini, dan membuka tanggal lain
 * mengubah layar sentuh ruang tunggu menjadi mesin penelusur register.
 */

/** Sekurang-kurangnya sekian huruf sebelum apa pun dijawab. */
const CARI_MINIMAL = 3;

function tanggalHariIni() {
  const sekarang = new Date();
  const bulan = String(sekarang.getMonth() + 1).padStart(2, "0");
  const hari = String(sekarang.getDate()).padStart(2, "0");
  return `${sekarang.getFullYear()}-${bulan}-${hari}`;
}

type BarisPublik = {
  perkaraId: string;
  nomorPerkara: string;
  jenisPerkara: string;
  jamSidang: string;
  ruangan: string;
  agenda: string;
  penggugat: string[];
  tergugat: string[];
  nomorAntrian: number | null;
  keadaan: string;
  sudahHadir: Array<{ sebutan: string; jam: string }>;
};

export async function GET(request: NextRequest) {
  try {
    const cari = String(request.nextUrl.searchParams.get("cari") || "").trim();

    // Daftar pilihan peran boleh diambil tanpa mencari - isinya kosakata
    // tetap ("Penggugat", "Tergugat", "Saksi"), bukan keterangan perkara.
    if (request.nextUrl.searchParams.get("peran") === "1") {
      const peran = await getGatewayPeranAntrian();
      return ok({ available: peran.ok, peran: peran.ok && peran.data ? peran.data.peran : [] });
    }

    if (cari.length < CARI_MINIMAL) {
      return ok({
        available: true,
        cari,
        terlaluPendek: cari.length > 0,
        pesan:
          cari.length > 0
            ? `Ketik sekurang-kurangnya ${CARI_MINIMAL} huruf nama atau nomor perkara.`
            : "",
        baris: [],
      });
    }

    const hari = tanggalHariIni();
    const [jadwal, antrian] = await Promise.all([
      getGatewayJadwalSidang({ dari: hari, sampai: hari, cari, batas: 50 }),
      getGatewayAntrianSidang(),
    ]);

    if (!jadwal.ok || !jadwal.data) {
      return ok({ available: false, pesan: "Jadwal sidang belum dapat dibaca.", baris: [] });
    }

    const petaAntrian = antrian.ok && antrian.data ? antrian.data.peta || {} : {};
    const petaKehadiran = antrian.ok && antrian.data ? antrian.data.kehadiran || {} : {};

    // Disusun ulang menjadi objek baru, bukan disaring dari yang lama: yang
    // disusun ulang tidak dapat kebocoran medan baru yang suatu saat
    // ditambahkan di hulu.
    const baris: BarisPublik[] = (jadwal.data.sidang || []).map((satu) => {
      const kunci = String(satu.perkaraId || "");
      const antre = petaAntrian[kunci];
      const hadir = petaKehadiran[kunci];

      return {
        perkaraId: kunci,
        nomorPerkara: String(satu.nomorPerkara || ""),
        jenisPerkara: String(satu.jenisPerkara || ""),
        jamSidang: String(satu.jamSidang || ""),
        ruangan: String(satu.ruangan || ""),
        agenda: String(satu.agenda || ""),
        penggugat: Array.isArray(satu.pihak?.penggugat) ? satu.pihak.penggugat : [],
        tergugat: Array.isArray(satu.pihak?.tergugat) ? satu.pihak.tergugat : [],
        nomorAntrian: antre?.nomor ?? null,
        keadaan: String(antre?.keadaan || ""),
        sudahHadir: Array.isArray(hadir?.hadir)
          ? hadir.hadir.map((x: { sebutan?: string; jam?: string }) => ({
              sebutan: String(x.sebutan || ""),
              jam: String(x.jam || ""),
            }))
          : [],
      };
    });

    return ok({ available: true, cari, tanggal: hari, baris });
  } catch {
    // Tanpa login, galatnya tidak boleh menceritakan apa pun tentang dalamnya.
    return ok({ available: false, pesan: "Antrian belum dapat dibaca.", baris: [] });
  }
}

/**
 * Mencatat kehadiran, yang sekaligus menerbitkan nomor antrian.
 *
 * Nomor lahir dari kehadiran PERTAMA pada satu perkara. Yang datang berikutnya
 * tetap dicatat tetapi tidak menggeser nomornya - itu urusan bot, dan sengaja
 * tidak diulang di sini supaya tidak ada dua tempat yang menentukan nomor.
 *
 * Yang dicatat dari sini bertanda sumber "mesin": sama dengan layar sentuh
 * ruang tunggu, berbeda dengan yang diambil lewat WhatsApp dari rumah.
 * Bedanya perlu terbaca petugas - yang mengambil di mesin sudah berada di
 * gedung.
 */
export async function POST(request: NextRequest) {
  try {
    const isi = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    const perkaraId = String(isi.perkaraId || "").trim();
    const peran = String(isi.peran || "").trim();
    if (!perkaraId || !peran) {
      return ok({ ok: false, alasan: "Perkara dan peran wajib dipilih." });
    }

    const hasil = await catatKehadiranAntrian({
      perkaraId,
      nomorPerkara: String(isi.nomorPerkara || ""),
      peran,
      urutanPihak: String(isi.urutanPihak || ""),
      sebagaiKuasa: isi.sebagaiKuasa === true,
      // Nama tidak diminta di layar sentuh: orang yang sedang berdiri
      // mengantre tidak akan mengetiknya, dan yang diketik asal-asalan lebih
      // buruk daripada kosong. Petugas dapat melengkapinya dari portal.
      nama: String(isi.nama || "").slice(0, 120),
      dicatatOleh: "mesin-antrian",
    });

    // Dipisah dua supaya penyempitan tipe bekerja: `error` hanya ada pada
    // cabang gagal, dan `data` hanya pada cabang berhasil.
    if (!hasil.ok) {
      return ok({ ok: false, alasan: hasil.error || "Kehadiran belum dapat dicatat." });
    }
    if (!hasil.data) {
      return ok({ ok: false, alasan: "Kehadiran belum dapat dicatat." });
    }

    return ok(hasil.data);
  } catch {
    return ok({ ok: false, alasan: "Kehadiran belum dapat dicatat." });
  }
}
