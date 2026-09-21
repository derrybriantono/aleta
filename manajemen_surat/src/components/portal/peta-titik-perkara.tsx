"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Columns2,
  Info,
  Layers,
  Maximize2,
  MapPin,
  Minimize2,
  Users,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { apiPath } from "@/lib/base-path";

import { withBasePath } from "@/lib/base-path";
import { cn } from "@/lib/utils";
import {
  muatLeaflet,
  type PetaKumpulan,
  type PetaObjek,
  type PetaTitik,
} from "@/lib/peta-leaflet";

/**
 * ============================================================================
 * PETA TITIK PERKARA - SATU LINGKARAN PER DESA
 * ============================================================================
 *
 * ============================================================================
 * KOORDINATNYA TIDAK DATANG DARI SIPP, DAN ITU BUKAN PILIHAN
 * ============================================================================
 *
 * Seluruh basis data SIPP disisir lewat information_schema: satu-satunya tabel
 * yang punya kolom lintang/bujur adalah `kode_pos`, dan 2.023 barisnya untuk
 * Sulawesi Tengah hanya memuat SEMBILAN titik - satu per kabupaten, disalin ke
 * tiap desa di bawahnya. Digambar apa adanya, 1.917 desa menumpuk jadi 9 titik.
 *
 * Titik di sini datang dari OpenStreetMap, dijodohkan SEKALI di luar portal
 * (lihat kerja/jodohkan-desa.py), dan disimpan berkunci kode wilayah BPS.
 * Portal hanya mencari kunci - tidak ada penjodohan nama saat halaman dibuka,
 * sebab penjodohan nama adalah tebakan dan tebakan yang dijalankan tiap kali
 * dapat berubah jawabannya tanpa ada yang menyentuh apa pun.
 *
 * ============================================================================
 * YANG TIDAK BERKOORDINAT TIDAK DIGESER KE TEMPAT TERDEKAT
 * ============================================================================
 *
 * Desa yang tidak berjodoh TIDAK digambar di pusat kecamatannya. Itu akan
 * membuat petanya terlihat lengkap sambil memindahkan perkara ke desa yang
 * bukan asalnya - dan tidak ada yang akan memeriksanya. Ia disebutkan sebagai
 * angka di bawah peta, apa adanya.
 *
 * ============================================================================
 * KENAPA KANVAS, DAN KENAPA AKARNYA
 * ============================================================================
 *
 * Tiap desa = satu lingkaran. Sebagai elemen SVG, tujuh ratus lingkaran
 * berarti tujuh ratus simpul DOM yang digambar ulang tiap kali peta digeser -
 * dan itulah lag yang diminta satker supaya tidak ada. Dengan penggambar
 * kanvas, seluruhnya satu elemen.
 *
 * Jari-jarinya sebanding dengan AKAR jumlah perkara, bukan jumlahnya. Mata
 * membaca LUAS lingkaran, bukan jari-jarinya: desa berperkara 100 yang
 * jari-jarinya sepuluh kali desa berperkara 1 akan terlihat seratus kali lebih
 * besar - dan itu memang seratus kali, tetapi luasnya sepuluh ribu kali.
 */

export type TitikPerkara = {
  kode: string;
  nama: string;
  kecamatan: string;
  kabupaten: string;
  perkara: number;
  lelaki: number;
  perempuan: number;
  jenis: Record<string, number>;
};

type BerkasTitik = {
  dibuat?: string;
  sumber?: string;
  cakupan?: {
    desaBerkoordinat?: number;
    desaSeluruhnya?: number;
    barisBerkoordinat?: number;
    barisSeluruhnya?: number;
  };
  titik?: Record<string, [number, number]>;
};

/**
 * Ubinan peta.
 *
 * Dapat diganti satker lewat NEXT_PUBLIC_PETA_UBIN - misalnya menunjuk peladen
 * ubin milik sendiri di jaringan dalam. Bawaannya OpenStreetMap, dan
 * penyebutan sumbernya WAJIB ditampilkan: datanya ODbL, dan syaratnya
 * menyebut. Itu sebabnya penyebutan itu tidak dapat dimatikan dari layar.
 */
const UBIN =
  process.env.NEXT_PUBLIC_PETA_UBIN || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const SEBUT = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

/**
 * Bagian perkara yang menentukan pandangan awal peta.
 *
 * Diukur pada data satker - kotak yang memuat desa-desa terdekat yang
 * bersama-sama memuat sekian persen perkara:
 *
 *     80%  202 desa   0,76 x 0,93 derajat
 *     85%  225 desa   0,77 x 1,09
 *     90%  259 desa   1,12 x 1,44
 *     95%  295 desa   1,42 x 2,01
 *
 * Melompat dari 85% ke 95% melebarkan pandangan hampir dua kali untuk sepuluh
 * persen perkara terakhir - dan pada pandangan selebar itu seluruh lembah Palu
 * menyusut menjadi gumpalan yang tidak dapat dibaca. Dipilih 85%.
 *
 * Yang di luarnya TETAP DIGAMBAR; ia hanya tidak ikut menentukan ke mana peta
 * membuka.
 */
const AMBANG_INTI = 0.85;

/** Tengah Sulawesi Tengah - dipakai hanya bila tidak ada satu titik pun. */
const TENGAH: [number, number] = [-1.05, 119.95];

/**
 * ============================================================================
 * DIPERKECIL -> DIKELOMPOKKAN PER KECAMATAN
 * ============================================================================
 *
 * Pada pandangan yang memuat seluruh Sulawesi Tengah, 521 lingkaran desa
 * bertumpuk menjadi gumpalan - dan gumpalan tidak menyampaikan apa pun kecuali
 * "banyak di sini".
 *
 * Yang lazim dipakai peta adalah mengelompokkan menurut PETAK LAYAR: lingkaran
 * yang berdekatan dalam satuan piksel digabung. Cara itu ditolak di sini sebab
 * kelompoknya tidak berarti apa-apa - "delapan titik yang kebetulan berdekatan
 * pada zum sembilan" bukan satuan yang dikenal siapa pun di pengadilan.
 *
 * Yang dipakai KECAMATAN: satuan wilayah sungguhan, sudah ada pada tiap baris,
 * dan langsung dapat dibaca petugas - "Sigi Biromaru 1.204 perkara". Titiknya
 * pusat rata-rata desa anggotanya, bukan titik kecamatan yang dikarang.
 */
const ZUM_DESA = 10;

/**
 * Warna lapisan panggilan tidak bertemu - satu rona, muda ke tua.
 *
 * Sengaja BUKAN merah-kuning-hijau: yang digambar besaran tunggal (persentase),
 * dan rona yang berganti-ganti menyiratkan kelompok yang berbeda jenis. Satu
 * rona menua berarti satu hal yang bertambah.
 */
const TANGGA_RELAAS = [
  { batas: 60, warna: "#7f1d1d" },
  { batas: 40, warna: "#b91c1c" },
  { batas: 25, warna: "#ea580c" },
  { batas: 10, warna: "#f59e0b" },
  { batas: 0, warna: "#fcd34d" },
];

const WARNA_TAK_CUKUP = "#94a3b8";

/**
 * ============================================================================
 * KANTOR PENGADILAN - SATU TITIK, DAN KENAPA IA DAPAT DIGANTI
 * ============================================================================
 *
 * Cincin jarak dan usulan sidang keliling keduanya bersandar pada satu titik
 * ini. Bawaannya kantor PA Donggala di Gunung Bale, Banawa - diambil dari
 * berkas koordinat yang sama dengan desa-desanya, bukan dikarang.
 *
 * Dapat diganti lewat NEXT_PUBLIC_PETA_KANTOR ("lintang,bujur") supaya satker
 * lain dapat memakai layar yang sama tanpa menyentuh kode.
 */
const KANTOR: [number, number] = (() => {
  const setelan = String(process.env.NEXT_PUBLIC_PETA_KANTOR || "").split(",");
  const lat = Number(setelan[0]);
  const lon = Number(setelan[1]);
  return Number.isFinite(lat) && Number.isFinite(lon) ? [lat, lon] : [-0.6748, 119.7471];
})();

/** Cincin jarak, dalam kilometer. Terukur: 11% perkara di dalam 10 km, 60% di dalam 50 km. */
const CINCIN_KM = [10, 25, 50, 100];

/**
 * Lapisan yang dapat dipilih.
 *
 * `apa` kosong berarti lapisan itu tidak membaca apa pun - jumlah perkara sudah
 * ada pada muatan peta. Yang lain dibaca HANYA ketika dipilih; lapisan biaya
 * sendiri menyisir seluruh transaksi pada rentangnya (terukur 938 ms).
 */
const LAPISAN: Array<{ kunci: string; apa: string; label: string; naikBaik: boolean }> = [
  { kunci: "perkara", apa: "", label: "Jumlah perkara", naikBaik: false },
  { kunci: "relaas", apa: "relaas", label: "Panggilan tidak bertemu", naikBaik: false },
  { kunci: "kehadiran", apa: "kehadiran", label: "Pihak tidak hadir", naikBaik: false },
  { kunci: "biaya", apa: "biaya", label: "Biaya panggilan", naikBaik: false },
  { kunci: "berulang", apa: "berulang", label: "Pihak berulang", naikBaik: false },
  { kunci: "perubahan", apa: "perubahan", label: "Perubahan antar tahun", naikBaik: false },
  { kunci: "faktor", apa: "faktor", label: "Faktor perceraian", naikBaik: false },
  { kunci: "jurusita", apa: "jurusita", label: "Jurusita yang melayani", naikBaik: false },
];

/**
 * Warna untuk lapisan berkategori - faktor perceraian, nama jurusita.
 *
 * Palet kategori, bukan tangga: yang dibedakan JENIS, dan tangga satu rona
 * menyiratkan urutan yang tidak ada. Delapan slot, dan yang melewatinya jatuh
 * ke kelabu alih-alih diputar - warna yang berputar membuat kategori kesembilan
 * berwarna sama dengan yang pertama.
 */
const WARNA_KATEGORI = [
  "#ef4444",
  "#3b82f6",
  "#f59e0b",
  "#10b981",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#f97316",
];

/** Jarak bumi antara dua titik, kilometer. */
function jarakKm(a: [number, number], b: [number, number]) {
  const R = 6371;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLon = ((b[1] - a[1]) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a[0] * Math.PI) / 180) * Math.cos((b[0] * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

const angka = (n: number) => n.toLocaleString("id-ID");

/** Nama yang aman disisipkan ke dalam tooltip HTML Leaflet. */
/**
 * ============================================================================
 * TANGGA WARNA SATU LAPISAN - SATU ATURAN, DIPAKAI DUA KALI
 * ============================================================================
 *
 * Sejak peta punya TIRAI pembanding, tangga warna harus disusun dua kali: satu
 * untuk sisi kiri, satu untuk sisi kanan. Menyalin aturannya akan meninggalkan
 * dua salinan yang menyimpang diam-diam - dan yang menyimpang justru
 * perbandingannya, satu-satunya hal yang dicari orang yang menarik tirai itu.
 */
function petaBarisLapisan(m?: MuatanLapisan) {
  const peta = new Map<string, BarisLapisan>();
  for (const d of m?.desa ?? []) peta.set(d.kode, d);
  return peta;
}

/**
 * Nilai terbesar dan terkecil satu lapisan.
 *
 * Tangganya disusun dari data yang SEDANG TAMPIL, bukan dari batas tetap.
 * Batas tetap yang cocok untuk biaya panggilan (ratusan ribu rupiah) tidak
 * cocok untuk persentase, dan yang cocok untuk keduanya tidak cocok untuk
 * selisih yang dapat NEGATIF.
 */
function jangkauanLapisan(m?: MuatanLapisan) {
  const nilai = (m?.desa ?? []).filter((x) => x.cukup).map((x) => x.nilai);
  if (nilai.length === 0) return { min: 0, max: 0 };
  return { min: Math.min(...nilai), max: Math.max(...nilai) };
}

/** Urutan kategori menurut banyaknya - dipakai lapisan faktor dan jurusita. */
function urutanKategori(m?: MuatanLapisan) {
  const hitung = new Map<string, number>();
  for (const d of m?.desa ?? []) {
    const nama = d.label || String(d.nilai);
    hitung.set(nama, (hitung.get(nama) || 0) + 1);
  }
  return [...hitung.entries()].sort((a, b) => b[1] - a[1]).map(([nama]) => nama);
}

/** Warna satu desa pada satu lapisan - aturan yang sama untuk kiri dan kanan. */
function warnaLapisan(
  d: BarisLapisan | undefined,
  satuan: string,
  jangkau: { min: number; max: number },
  urut: string[]
) {
  if (!d || !d.cukup) return WARNA_TAK_CUKUP;

  if (satuan === "kategori") {
    const ke = urut.indexOf(d.label || String(d.nilai));
    return ke >= 0 && ke < WARNA_KATEGORI.length ? WARNA_KATEGORI[ke] : WARNA_TAK_CUKUP;
  }

  // Selisih punya NOL yang berarti - tidak berubah - jadi ia memakai dua rona
  // yang bertemu di tengah, bukan satu rona yang menua.
  if (satuan === "selisih") {
    if (d.nilai > 0) return d.nilai >= 10 ? "#b91c1c" : "#f59e0b";
    if (d.nilai < 0) return d.nilai <= -10 ? "#1d4ed8" : "#60a5fa";
    return WARNA_TAK_CUKUP;
  }

  const rentang = jangkau.max - jangkau.min;
  const bagian = rentang > 0 ? (d.nilai - jangkau.min) / rentang : 0;
  const ke = Math.min(TANGGA_RELAAS.length - 1, Math.floor((1 - bagian) * TANGGA_RELAAS.length));
  return TANGGA_RELAAS[ke].warna;
}

/**
 * ============================================================================
 * KUNCI KELOMPOK KECAMATAN - SATU TEMPAT, DIPAKAI TIGA KALI
 * ============================================================================
 *
 * Di bawah ZUM_DESA lingkaran tidak lagi mewakili satu desa melainkan satu
 * kecamatan, dan kuncinya bukan kode desa lagi. Tiga tempat harus menyusun
 * kunci yang PERSIS sama - lingkarannya, nilai lapisannya, dan angka relaasnya.
 * Tiga salinan penyusun kunci akan menyimpang diam-diam, dan yang menyimpang
 * tidak menimbulkan galat: petanya hanya kehilangan seluruh warnanya.
 */
function kunciKecamatan(t: TitikPerkara) {
  return `${t.kabupaten}|${t.kecamatan}`;
}

/**
 * ============================================================================
 * NILAI LAPISAN UNTUK SATU KECAMATAN
 * ============================================================================
 *
 * Tanpa ini, seluruh lapisan selain "perkara" KELABU SELURUHNYA pada tampilan
 * awal. Sebabnya sunyi: `petaLapis` berkunci kode desa, sedangkan lingkaran di
 * bawah ZUM_DESA berkunci "kabupaten|kecamatan", jadi tiap pencarian meleset
 * dan `warnaLapisan` memulangkan warna "tidak cukup" untuk semuanya. Peta yang
 * seluruhnya kelabu terbaca sebagai peta yang kosong - dan zum awalnya 9,
 * sehingga itulah yang dilihat orang lebih dahulu.
 *
 * Yang digabung HANYA desa yang datanya sudah dinyatakan cukup di hulu. Desa
 * yang kelabu karena relaasnya cuma tiga tidak boleh ikut menarik angka
 * kecamatan; membiarkannya ikut berarti kebetulan tiga desa kecil menjadi
 * temuan sekecamatan.
 *
 * Ditimbang JUMLAH PERKARA, bukan dirata-rata polos: kecamatan dengan satu
 * desa berperkara dua ratus dan enam desa berperkara satu bukan tujuh tempat
 * yang setara, dan rata-rata polos akan membuat enam desa kecil menenggelamkan
 * satu-satunya desa yang sungguh menanggung bebannya.
 */
function gabungLapisan(
  anggota: Array<{ baris: BarisLapisan | undefined; bobot: number }>,
  kode: string,
  satuan: string
): BarisLapisan | undefined {
  const cukup = anggota.filter((x) => x.baris?.cukup);
  if (cukup.length === 0) return undefined;

  // Kategori tidak dapat dirata-rata - "Cerai Gugat" ditambah "Cerai Talak"
  // dibagi dua bukan apa-apa. Yang dipulangkan kategori yang menanggung
  // perkara terbanyak.
  if (satuan === "kategori") {
    const hitung = new Map<string, number>();
    for (const x of cukup) {
      const label = String(x.baris?.label ?? x.baris?.nilai ?? "");
      hitung.set(label, (hitung.get(label) ?? 0) + Math.max(1, x.bobot));
    }
    let juara = "";
    let tertinggi = -1;
    for (const [label, n] of hitung) {
      if (n > tertinggi) {
        tertinggi = n;
        juara = label;
      }
    }
    return {
      kode,
      nilai: 0,
      label: juara,
      keterangan: `${juara} — terbanyak dari ${cukup.length} desa kecamatan ini`,
      cukup: true,
    };
  }

  let jumlah = 0;
  let jumlahBobot = 0;
  for (const x of cukup) {
    const bobot = Math.max(1, x.bobot);
    jumlah += (x.baris?.nilai ?? 0) * bobot;
    jumlahBobot += bobot;
  }
  // Dibulatkan satu desimal. Rata-rata berbobot memulangkan pecahan sepanjang
  // ketelitian mesin, dan "12,333333333333334%" pada keterangan melayang
  // bukan ketelitian melainkan kebisingan - lebarnya pun mendorong kotak
  // keterangan keluar dari peta.
  const nilai = jumlah / jumlahBobot;
  return {
    kode,
    nilai: Math.round(nilai * 10) / 10,
    keterangan: `rata-rata ${cukup.length} desa, ditimbang jumlah perkara`,
    cukup: true,
  };
}

function aman(teks: string) {
  return String(teks || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type DesaRelaas = {
  kode: string;
  nama: string;
  kecamatan: string;
  relaas: number;
  takTemu: number;
  persen: number;
  cukup: boolean;
};

type BarisLapisan = {
  kode: string;
  nilai: number;
  label?: string;
  keterangan: string;
  cukup: boolean;
};

type MuatanLapisan = {
  ok?: boolean;
  alasan?: string;
  judul?: string;
  satuan?: string;
  keterangan?: string;
  desa?: BarisLapisan[];
};

type TempatKeliling = { tempat: string; sidang: number; perkara: number; terakhir: string };

type MuatanRelaas = {
  ok?: boolean;
  alasan?: string;
  ambang?: number;
  relaas?: number;
  takTemu?: number;
  persen?: number;
  desa?: DesaRelaas[];
};

type PerkaraDesa = {
  nomorPerkara: string;
  jenisPerkara: string;
  tanggalDaftar: string;
  tanggalPutusan: string;
  kelamin: string;
  inisial: string;
};

/** Membuka bungkus { ok, data } - membacanya langsung selalu keliru. */
async function bukaBungkus<T>(balasan: Response): Promise<T> {
  return ((await balasan.json()) as { data?: T })?.data ?? ({} as T);
}

export function PetaTitikPerkara({
  titik,
  tanpaKode,
  warnaJenis,
  penandaJenis,
  saringan,
}: {
  titik: TitikPerkara[];
  tanpaKode: number;
  /** Warna nyata per jenis perkara - merah cerai gugat, biru cerai talak. */
  warnaJenis: Record<string, string>;
  /** Nama penanda ("merah"/"biru") per jenis, untuk keterangan di bawah peta. */
  penandaJenis: Record<string, string>;
  /** Saringan halaman - diteruskan apa adanya ke lapisan yang dibaca terpisah. */
  saringan: { kelompok: string; periode: string; acuan: string; dari: string; sampai: string };
}) {
  const wadah = useRef<HTMLDivElement | null>(null);
  const petaRef = useRef<PetaObjek | null>(null);
  const kumpulanRef = useRef<PetaKumpulan | null>(null);
  /** Lingkaran sisi kanan tirai, beserta penggambar tiap panel. */
  const kumpulanBRef = useRef<PetaKumpulan | null>(null);
  const gambarKiriRef = useRef<unknown>(null);
  const gambarKananRef = useRef<unknown>(null);
  /** Pandangan awal hanya disesuaikan sekali - lihat penggambar di bawah. */
  const sudahDipaskan = useRef(false);
  const [galat, setGalat] = useState("");
  const [siap, setSiap] = useState(false);
  const [koordinat, setKoordinat] = useState<Record<string, [number, number]> | null>(null);
  const [berkas, setBerkas] = useState<BerkasTitik | null>(null);
  const [gelap, setGelap] = useState(false);

  /** Lapisan yang sedang digambar - lihat daftar LAPISAN. */
  const [lapisan, setLapisan] = useState("perkara");

  /**
   * ====================================================================
   * TIRAI PEMBANDING
   * ====================================================================
   *
   * Kosong berarti mati - dan mati adalah keadaan bawaannya. Dua lapisan yang
   * tampil bersamaan menuntut pembacanya menahan dua arti warna sekaligus, dan
   * itu beban yang hanya sepadan ketika ia memang sedang membandingkan.
   */
  const [lapisanB, setLapisanB] = useState("");
  /** Letak tirai dalam persen lebar peta. */
  const [tirai, setTirai] = useState(50);
  const [relaas, setRelaas] = useState<MuatanRelaas | null>(null);
  const [galatRelaas, setGalatRelaas] = useState("");
  const [memuatRelaas, setMemuatRelaas] = useState(false);

  /**
   * Lapisan lain, disimpan per kunci.
   *
   * Disimpan supaya berpindah kembali ke lapisan yang sudah dibaca tidak
   * membaca SIPP lagi - dan pada rentang delapan tahun, lapisan biaya sendiri
   * hampir satu detik.
   */
  const [lapis, setLapis] = useState<Record<string, MuatanLapisan>>({});
  const [galatLapis, setGalatLapis] = useState("");
  const [memuatLapis, setMemuatLapis] = useState(false);

  /** Sidang keliling yang SUDAH ada - penanda, bukan lapisan. */
  const [keliling, setKeliling] = useState<TempatKeliling[]>([]);

  /** Cincin jarak dari kantor, dan usulan sidang keliling. */
  const [cincin, setCincin] = useState(false);
  const [usul, setUsul] = useState(false);

  /** Desa yang lingkarannya diketuk, beserta daftar perkaranya. */
  const [desaDibuka, setDesaDibuka] = useState<TitikPerkara | null>(null);
  const [perkaraDesa, setPerkaraDesa] = useState<PerkaraDesa[] | null>(null);
  const [memuatDesa, setMemuatDesa] = useState(false);

  /** Zum berjalan - penentu desa atau kecamatan yang digambar. */
  const [zum, setZum] = useState(9);

  /**
   * ====================================================================
   * LAYAR PENUH
   * ====================================================================
   *
   * Peta setinggi 32rem cukup untuk melihat SUDAH di mana perkaranya, tetapi
   * tidak untuk membandingkan dua kabupaten yang berjauhan - dan tidak untuk
   * tirai pembanding, yang seluruh gunanya justru bersandar pada lebar layar.
   *
   * Dua jalan, dan yang kedua bukan hiasan: Fullscreen API ditolak diam-diam
   * pada peramban yang memuat halaman ini di dalam bingkai tanpa izin
   * `allowfullscreen`. Kalau permintaan itu satu-satunya jalan, tombolnya
   * tidak melakukan apa-apa dan tidak ada yang tahu sebabnya. Karena itu
   * penolakannya dijatuhkan ke layar penuh SEMU - kotak berposisi tetap yang
   * menutupi jendela - yang tampak sama bagi yang memakainya.
   */
  const kotakPeta = useRef<HTMLDivElement | null>(null);
  const [layarPenuh, setLayarPenuh] = useState(false);
  /** Benar bila penuhnya ditiru dengan CSS, bukan diberikan peramban. */
  const [penuhSemu, setPenuhSemu] = useState(false);

  // --------------------------------------------------------------------
  // Tema. Ubinan peta jalan selalu terang; di tema gelap ia menyilaukan dan
  // membuat lingkaran berwarna sukar dibaca. Dibalik lewat tapis CSS pada
  // lapisan ubinnya saja - bukan pada seluruh peta, sebab lingkarannya justru
  // harus TETAP warnanya.
  // --------------------------------------------------------------------
  //
  // TEMANYA DIBACA DARI KELAS `dark`, BUKAN DARI `data-theme` DAN BUKAN DARI
  // PERAMBAN. Portal ALETA menyalakan temanya begini - `app-state.tsx`:
  //
  //     document.documentElement.classList.toggle("dark", state.theme === "dark")
  //
  // dan skrip pembuka di `layout.tsx` menaruh kelas itu SEBELUM halaman
  // digambar. `prefers-color-scheme` tidak pernah ditanyakan sama sekali, dan
  // bawaan portal ini GELAP.
  //
  // Susunan sebelumnya membaca `data-theme` lalu jatuh ke `prefers-color-
  // scheme` - dua hal yang tidak dipakai portal ini. Akibatnya petugas yang
  // perambannya bertema terang melihat peta TERANG di atas halaman GELAP,
  // yaitu keadaan bawaan portal, dan tidak ada galat yang berbunyi: petanya
  // tergambar, hanya menyilaukan.
  useEffect(() => {
    const akar = document.documentElement;
    const baca = () => akar.classList.contains("dark");
    setGelap(baca());
    const pengamat = new MutationObserver(() => setGelap(baca()));
    pengamat.observe(akar, { attributes: true, attributeFilter: ["class"] });
    return () => pengamat.disconnect();
  }, []);

  // --------------------------------------------------------------------
  // Berkas koordinat - diambil SEKALI, lalu disinggah peramban. Ia tidak
  // berubah kecuali dijodohkan ulang, jadi tidak ada gunanya diminta tiap kali
  // saringan halaman berganti.
  // --------------------------------------------------------------------
  useEffect(() => {
    let hidup = true;
    void (async () => {
      try {
        const jawab = await fetch(withBasePath("/peta/titik-desa.json"));
        if (!jawab.ok) throw new Error(`berkas titik desa tidak terbaca (${jawab.status})`);
        const isi = (await jawab.json()) as BerkasTitik;
        if (!hidup) return;
        setBerkas(isi);
        setKoordinat(isi.titik || {});
      } catch (e) {
        if (hidup) setGalat(e instanceof Error ? e.message : "Berkas titik desa tidak terbaca.");
      }
    })();
    return () => {
      hidup = false;
    };
  }, []);

  // --------------------------------------------------------------------
  // Lapisan panggilan tidak bertemu - dibaca hanya ketika lapisannya dipilih.
  //
  // Kuerinya menyisir seluruh relaas pada rentangnya; terukur 884 milidetik
  // untuk delapan tahun. Tidak ada gunanya dibayar oleh yang hanya melihat
  // jumlah perkara.
  // --------------------------------------------------------------------
  useEffect(() => {
    if (lapisan !== "relaas") return;
    let hidup = true;
    setMemuatRelaas(true);
    setGalatRelaas("");
    void (async () => {
      try {
        const kueri = new URLSearchParams({
          periode: saringan.periode,
          acuan: saringan.acuan,
          dari: saringan.dari,
          sampai: saringan.sampai,
        });
        const jawab = await fetch(apiPath(`/api/aleta-ecourt/peta-relaas?${kueri.toString()}`), {
          cache: "no-store",
        });
        const isi = await bukaBungkus<MuatanRelaas>(jawab);
        if (!hidup) return;
        if (isi.ok === false) {
          setGalatRelaas(isi.alasan || "Lapisan panggilan tidak dapat dibaca.");
          return;
        }
        setRelaas(isi);
      } catch (e) {
        if (hidup) setGalatRelaas(e instanceof Error ? e.message : "Lapisan panggilan gagal dibaca.");
      } finally {
        if (hidup) setMemuatRelaas(false);
      }
    })();
    return () => {
      hidup = false;
    };
  }, [lapisan, saringan.periode, saringan.acuan, saringan.dari, saringan.sampai]);

  // --------------------------------------------------------------------
  // Lapisan lain - dibaca sekali per kunci, ketika lapisannya dipilih.
  // --------------------------------------------------------------------
  useEffect(() => {
    // Sisi kiri DAN sisi kanan tirai dibaca dengan aturan yang sama, satu per
    // satu: `lapis` ikut jadi kebergantungan, jadi begitu yang pertama tiba,
    // efek ini berjalan lagi dan mengambil yang kedua. Dua bacaan sekaligus
    // hanya akan membuat SIPP mengerjakan dua kueri berat berbarengan.
    const kunci = [lapisan, lapisanB].find((k) => {
      const p = LAPISAN.find((x) => x.kunci === k);
      return !!p && !!p.apa && p.apa !== "relaas" && !lapis[k];
    });
    if (!kunci) return;
    const pilih = LAPISAN.find((x) => x.kunci === kunci)!;
    let hidup = true;
    setMemuatLapis(true);
    setGalatLapis("");
    void (async () => {
      try {
        const kueri = new URLSearchParams({
          apa: pilih.apa,
          periode: saringan.periode,
          acuan: saringan.acuan,
          dari: saringan.dari,
          sampai: saringan.sampai,
        });
        const jawab = await fetch(apiPath(`/api/aleta-ecourt/peta-relaas?${kueri.toString()}`), {
          cache: "no-store",
        });
        const isi = await bukaBungkus<MuatanLapisan>(jawab);
        if (!hidup) return;
        if (isi.ok === false) {
          setGalatLapis(isi.alasan || "Lapisan tidak dapat dibaca.");
          return;
        }
        setLapis((lama) => ({ ...lama, [kunci]: isi }));
      } catch (e) {
        if (hidup) setGalatLapis(e instanceof Error ? e.message : "Lapisan gagal dibaca.");
      } finally {
        if (hidup) setMemuatLapis(false);
      }
    })();
    return () => {
      hidup = false;
    };
  }, [
    lapisan,
    lapisanB,
    lapis,
    saringan.periode,
    saringan.acuan,
    saringan.dari,
    saringan.sampai,
  ]);

  // --------------------------------------------------------------------
  // Sidang keliling yang sudah ada - dibaca sekali, ketika penandanya
  // dinyalakan. Tanpa ini, usulan sidang keliling tidak dapat dinilai siapa
  // pun: yang terlihat hanya desa jauh, bukan desa jauh YANG BELUM TERLAYANI.
  // --------------------------------------------------------------------
  useEffect(() => {
    if (!usul || keliling.length > 0) return;
    let hidup = true;
    void (async () => {
      try {
        const kueri = new URLSearchParams({
          apa: "keliling",
          periode: saringan.periode,
          acuan: saringan.acuan,
          dari: saringan.dari,
          sampai: saringan.sampai,
        });
        const jawab = await fetch(apiPath(`/api/aleta-ecourt/peta-relaas?${kueri.toString()}`), {
          cache: "no-store",
        });
        const isi = await bukaBungkus<{ tempat?: TempatKeliling[] }>(jawab);
        if (hidup && Array.isArray(isi.tempat)) setKeliling(isi.tempat);
      } catch {
        // Penanda yang gagal dibaca menyisakan usulannya tetap terbaca -
        // hanya tanpa keterangan mana yang sudah terlayani.
      }
    })();
    return () => {
      hidup = false;
    };
  }, [usul, keliling.length, saringan.periode, saringan.acuan, saringan.dari, saringan.sampai]);

  // --------------------------------------------------------------------
  // Daftar perkara satu desa - dibaca ketika lingkarannya diketuk.
  // --------------------------------------------------------------------
  useEffect(() => {
    if (!desaDibuka) {
      setPerkaraDesa(null);
      return;
    }
    let hidup = true;
    setMemuatDesa(true);
    void (async () => {
      try {
        const kueri = new URLSearchParams({
          apa: "desa",
          kode: desaDibuka.kode,
          kelompok: saringan.kelompok,
          periode: saringan.periode,
          acuan: saringan.acuan,
          dari: saringan.dari,
          sampai: saringan.sampai,
        });
        const jawab = await fetch(apiPath(`/api/aleta-ecourt/peta-relaas?${kueri.toString()}`), {
          cache: "no-store",
        });
        const isi = await bukaBungkus<{ ok?: boolean; perkara?: PerkaraDesa[] }>(jawab);
        if (!hidup) return;
        setPerkaraDesa(Array.isArray(isi.perkara) ? isi.perkara : []);
      } catch {
        if (hidup) setPerkaraDesa([]);
      } finally {
        if (hidup) setMemuatDesa(false);
      }
    })();
    return () => {
      hidup = false;
    };
  }, [desaDibuka, saringan.kelompok, saringan.periode, saringan.acuan, saringan.dari, saringan.sampai]);

  // --------------------------------------------------------------------
  // Peta dibuat SEKALI. Membuatnya ulang tiap kali datanya berganti berarti
  // peramban membongkar dan memasang ubinan dari awal - berkedip, dan menarik
  // ulang gambar yang sudah ada di tangannya.
  // --------------------------------------------------------------------
  useEffect(() => {
    let hidup = true;
    void (async () => {
      try {
        const L = await muatLeaflet();
        if (!hidup || !wadah.current || petaRef.current) return;

        const peta = L.map(wadah.current, {
          // Penggambar kanvas - lihat keterangan di kepala berkas.
          preferCanvas: true,
          scrollWheelZoom: false,
          attributionControl: true,
          zoomControl: true,
        }).setView(TENGAH, 9);

        L.tileLayer(UBIN, {
          maxZoom: 18,
          attribution: SEBUT,
          // Ubin yang gagal tidak meninggalkan kotak kosong berkedip.
          errorTileUrl:
            "data:image/svg+xml;charset=utf-8," +
            encodeURIComponent(
              '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"></svg>'
            ),
        }).addTo(peta);

        // Dua panel terpisah supaya TIRAI dapat menggunting satu sisi saja.
        // Ubinan dan cincin jarak tinggal di panel bawaan dan karena itu tidak
        // ikut tergunting - yang tergunting hanya lingkaran desanya.
        peta.createPane("aletaKiri");
        peta.createPane("aletaKanan");
        const panelKiri = peta.getPane("aletaKiri");
        const panelKanan = peta.getPane("aletaKanan");
        if (panelKiri) panelKiri.style.zIndex = "620";
        if (panelKanan) {
          panelKanan.style.zIndex = "630";
          // Lapisan pembanding DIBACA, bukan diketuk. Kanvasnya menutupi
          // seluruh peta - bukan hanya separuh kanan - sehingga membiarkannya
          // menerima ketukan akan merampas ketukan milik sisi kiri, termasuk
          // di bagian layar tempat ia tidak terlihat sama sekali.
          panelKanan.style.pointerEvents = "none";
        }
        gambarKiriRef.current = L.canvas({ pane: "aletaKiri" });
        gambarKananRef.current = L.canvas({ pane: "aletaKanan" });

        kumpulanRef.current = L.layerGroup().addTo(peta);
        kumpulanBRef.current = L.layerGroup().addTo(peta);
        // Zum diikuti supaya penggambarnya tahu kapan berpindah dari desa ke
        // kecamatan. Dibaca dari petanya sendiri, bukan dihitung sendiri:
        // fitBounds mengubah zum tanpa ada yang menekan tombol.
        peta.on("zoomend", () => setZum(peta.getZoom()));
        petaRef.current = peta;
        // Peta yang lahir di dalam kotak yang baru saja terbuka kerap salah
        // menghitung ukurannya sendiri; ubinannya lalu hanya mengisi seperempat.
        setTimeout(() => peta.invalidateSize(), 120);
        setSiap(true);
      } catch (e) {
        if (hidup) setGalat(e instanceof Error ? e.message : "Peta tidak dapat dimuat.");
      }
    })();

    return () => {
      hidup = false;
      if (petaRef.current) {
        petaRef.current.remove();
        petaRef.current = null;
        kumpulanRef.current = null;
        kumpulanBRef.current = null;
        gambarKiriRef.current = null;
        gambarKananRef.current = null;
      }
    };
  }, []);

  // --------------------------------------------------------------------
  // Titik yang sungguh dapat digambar
  // --------------------------------------------------------------------
  const tergambar = useMemo(() => {
    if (!koordinat) return [];
    const hasil: { t: TitikPerkara; pos: [number, number] }[] = [];
    for (const t of titik) {
      const pos = koordinat[t.kode];
      if (pos) hasil.push({ t, pos });
    }
    return hasil;
  }, [titik, koordinat]);

  const takBerkoordinat = useMemo(() => {
    if (!koordinat) return { desa: 0, perkara: 0 };
    let desa = 0;
    let perkara = 0;
    for (const t of titik) {
      if (!koordinat[t.kode]) {
        desa += 1;
        perkara += t.perkara;
      }
    }
    return { desa, perkara };
  }, [titik, koordinat]);

  /** Nilai relaas per kode desa - pencarian kunci, bukan penyisiran daftar. */
  const petaRelaas = useMemo(() => {
    const peta = new Map<string, DesaRelaas>();
    for (const d of relaas?.desa ?? []) peta.set(d.kode, d);
    return peta;
  }, [relaas]);

  /** Nilai lapisan yang sedang tampil, per kode desa. */
  const petaLapis = useMemo(() => petaBarisLapisan(lapis[lapisan]), [lapis, lapisan]);
  const satuan = lapis[lapisan]?.satuan ?? "";
  const jangkauLapis = useMemo(() => jangkauanLapisan(lapis[lapisan]), [lapis, lapisan]);
  const urutKategori = useMemo(() => urutanKategori(lapis[lapisan]), [lapis, lapisan]);

  /**
   * ==================================================================
   * NILAI YANG DIPAKAI LINGKARAN - MENGIKUTI TINGKAT YANG SEDANG TAMPIL
   * ==================================================================
   *
   * Pada tingkat desa keduanya sama persis dengan peta aslinya. Di bawah
   * ZUM_DESA barulah nilainya digabung per kecamatan, sebab di situ kunci
   * lingkarannya berganti dan pencarian per kode desa pasti meleset.
   */
  const petaLapisTampil = useMemo(() => {
    if (zum >= ZUM_DESA) return petaLapis;
    const kumpul = new Map<string, Array<{ baris: BarisLapisan | undefined; bobot: number }>>();
    for (const x of tergambar) {
      const kunci = kunciKecamatan(x.t);
      const daftar = kumpul.get(kunci) ?? [];
      daftar.push({ baris: petaLapis.get(x.t.kode), bobot: x.t.perkara });
      kumpul.set(kunci, daftar);
    }
    const hasil = new Map<string, BarisLapisan>();
    for (const [kunci, anggota] of kumpul) {
      const gabung = gabungLapisan(anggota, kunci, satuan);
      if (gabung) hasil.set(kunci, gabung);
    }
    return hasil;
  }, [zum, tergambar, petaLapis, satuan]);

  /**
   * Relaas digabung dengan menjumlahkan PEMBILANG dan PENYEBUTNYA, bukan
   * dengan merata-rata persentase desa. Sepuluh dari dua puluh ditambah satu
   * dari sepuluh adalah sebelas dari tiga puluh - 37%, bukan rata-rata 50%
   * dan 10% yang menghasilkan 30%. Yang kedua itu angka yang tidak pernah ada.
   */
  const petaRelaasTampil = useMemo(() => {
    if (zum >= ZUM_DESA) return petaRelaas;
    const kumpul = new Map<string, { relaas: number; takTemu: number; desa: number }>();
    for (const x of tergambar) {
      const d = petaRelaas.get(x.t.kode);
      // Desa yang relaasnya terlalu sedikit sudah dinyatakan tidak cukup di
      // hulu - ia tidak ikut menarik angka kecamatan.
      if (!d || !d.cukup) continue;
      const kunci = kunciKecamatan(x.t);
      const k = kumpul.get(kunci) ?? { relaas: 0, takTemu: 0, desa: 0 };
      k.relaas += d.relaas;
      k.takTemu += d.takTemu;
      k.desa += 1;
      kumpul.set(kunci, k);
    }
    const hasil = new Map<string, DesaRelaas>();
    for (const [kunci, k] of kumpul) {
      const kecamatan = kunci.split("|")[1] || kunci;
      hasil.set(kunci, {
        kode: kunci,
        nama: kecamatan,
        kecamatan,
        relaas: k.relaas,
        takTemu: k.takTemu,
        // Dibulatkan seperti angka desa dari hulu - keterangan melayang
        // menampilkannya apa adanya.
        persen: k.relaas > 0 ? Math.round((k.takTemu / k.relaas) * 100) : 0,
        cukup: k.desa > 0,
      });
    }
    return hasil;
  }, [zum, tergambar, petaRelaas]);

  /** Sisi kanan tirai - bentuknya persis sama, sumbernya lapisan yang lain. */
  const petaLapisB = useMemo(() => petaBarisLapisan(lapis[lapisanB]), [lapis, lapisanB]);
  const satuanB = lapis[lapisanB]?.satuan ?? "";
  const jangkauLapisB = useMemo(() => jangkauanLapisan(lapis[lapisanB]), [lapis, lapisanB]);
  const urutKategoriB = useMemo(() => urutanKategori(lapis[lapisanB]), [lapis, lapisanB]);

  /** Sisi kanan digabung dengan aturan yang sama - bukan salinan yang kedua. */
  const petaLapisBTampil = useMemo(() => {
    if (zum >= ZUM_DESA) return petaLapisB;
    const kumpul = new Map<string, Array<{ baris: BarisLapisan | undefined; bobot: number }>>();
    for (const x of tergambar) {
      const kunci = kunciKecamatan(x.t);
      const daftar = kumpul.get(kunci) ?? [];
      daftar.push({ baris: petaLapisB.get(x.t.kode), bobot: x.t.perkara });
      kumpul.set(kunci, daftar);
    }
    const hasil = new Map<string, BarisLapisan>();
    for (const [kunci, anggota] of kumpul) {
      const gabung = gabungLapisan(anggota, kunci, satuanB);
      if (gabung) hasil.set(kunci, gabung);
    }
    return hasil;
  }, [zum, tergambar, petaLapisB, satuanB]);

  /**
   * Yang sungguh digambar: desa pada zum dekat, kecamatan pada zum jauh.
   *
   * Kecamatan disusun dari desa-desa yang SUDAH berkoordinat - bukan dari
   * daftar kecamatan tersendiri. Titiknya pusat rata-rata anggotanya, jadi ia
   * selalu jatuh di tengah desa-desa yang sungguh berperkara, bukan di titik
   * kecamatan yang dikarang.
   */
  const digambar = useMemo(() => {
    if (zum >= ZUM_DESA) {
      return tergambar.map((x) => ({
        kunci: x.t.kode,
        nama: x.t.nama,
        bawah: x.t.kecamatan || x.t.kabupaten,
        pos: x.pos,
        perkara: x.t.perkara,
        lelaki: x.t.lelaki,
        perempuan: x.t.perempuan,
        jenis: x.t.jenis,
        titik: x.t,
        anggota: 1,
      }));
    }

    const peta = new Map<
      string,
      {
        kunci: string;
        nama: string;
        bawah: string;
        lat: number;
        lon: number;
        perkara: number;
        lelaki: number;
        perempuan: number;
        jenis: Record<string, number>;
        anggota: number;
      }
    >();
    for (const x of tergambar) {
      const kunci = kunciKecamatan(x.t);
      if (!peta.has(kunci)) {
        peta.set(kunci, {
          kunci,
          nama: x.t.kecamatan || x.t.nama,
          bawah: x.t.kabupaten,
          lat: 0,
          lon: 0,
          perkara: 0,
          lelaki: 0,
          perempuan: 0,
          jenis: {},
          anggota: 0,
        });
      }
      const k = peta.get(kunci)!;
      k.lat += x.pos[0];
      k.lon += x.pos[1];
      k.perkara += x.t.perkara;
      k.lelaki += x.t.lelaki;
      k.perempuan += x.t.perempuan;
      k.anggota += 1;
      for (const [j, n] of Object.entries(x.t.jenis)) k.jenis[j] = (k.jenis[j] || 0) + n;
    }
    return [...peta.values()].map((k) => ({
      kunci: k.kunci,
      nama: k.nama,
      bawah: k.bawah,
      pos: [k.lat / k.anggota, k.lon / k.anggota] as [number, number],
      perkara: k.perkara,
      lelaki: k.lelaki,
      perempuan: k.perempuan,
      jenis: k.jenis,
      titik: null as TitikPerkara | null,
      anggota: k.anggota,
    }));
  }, [tergambar, zum]);

  const terbesar = useMemo(
    () => digambar.reduce((n, x) => Math.max(n, x.perkara), 0),
    [digambar]
  );

  /** Jari-jari menurut AKAR jumlahnya - lihat keterangan di kepala berkas. */
  const jariJari = useCallback(
    (jml: number) => {
      if (terbesar <= 0) return 4;
      const bagian = Math.sqrt(jml) / Math.sqrt(terbesar);
      return 3 + bagian * 15;
    },
    [terbesar]
  );

  /**
   * ====================================================================
   * WARNA LINGKARAN - SATU PABRIK, DUA PEMAKAI
   * ====================================================================
   *
   *   perkara  jenis perkara yang paling banyak di tempat itu
   *   relaas   persentase panggilan tidak bertemu, satu rona menua
   *   lainnya  tangga yang disusun dari jangkauan lapisan itu sendiri
   *
   * Pada lapisan relaas, tempat yang relaasnya TERLALU SEDIKIT diberi warna
   * kelabu - bukan warna termuda. Desa dengan tiga relaas yang dua di antaranya
   * gagal bukan "67% gagal", itu kebetulan; mewarnainya seperti desa lain
   * membuat kebetulan terbaca sebagai temuan.
   *
   * --------------------------------------------------------------------
   * KENAPA BERUPA PABRIK, DAN BUKAN SATU useCallback SEPERTI SEBELUMNYA
   * --------------------------------------------------------------------
   *
   * Sisi kiri dan sisi kanan tirai memerlukan aturan yang SAMA atas data yang
   * BERBEDA. Bentuk lama - satu useCallback yang memeluk petaLapis, satuan,
   * jangkauLapis, dan urutKategori langsung dari ruang lingkupnya - tidak dapat
   * dipakai dua kali, dan keempatnya juga tidak ada di daftar
   * kebergantungannya.
   *
   * Yang terakhir itu cacat sungguhan, bukan kerapian: begitu data lapisan
   * tiba, penggambar berjalan lagi (petaLapis ada di kebergantungan EFEK-nya)
   * tetapi memanggil warnaTitik yang masih memeluk peta KOSONG - sehingga
   * seluruh desa kelabu "tidak cukup" pada pemilihan pertama tiap lapisan.
   * Berpindah lapisan lalu kembali membuatnya benar, dan itulah yang membuat
   * cacat ini menyamar sebagai data yang belum lengkap.
   *
   * Sebagai pabrik, tiap datanya masuk lewat parameter dan tidak ada lagi yang
   * dapat tertinggal di daftar kebergantungan.
   */
  const buatWarna = useCallback(
    (
      kunci: string,
      pl: Map<string, BarisLapisan>,
      sat: string,
      jang: { min: number; max: number },
      urut: string[]
    ) =>
      (jenis: Record<string, number>, kode: string) => {
        if (kunci !== "perkara" && kunci !== "relaas") {
          return warnaLapisan(pl.get(kode), sat, jang, urut);
        }

        if (kunci === "relaas") {
          const d = petaRelaasTampil.get(kode);
          if (!d || !d.cukup) return WARNA_TAK_CUKUP;
          for (const langkah of TANGGA_RELAAS) {
            if (d.persen >= langkah.batas) return langkah.warna;
          }
          return TANGGA_RELAAS[TANGGA_RELAAS.length - 1].warna;
        }

        let terbanyak = "";
        let jml = -1;
        for (const [j, n] of Object.entries(jenis)) {
          if (n > jml) {
            jml = n;
            terbanyak = j;
          }
        }
        return warnaJenis[terbanyak] || "#6366f1";
      },
    [warnaJenis, petaRelaasTampil]
  );

  const warnaTitik = useMemo(
    () => buatWarna(lapisan, petaLapisTampil, satuan, jangkauLapis, urutKategori),
    [buatWarna, lapisan, petaLapisTampil, satuan, jangkauLapis, urutKategori]
  );

  const warnaTitikB = useMemo(
    () => buatWarna(lapisanB, petaLapisBTampil, satuanB, jangkauLapisB, urutKategoriB),
    [buatWarna, lapisanB, petaLapisBTampil, satuanB, jangkauLapisB, urutKategoriB]
  );

  // --------------------------------------------------------------------
  // Menggambar ulang lingkarannya saja - ubinannya tidak disentuh.
  // --------------------------------------------------------------------
  useEffect(() => {
    if (!siap || !petaRef.current || !kumpulanRef.current) return;
    const peta = petaRef.current;
    const kumpulan = kumpulanRef.current;
    kumpulan.clearLayers();
    if (digambar.length === 0) return;

    void (async () => {
      const L = await muatLeaflet();
      // Yang terbesar digambar LEBIH DAHULU supaya yang kecil berada di
      // atasnya - kalau terbalik, desa kecil di tengah kota tertimbun dan
      // tidak pernah dapat diketuk.
      const urut = [...digambar].sort((a, b) => b.perkara - a.perkara);
      for (const x of urut) {
        const warna = warnaTitik(x.jenis, x.kunci);
        const lingkar: PetaTitik = L.circleMarker(x.pos, {
          // Panel tersendiri supaya tirai dapat menggunting sisi ini saja.
          renderer: gambarKiriRef.current ?? undefined,
          radius: jariJari(x.perkara),
          color: warna,
          weight: 1.2,
          opacity: 0.85,
          fillColor: warna,
          fillOpacity: lapisan === "relaas" ? 0.55 : 0.32,
        });

        // Penegasan saat penunjuk lewat. Murah: hanya gaya satu bentuk yang
        // berubah, bukan seluruh lapisan yang digambar ulang.
        const isiTenang = lapisan === "relaas" ? 0.55 : 0.32;
        lingkar.on("mouseover", () => lingkar.setStyle({ weight: 2.5, fillOpacity: isiTenang + 0.3 }));
        lingkar.on("mouseout", () => lingkar.setStyle({ weight: 1.2, fillOpacity: isiTenang }));

        // Diketuk -> daftar perkara desa itu. Hanya pada tingkat DESA: pada
        // tingkat kecamatan yang diketuk bukan satu wilayah bernomor, dan
        // daftar perkara sekecamatan bukan lagi jawaban melainkan daftar baru.
        if (x.titik) {
          const milik = x.titik;
          lingkar.on("click", () => setDesaDibuka(milik));
        }

        const rincianJenis = Object.entries(x.jenis)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 4)
          .map(([j, n]) => `${aman(j)} ${angka(n)}`)
          .join(" · ");

        // Dicari lewat kunci lingkarannya, bukan lewat kode desa: pada tingkat
        // kecamatan tidak ada kode desa, dan keterangan yang hilang di situ
        // membuat warna yang baru saja diperbaiki menjadi warna tanpa angka.
        const dl = petaLapisTampil.get(x.kunci);
        const barisLapis =
          dl && lapisan !== "perkara" && lapisan !== "relaas"
            ? dl.cukup
              ? `<b>${aman(dl.label || String(dl.nilai))}${
                  satuan === "persen" ? "%" : satuan === "rupiah" ? "" : ""
                }</b><span>${aman(dl.keterangan)}</span>`
              : `<span>${aman(dl.keterangan)} — terlalu sedikit untuk dibandingkan</span>`
            : "";

        const d = petaRelaasTampil.get(x.kunci);
        const barisRelaas =
          lapisan === "relaas"
            ? d
              ? d.cukup
                ? `<b>${d.persen}% panggilan tidak bertemu</b><span>${angka(d.takTemu)} dari ${angka(
                    d.relaas
                  )} relaas</span>`
                : `<span>hanya ${angka(d.relaas)} relaas — terlalu sedikit untuk dipersenkan</span>`
              : `<span>tidak ada relaas bersandi bertemu/tidak</span>`
            : "";

        lingkar.bindTooltip(
          `<div class="aleta-peta-tip">
             <strong>${aman(x.nama)}</strong>
             <span>${aman(x.bawah)}${x.anggota > 1 ? ` · ${angka(x.anggota)} desa` : ""}</span>
             ${barisRelaas}
             ${barisLapis}
             <b>${angka(x.perkara)} perkara</b>
             <span>${angka(x.lelaki)} laki-laki · ${angka(x.perempuan)} perempuan</span>
             ${rincianJenis ? `<span>${rincianJenis}</span>` : ""}
             ${x.titik ? `<span>ketuk untuk daftar perkaranya</span>` : ""}
           </div>`,
          { direction: "top", opacity: 1, className: "aleta-peta-tooltip" }
        );
        kumpulan.addLayer(lingkar);
      }

      // ------------------------------------------------------------------
      // CINCIN JARAK DAN PENANDA KANTOR
      // ------------------------------------------------------------------
      //
      // Terukur: hanya 11% perkara datang dari radius 10 km, 60% dari 50 km,
      // dan 92% dari 100 km. Tanpa cincin, angka itu tidak terlihat sama
      // sekali - peta hanya memperlihatkan titik yang tersebar.
      if (cincin) {
        for (const km of CINCIN_KM) {
          kumpulan.addLayer(
            L.circle(KANTOR, {
              radius: km * 1000,
              color: "#64748b",
              weight: 1,
              opacity: 0.55,
              fill: false,
              dashArray: "4 4",
            })
          );
        }
        kumpulan.addLayer(
          L.circleMarker(KANTOR, {
            radius: 6,
            color: "#0f172a",
            weight: 2,
            fillColor: "#facc15",
            fillOpacity: 1,
          }).bindTooltip(
            `<div class="aleta-peta-tip"><strong>Kantor pengadilan</strong><span>cincin ${CINCIN_KM.join(
              ", "
            )} km</span></div>`,
            { direction: "top", opacity: 1, className: "aleta-peta-tooltip" }
          )
        );
      }

      // ------------------------------------------------------------------
      // PANDANGAN AWAL MENGIKUTI YANG BANYAK, BUKAN YANG TERJAUH
      // ------------------------------------------------------------------
      //
      // Dicoba lebih dahulu dengan memuat SELURUH titik: petanya membuka
      // sepanjang Vietnam sampai Timor Leste, dan sembilan ribu perkara
      // Donggala-Sigi-Palu menjadi satu gumpalan merah selebar satu sentimeter.
      // Sebabnya segelintir pihak yang beralamat di Surabaya, Makassar, dan
      // Nunukan - benar datanya, dan menarik seluruh pandangan ikut ke sana.
      //
      // Karena itu yang menentukan pandangan awal hanyalah desa-desa terdekat
      // yang bersama-sama memuat 95% perkara. Sisanya TETAP DIGAMBAR - ia
      // hanya tidak ikut menentukan ke mana peta membuka, dan tinggal
      // diperkecil sekali untuk melihatnya.
      const jumlahSemua = urut.reduce((n, x) => n + x.perkara, 0);
      let inti = urut;
      if (jumlahSemua > 0) {
        const plat = urut.reduce((n, x) => n + x.pos[0] * x.perkara, 0) / jumlahSemua;
        const plon = urut.reduce((n, x) => n + x.pos[1] * x.perkara, 0) / jumlahSemua;
        const berjarak = [...urut].sort(
          (a, b) =>
            (a.pos[0] - plat) ** 2 + (a.pos[1] - plon) ** 2 -
            ((b.pos[0] - plat) ** 2 + (b.pos[1] - plon) ** 2)
        );
        const batasJumlah = jumlahSemua * AMBANG_INTI;
        const terpilih: typeof urut = [];
        let kumpul = 0;
        for (const x of berjarak) {
          terpilih.push(x);
          kumpul += x.perkara;
          if (kumpul >= batasJumlah) break;
        }
        if (terpilih.length > 0) inti = terpilih;
      }
      // Pandangan disesuaikan SEKALI - pada gambar pertama. Menyesuaikannya
      // tiap kali lingkarannya digambar ulang berarti peta melompat kembali ke
      // tempat asalnya setiap kali orang berpindah lapisan atau memperbesar,
      // dan itu membuatnya tidak dapat dipakai sama sekali.
      if (!sudahDipaskan.current) {
        const batas = L.latLngBounds(inti.map((x) => x.pos));
        if (batas.isValid()) {
          peta.fitBounds(batas, { padding: [28, 28], maxZoom: 12 });
          sudahDipaskan.current = true;
        }
      }
    })();
  }, [
    siap,
    digambar,
    jariJari,
    warnaTitik,
    lapisan,
    petaRelaasTampil,
    petaLapisTampil,
    satuan,
    cincin,
  ]);

  // --------------------------------------------------------------------
  // GUNTINGAN TIRAI - pada KANVAS, dalam piksel, bukan pada panel
  // --------------------------------------------------------------------
  //
  // Panel Leaflet TIDAK BERUKURAN: anak-anaknya berposisi mutlak, jadi kotak
  // panelnya sendiri 0x0. clip-path berpersen pada kotak 0x0 menghasilkan
  // persegi 0x0 - yaitu menggunting seluruhnya, tanpa galat dan tanpa
  // peringatan. Yang tampak hanya peta yang seluruh lingkarannya hilang, dan
  // itu persis yang terjadi pada rancangan pertama.
  //
  // Yang berukuran nyata adalah KANVAS di dalam panel. Guntingannya karena itu
  // dihitung dalam piksel dari letak kanvas terhadap kotak peta.
  //
  // Kanvas ikut bergeser bersama peta, jadi hitungannya diulang pada tiap
  // `move`, `zoom`, dan `resize`. Murah: satu penulisan gaya pada dua elemen,
  // bukan sembilan ratus lingkaran yang disusun ulang - karena itu tirainya
  // dapat digeser terus-menerus tanpa peta tersendat.
  // --------------------------------------------------------------------
  const pasangTirai = useCallback(() => {
    const peta = petaRef.current;
    const kotak = wadah.current;
    if (!peta || !kotak) return;
    const kiri = peta.getPane("aletaKiri")?.querySelector("canvas");
    const kanan = peta.getPane("aletaKanan")?.querySelector("canvas");

    // Dibersihkan SENDIRI-SENDIRI, bukan sesudah keduanya dipastikan ada.
    // Ketika tirai dimatikan, lingkaran sisi kanan dihapus lebih dahulu -
    // dan menghapus lingkaran terakhir yang memakai satu penggambar membuat
    // Leaflet mencabut kanvasnya dari halaman. Bila pembersihan menunggu
    // kanvas kanan, guntingan sisi KIRI tidak akan pernah dilepas, dan
    // petanya tertinggal separuh selamanya.
    if (!lapisanB) {
      if (kiri) kiri.style.clipPath = "";
      if (kanan) kanan.style.clipPath = "";
      return;
    }
    if (!kiri || !kanan) return;

    const rk = kotak.getBoundingClientRect();
    const garis = rk.left + (tirai / 100) * rk.width;
    const a = kiri.getBoundingClientRect();
    const b = kanan.getBoundingClientRect();
    kiri.style.clipPath = `inset(0 ${Math.max(0, a.width - (garis - a.left))}px 0 0)`;
    kanan.style.clipPath = `inset(0 0 0 ${Math.max(0, garis - b.left)}px)`;
  }, [lapisanB, tirai]);

  useEffect(() => {
    const peta = petaRef.current;
    if (!siap || !peta) return;
    pasangTirai();
    peta.on("move zoom zoomend resize", pasangTirai);
    return () => peta.off("move zoom zoomend resize", pasangTirai);
  }, [siap, pasangTirai]);

  // --------------------------------------------------------------------
  // LAYAR PENUH - masuk, keluar, dan ukuran yang harus dihitung ulang
  // --------------------------------------------------------------------
  const ubahLayarPenuh = useCallback(async () => {
    const kotak = kotakPeta.current;
    if (!kotak) return;

    if (layarPenuh) {
      if (typeof document !== "undefined" && document.fullscreenElement) {
        try {
          await document.exitFullscreen();
        } catch {
          // Keluar yang ditolak tetap harus melepas keadaan semunya di bawah.
        }
      }
      setPenuhSemu(false);
      setLayarPenuh(false);
      return;
    }

    if (typeof kotak.requestFullscreen === "function") {
      try {
        await kotak.requestFullscreen();
        // Keadaannya TIDAK disetel di sini - fullscreenchange yang
        // menyalakannya, supaya keluar lewat Esc melewati jalan yang sama.
        return;
      } catch {
        // Ditolak - jatuh ke layar penuh semu.
      }
    }
    setPenuhSemu(true);
    setLayarPenuh(true);
  }, [layarPenuh]);

  // Esc, tombol keluar peramban, dan berpindah tab semuanya lewat sini -
  // bukan hanya tombol kita sendiri. Tanpa pendengar ini, keluar lewat Esc
  // meninggalkan tombol yang masih bertuliskan "Keluar layar penuh".
  useEffect(() => {
    if (typeof document === "undefined") return;
    const dengar = () => {
      if (penuhSemu) return;
      setLayarPenuh(document.fullscreenElement === kotakPeta.current);
    };
    document.addEventListener("fullscreenchange", dengar);
    return () => document.removeEventListener("fullscreenchange", dengar);
  }, [penuhSemu]);

  // Layar penuh semu tidak punya Esc dari peramban - ia harus disediakan,
  // sebab Esc adalah yang pertama ditekan orang untuk keluar.
  useEffect(() => {
    if (!penuhSemu || typeof document === "undefined") return;
    const tekan = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setPenuhSemu(false);
      setLayarPenuh(false);
    };
    document.addEventListener("keydown", tekan);
    return () => document.removeEventListener("keydown", tekan);
  }, [penuhSemu]);

  // Kotaknya berganti ukuran tanpa jendela ikut berganti, jadi Leaflet tidak
  // diberi tahu siapa pun. Tanpa ini ubinannya hanya mengisi kotak yang lama
  // dan sisanya kelabu. Tirai ikut dipasang ulang: guntingannya dihitung
  // dalam piksel, dan pikselnya baru saja berubah.
  useEffect(() => {
    const peta = petaRef.current;
    if (!siap || !peta) return;
    const jeda = window.setTimeout(() => {
      peta.invalidateSize();
      pasangTirai();
    }, 180);
    return () => window.clearTimeout(jeda);
  }, [layarPenuh, siap, pasangTirai]);

  // --------------------------------------------------------------------
  // SISI KANAN TIRAI - lingkarannya saja
  // --------------------------------------------------------------------
  //
  // Tanpa keterangan melayang, tanpa ketukan, tanpa penegasan saat penunjuk
  // lewat. Yang dibandingkan orang di sini adalah WARNANYA; menyalin seluruh
  // keterangan ke sisi kanan hanya akan membuat dua kotak keterangan berebut
  // tempat pada satu desa yang sama - dan yang menang bukan yang sedang
  // dilihat, melainkan yang digambar belakangan.
  //
  // Angka sisi kanan tetap dapat dibaca: ketukan pada desanya membuka daftar
  // perkara desa itu, dan keterangan di bawah peta menyebut kedua lapisan.
  // --------------------------------------------------------------------
  useEffect(() => {
    if (!siap || !kumpulanBRef.current) return;
    const kumpulan = kumpulanBRef.current;
    kumpulan.clearLayers();
    if (!lapisanB || digambar.length === 0) return;

    let hidup = true;
    void (async () => {
      const L = await muatLeaflet();
      if (!hidup) return;
      // Urutan yang sama dengan sisi kiri: yang terbesar lebih dahulu, supaya
      // lingkaran kecil tidak tertimbun.
      const urut = [...digambar].sort((a, b) => b.perkara - a.perkara);
      for (const x of urut) {
        const warna = warnaTitikB(x.jenis, x.kunci);
        kumpulan.addLayer(
          L.circleMarker(x.pos, {
            renderer: gambarKananRef.current ?? undefined,
            radius: jariJari(x.perkara),
            color: warna,
            weight: 1.2,
            opacity: 0.85,
            fillColor: warna,
            fillOpacity: lapisanB === "relaas" ? 0.55 : 0.32,
            interactive: false,
          })
        );
      }
      // ----------------------------------------------------------------
      // Tirainya dipasang SESUDAH kanvasnya lahir, bukan sebelum.
      //
      // Kanvas sisi kanan baru dilahirkan Leaflet ketika lingkaran pertama
      // yang memakainya ditambahkan - dan itu terjadi di sini, di dalam blok
      // tak-serentak, jauh sesudah efek pemasang tirai berjalan. Tanpa
      // panggilan susulan ini, tirai pada penyalaan PERTAMA tidak tergunting
      // sama sekali.
      // ----------------------------------------------------------------
      pasangTirai();
    })();

    return () => {
      hidup = false;
    };
  }, [siap, lapisanB, digambar, jariJari, warnaTitikB, pasangTirai]);


  /**
   * ==========================================================================
   * USULAN SIDANG KELILING - DIHITUNG, BUKAN DIKIRA
   * ==========================================================================
   *
   * Tiga hal yang membuat sebuah desa layak: BANYAK perkaranya, JAUH dari
   * kantor, dan panggilannya SERING GAGAL. Skornya perkalian ketiganya, sebab
   * desa yang banyak tetapi dekat tidak menghemat apa pun, dan desa yang jauh
   * tetapi satu perkara setahun tidak sepadan dengan satu rombongan sidang.
   *
   * Yang SUDAH terlayani dikeluarkan - itulah gunanya penanda sidang keliling
   * yang ada. Tanpanya, usulan ini akan terus menyebut Sigi Biromaru yang
   * justru sudah 126 kali disidangi.
   *
   * Dihitung di peramban dari data yang sudah ada di tangan: titik desa, jarak
   * ke kantor, dan lapisan relaas. Tidak ada kueri baru.
   */
  const usulan = useMemo(() => {
    if (!usul) return [];
    const namaTerlayani = keliling
      .map((k) => k.tempat.toLowerCase())
      .join(" ");
    const hasil = tergambar.map(({ t: desa, pos }) => {
      const km = jarakKm(KANTOR, pos);
      const r = petaRelaas.get(desa.kode);
      const gagal = r && r.cukup ? r.persen : 0;
      // Kecamatannya sudah disebut salah satu tempat sidang keliling?
      const terlayani =
        Boolean(desa.kecamatan) && namaTerlayani.includes(desa.kecamatan.toLowerCase());
      return {
        desa,
        km,
        gagal,
        terlayani,
        // Jarak dibagi sepuluh supaya angkanya terbaca; perbandingannya tidak
        // berubah karena pembaginya sama untuk semua.
        skor: terlayani ? 0 : (desa.perkara * (km / 10) * (1 + gagal / 100)),
      };
    });
    return hasil
      .filter((x) => x.skor > 0 && x.km >= 20)
      .sort((a, b) => b.skor - a.skor)
      .slice(0, 8);
  }, [usul, tergambar, petaRelaas, keliling]);

  /**
   * Isi lapisan sebagai CSV.
   *
   * PETANYA SENDIRI TIDAK DAPAT DIUNDUH SEBAGAI GAMBAR, dan itu bukan
   * kelalaian: ubinan peta datang dari peladen lain tanpa izin lintas-asal,
   * sehingga kanvas yang memuatnya menjadi "ternoda" dan peramban menolak
   * mengubahnya jadi berkas. Yang dapat diberikan adalah ANGKANYA - dan untuk
   * laporan, angka justru lebih berguna daripada gambar.
   */
  const unduhCsv = useCallback(() => {
    const judul = LAPISAN.find((x) => x.kunci === lapisan)?.label ?? lapisan;
    const baris = [["kode", "desa", "kecamatan", "kabupaten", "perkara", judul, "keterangan"]];
    for (const { t: desa } of tergambar) {
      const dl = petaLapis.get(desa.kode);
      const dr = petaRelaas.get(desa.kode);
      const nilai =
        lapisan === "perkara"
          ? String(desa.perkara)
          : lapisan === "relaas"
            ? dr && dr.cukup
              ? `${dr.persen}%`
              : ""
            : dl && dl.cukup
              ? String(dl.label ?? dl.nilai)
              : "";
      baris.push([
        desa.kode,
        desa.nama,
        desa.kecamatan,
        desa.kabupaten,
        String(desa.perkara),
        nilai,
        // Keterangan relaas disusun di sini - bentuknya "8 dari 14 relaas" -
        // sebab DesaRelaas memulangkan hitungannya, bukan kalimatnya.
        (lapisan === "relaas"
          ? dr
            ? `${dr.takTemu} dari ${dr.relaas} relaas`
            : ""
          : dl?.keterangan) ?? "",
      ]);
    }
    const teks = baris
      .map((b) => b.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(";"))
      .join("\r\n");
    // Tanda urutan bita di depan - tanpanya Excel membaca "Marawola" sebagai
    // huruf berantakan pada berkas berhuruf non-ASCII.
    const bita = new Blob(["\uFEFF" + teks], { type: "text/csv;charset=utf-8" });
    const alamat = URL.createObjectURL(bita);
    const tautan = document.createElement("a");
    tautan.href = alamat;
    tautan.download = `peta-perkara-${lapisan}.csv`;
    tautan.click();
    URL.revokeObjectURL(alamat);
  }, [lapisan, tergambar, petaLapis, petaRelaas]);

  const jenisTampil = useMemo(
    () => Object.keys(penandaJenis).filter((j) => warnaJenis[j]),
    [penandaJenis, warnaJenis]
  );

  /**
   * Tangga ukuran untuk keterangan - tiga angka sungguhan, bukan lingkaran
   * contoh tanpa nilai.
   *
   * Dibagi empat dan enam belas, bukan dua dan empat: luas yang berbanding
   * lurus dengan jumlah berarti jari-jarinya berbanding dengan akarnya, jadi
   * pembagian empat-lah yang menghasilkan lingkaran separuh.
   */
  const tangga = useMemo(() => {
    if (terbesar <= 0) return [];
    const calon = [terbesar, Math.round(terbesar / 4), Math.round(terbesar / 16)];
    const unik: number[] = [];
    for (const n of calon) {
      if (n >= 1 && !unik.includes(n)) unik.push(n);
    }
    return unik;
  }, [terbesar]);

  return (
    <div className="flex flex-col gap-3">
      <style>{`
        .aleta-peta-tooltip {
          border: 0;
          background: transparent;
          box-shadow: none;
          padding: 0;
        }
        .aleta-peta-tooltip .leaflet-tooltip-tip { display: none; }
        .aleta-peta-tip {
          display: flex;
          flex-direction: column;
          gap: 1px;
          min-width: 9rem;
          padding: 8px 10px;
          border-radius: 10px;
          border: 1px solid hsl(var(--border));
          background: hsl(var(--card));
          color: hsl(var(--card-foreground));
          box-shadow: 0 6px 20px rgb(0 0 0 / 0.18);
          font-size: 0.72rem;
          line-height: 1.35;
        }
        .aleta-peta-tip strong { font-size: 0.85rem; }
        .aleta-peta-tip b { font-size: 0.8rem; }
        .aleta-peta-tip span { color: hsl(var(--muted-foreground)); }
        .aleta-peta-wadah .leaflet-container {
          background: hsl(var(--muted));
          font-family: inherit;
          border-radius: 0.9rem;
        }
        .aleta-peta-wadah .leaflet-control-attribution {
          background: hsl(var(--card) / 0.85);
          color: hsl(var(--muted-foreground));
          font-size: 0.62rem;
        }
        .aleta-peta-wadah .leaflet-control-attribution a { color: hsl(var(--primary)); }
        .aleta-peta-gelap .leaflet-tile-pane {
          filter: invert(1) hue-rotate(180deg) brightness(0.92) contrast(0.92);
        }
      `}</style>

      {galat ? (
        <p className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            {galat} Sebaran berjenjang di bawah tetap dapat dibaca — ia tidak bergantung pada peta.
          </span>
        </p>
      ) : null}

      {/* ==================================================================
          LAPISAN - SATU PILIHAN, BUKAN DUA PETA
          ==================================================================

          Dua besaran yang sangat berbeda: jumlah perkara adalah HITUNGAN,
          panggilan tidak bertemu adalah NISBAH. Digambar bersamaan pada satu
          lingkaran, keduanya berebut arti warna dan ukuran - dan pembacanya
          tidak dapat tahu yang mana yang sedang ia lihat. */}
      <div className="flex flex-wrap items-center gap-1.5">
        {LAPISAN.map((l) => (
          <Button
            key={l.kunci}
            type="button"
            size="sm"
            variant={lapisan === l.kunci ? "default" : "outline"}
            onClick={() => {
              // Memilih lapisan yang sedang berada di sisi KANAN berarti
              // MENUKAR keduanya. Tanpa ini, kedua sisi tirai memuat lapisan
              // yang sama - dan pilihan kanan lenyap dari daftarnya sendiri,
              // meninggalkan kotak pilihan yang tampak kosong.
              if (l.kunci === lapisanB) setLapisanB(lapisan);
              setLapisan(l.kunci);
            }}
          >
            {l.label}
          </Button>
        ))}
        {memuatRelaas || memuatLapis ? (
          <span className="text-xs text-muted-foreground">membaca…</span>
        ) : null}
      </div>

      {/* ==================================================================
          TIRAI PEMBANDING - SATU PETA, BUKAN DUA PETA BERDAMPINGAN
          ==================================================================

          Dua peta berdampingan menuntut zum dan geseran keduanya disamakan
          terus-menerus, dan sekali saja tidak sama, yang dibandingkan orang
          adalah dua tempat yang berbeda. Dua peta juga meminta ubinan dua kali
          kepada penyedia yang sama, dan memaksa mata berpindah sejauh lebar
          layar tiap kali satu desa diperiksa.

          Satu peta bertirai tidak menuntut apa pun disamakan - keduanya memang
          peta yang sama - dan mata tidak berpindah sama sekali. */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Columns2 className="h-3.5 w-3.5" aria-hidden />
          Tirai pembanding
          <select
            value={lapisanB}
            onChange={(e) => setLapisanB(e.target.value)}
            title="Lapisan kedua, digambar di sisi kanan tirai"
            className="max-w-[12rem] rounded-lg border border-input bg-background px-2 py-1 text-xs"
          >
            <option value="">mati</option>
            {LAPISAN.filter((l) => l.kunci !== lapisan).map((l) => (
              <option key={l.kunci} value={l.kunci}>
                {l.label}
              </option>
            ))}
          </select>
        </label>

        {lapisanB ? (
          <label className="inline-flex flex-1 items-center gap-2 text-xs text-muted-foreground">
            <span className="whitespace-nowrap">
              {LAPISAN.find((l) => l.kunci === lapisan)?.label ?? lapisan}
            </span>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={tirai}
              onChange={(e) => setTirai(Number(e.target.value))}
              aria-label="Letak tirai"
              className="min-w-[8rem] flex-1 accent-primary"
            />
            <span className="whitespace-nowrap">
              {LAPISAN.find((l) => l.kunci === lapisanB)?.label ?? lapisanB}
            </span>
          </label>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          type="button"
          size="sm"
          variant={cincin ? "default" : "outline"}
          onClick={() => setCincin((x) => !x)}
          title="Lingkaran 10, 25, 50, dan 100 km dari kantor pengadilan"
        >
          <Maximize2 className="mr-1.5 h-3.5 w-3.5" aria-hidden />
          Cincin jarak
        </Button>
        <Button
          type="button"
          size="sm"
          variant={usul ? "default" : "outline"}
          onClick={() => setUsul((x) => !x)}
        >
          <MapPin className="mr-1.5 h-3.5 w-3.5" aria-hidden />
          Usul sidang keliling
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={unduhCsv}>
          <Layers className="mr-1.5 h-3.5 w-3.5" aria-hidden />
          Unduh CSV
        </Button>
        <span className="ml-auto text-xs text-muted-foreground">
          {zum >= ZUM_DESA ? "tingkat desa" : "tingkat kecamatan — perbesar untuk desa"}
        </span>
      </div>

      {lapisan !== "perkara" && lapisan !== "relaas" && lapis[lapisan]?.keterangan ? (
        <p className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>{galatLapis || lapis[lapisan]?.keterangan}</span>
        </p>
      ) : null}

      {lapisan === "relaas" ? (
        <p className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            {galatRelaas ? (
              galatRelaas
            ) : relaas ? (
              <>
                Dihitung dari <strong>{angka(relaas.relaas ?? 0)}</strong> relaas yang memakai sandi
                bertemu/tidak — <strong>{relaas.persen ?? 0}%</strong> tidak bertemu. Sandi{" "}
                <code>ket_temu</code> BERGANTI ARTI sejak 2025: sejak itu isinya menandai saluran
                pengiriman, bukan hasil pertemuan, sehingga baris baru hampir seluruhnya di luar
                hitungan ini. Desa dengan kurang dari {relaas.ambang ?? 10} relaas dibiarkan kelabu —
                tiga relaas yang dua gagal bukan &quot;67% gagal&quot;, itu kebetulan.
              </>
            ) : (
              "Membaca sebaran panggilan…"
            )}
          </span>
        </p>
      ) : null}

      <div
        ref={kotakPeta}
        className={cn(
          "aleta-peta-wadah relative overflow-hidden rounded-[0.9rem] border border-border",
          gelap && "aleta-peta-gelap",
          // ================================================================
          // TINGGINYA DIPASTIKAN SENDIRI, TIDAK DITITIPKAN KE PERAMBAN
          // ================================================================
          //
          // Gaya bawaan peramban untuk :fullscreen berbunyi
          //
          //     position: fixed; inset: 0; width: 100%; height: 100%;
          //
          // tetapi gaya penulis mengalahkan gaya bawaan, dan kotak ini
          // berkelas `relative` - sehingga posisinya kembali relative
          // sedangkan height: 100%-nya tetap berlaku. Unsur berposisi relative
          // masih berada di dalam alur, jadi blok penampungnya INDUKNYA yang
          // setinggi auto - dan 100% terhadap auto memulangkan auto.
          //
          // Terukur di peramban pada susunan yang sama: dengan position
          // relative, height 100% meninggalkan kotaknya pada 708 px - tidak
          // berubah sama sekali - sedangkan 100vh memberinya 770 px.
          //
          // Anak di dalamnya berkelas h-full, jadi ia ikut mengerut ke nol.
          // Peta setinggi nol tidak menggambar ubinan maupun lingkaran, dan
          // itulah layar penuh yang kosong sama sekali.
          //
          // `relative` DIPERTAHANKAN: tombol keluar di dalamnya berposisi
          // absolut terhadap kotak ini.
          //
          // Sudut membulat pada kotak yang menutupi seluruh layar hanya
          // menyisakan empat serpih latar di pojoknya.
          layarPenuh && "h-screen w-screen rounded-none bg-background",
          penuhSemu && "fixed inset-0 z-[1200]"
        )}
      >
        <div
          ref={wadah}
          className={cn("w-full", layarPenuh ? "h-full" : "h-[26rem] sm:h-[32rem]")}
        />

        {/* Tombolnya di dalam peta, bukan di bilah alat di atasnya: yang
            menekan layar penuh sedang melihat petanya, dan setelah penuh
            bilah alat itu tidak ikut terbawa. */}
        <button
          type="button"
          onClick={() => void ubahLayarPenuh()}
          aria-pressed={layarPenuh}
          title={layarPenuh ? "Keluar layar penuh (Esc)" : "Layar penuh"}
          className="absolute right-3 top-3 z-[1000] inline-flex items-center gap-1.5 rounded-lg border border-border bg-background/90 px-2.5 py-1.5 text-xs font-medium shadow-sm backdrop-blur transition hover:bg-muted"
        >
          {layarPenuh ? (
            <Minimize2 className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <Maximize2 className="h-3.5 w-3.5" aria-hidden />
          )}
          {layarPenuh ? "Keluar layar penuh" : "Layar penuh"}
        </button>
        {/* Garis tirainya sendiri. Tanpa garis, batas antara dua lapisan hanya
            terbaca sebagai warna yang berubah mendadak - dan warna yang berubah
            mendadak pada peta terbaca sebagai temuan, bukan sebagai batas. */}
        {lapisanB && siap ? (
          <div
            className="pointer-events-none absolute inset-y-0 z-[640] w-px bg-foreground/60"
            style={{ left: `${tirai}%` }}
            aria-hidden
          />
        ) : null}
        {!siap && !galat ? (
          <div className="absolute inset-0 grid place-items-center bg-muted/40 text-sm text-muted-foreground">
            Menggambar peta…
          </div>
        ) : null}
      </div>

      {lapisanB ? (
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <Columns2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            Kiri tirai <b>{LAPISAN.find((l) => l.kunci === lapisan)?.label ?? lapisan}</b>, kanan{" "}
            <b>{LAPISAN.find((l) => l.kunci === lapisanB)?.label ?? lapisanB}</b>. Tangga warna
            kedua sisi disusun dari jangkauan lapisannya MASING-MASING, jadi yang dibandingkan
            letak desanya pada tangga sisinya sendiri — bukan warnanya dengan warna sebelah.
            Keterangan melayang dan ketukan tetap milik sisi kiri.
          </span>
        </p>
      ) : null}

      {/* ==================================================================
          KETERANGAN - UKURAN, WARNA, DAN YANG TIDAK ADA DI PETA
          ================================================================== */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
        {/* Keterangan ukuran memakai ANGKA SUNGGUHAN dari data yang sedang
            tampil, bukan lingkaran contoh tanpa nilai: yang ingin diketahui
            pembaca bukan "besar berarti banyak" - itu sudah jelas - melainkan
            seberapa banyak. Ketiganya dihitung dengan fungsi jari-jari yang
            sama persis dengan yang menggambar petanya. */}
        {tangga.length > 0 ? (
          <span className="inline-flex items-end gap-2">
            <Maximize2 className="mb-0.5 h-3.5 w-3.5" aria-hidden />
            <svg
              width={tangga.reduce((n, t) => n + jariJari(t) * 2 + 8, 0)}
              height={jariJari(tangga[0]) * 2 + 4}
              className="overflow-visible"
              aria-hidden
            >
              {tangga.reduce<{ x: number; simpul: ReactNode[] }>(
                (kum, nilai) => {
                  const r = jariJari(nilai);
                  const cx = kum.x + r;
                  kum.simpul.push(
                    <circle
                      key={nilai}
                      cx={cx}
                      cy={jariJari(tangga[0]) + 2 - 0}
                      r={r}
                      fill="currentColor"
                      fillOpacity={0.18}
                      stroke="currentColor"
                      strokeOpacity={0.5}
                    />
                  );
                  kum.x = cx + r + 8;
                  return kum;
                },
                { x: 0, simpul: [] }
              ).simpul}
            </svg>
            <span className="mb-0.5">
              {tangga.map((t) => angka(t)).join(" · ")} perkara
            </span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5">
            <Maximize2 className="h-3.5 w-3.5" aria-hidden />
            Luas lingkaran = jumlah perkara
          </span>
        )}
        {lapisan === "perkara"
          ? jenisTampil.map((j) => (
              <span key={j} className="inline-flex items-center gap-1.5">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ background: warnaJenis[j] }}
                  aria-hidden
                />
                {j}
              </span>
            ))
          : (
              <span className="inline-flex items-center gap-1.5">
                {[...TANGGA_RELAAS].reverse().map((l) => (
                  <span key={l.batas} className="inline-flex items-center gap-1">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ background: l.warna }}
                      aria-hidden
                    />
                    {l.batas}%
                  </span>
                ))}
                <span className="inline-flex items-center gap-1">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ background: WARNA_TAK_CUKUP }}
                    aria-hidden
                  />
                  terlalu sedikit
                </span>
              </span>
            )}
        <span className="inline-flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5" aria-hidden />
          {angka(tergambar.length)} desa tergambar
        </span>
      </div>

      {takBerkoordinat.desa > 0 || tanpaKode > 0 ? (
        <p className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            {takBerkoordinat.desa > 0 ? (
              <>
                <strong>{angka(takBerkoordinat.desa)} desa</strong> ({angka(takBerkoordinat.perkara)}{" "}
                perkara) belum punya titik di OpenStreetMap, jadi tidak digambar.{" "}
              </>
            ) : null}
            {tanpaKode > 0 ? (
              <>
                <strong>{angka(tanpaKode)} perkara</strong> alamatnya tersimpan sebagai tulisan tanpa
                kode wilayah — era pengisian data yang lama — sehingga tidak dapat ditempatkan.{" "}
              </>
            ) : null}
            Keduanya sengaja tidak digeser ke desa terdekat: peta yang terlihat lengkap tetapi
            memindahkan perkara ke tempat yang bukan asalnya lebih buruk daripada peta yang mengaku
            kurang.
          </span>
        </p>
      ) : null}

      {/* ==================================================================
          USULAN SIDANG KELILING
          ==================================================================

          Tiga hal dikalikan: banyak perkaranya, jauh dari kantor, dan
          panggilannya sering gagal. Yang kecamatannya SUDAH terlayani sidang
          keliling dikeluarkan - tanpa itu, usulan ini akan terus menyebut Sigi
          Biromaru yang justru sudah 126 kali disidangi. */}
      {usul ? (
        <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
          <p className="mb-1.5 text-sm font-semibold">
            Usulan sidang keliling — delapan teratas
          </p>
          {usulan.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Tidak ada desa berjarak lebih dari 20 km yang belum terlayani pada rentang ini.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[30rem] text-xs">
                <thead className="text-left text-muted-foreground">
                  <tr>
                    <th className="py-1 pr-2 font-medium">Desa</th>
                    <th className="py-1 pr-2 font-medium">Kecamatan</th>
                    <th className="py-1 pr-2 text-right font-medium">Perkara</th>
                    <th className="py-1 pr-2 text-right font-medium">Jarak</th>
                    <th className="py-1 text-right font-medium">Panggilan gagal</th>
                  </tr>
                </thead>
                <tbody>
                  {usulan.map((u) => (
                    <tr key={u.desa.kode} className="border-t border-border/60">
                      <td className="py-1 pr-2 font-medium">{u.desa.nama}</td>
                      <td className="py-1 pr-2 text-muted-foreground">{u.desa.kecamatan}</td>
                      <td className="py-1 pr-2 text-right tabular-nums">{angka(u.desa.perkara)}</td>
                      <td className="py-1 pr-2 text-right tabular-nums">{Math.round(u.km)} km</td>
                      <td className="py-1 text-right tabular-nums">
                        {u.gagal > 0 ? `${u.gagal}%` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {keliling.length > 0 ? (
            <p className="mt-1.5 text-[0.7rem] text-muted-foreground">
              Sudah terlayani: {keliling.slice(0, 5).map((k) => `${k.tempat} (${angka(k.sidang)})`).join(" · ")}
            </p>
          ) : null}
          <p className="mt-1 text-[0.7rem] text-muted-foreground">
            Angka panggilan gagal hanya terisi bila lapisan &quot;panggilan tidak bertemu&quot; sudah
            dibuka sekali — ia dibaca terpisah, dan tidak dibayar oleh yang tidak membukanya.
          </p>
        </div>
      ) : null}

      {/* ==================================================================
          DESA YANG DIKETUK - DAFTAR PERKARANYA
          ==================================================================

          Peta yang hanya dapat dilihat berhenti pada "oh, banyak". Yang dapat
          diketuk meneruskan ke pekerjaan: nomor perkaranya, jenisnya, dan
          kapan diputus.

          Nama pihak datang sudah berupa INISIAL dari peladen. Peta dibuka di
          layar yang kerap terlihat orang lain, dan daftar nama orang
          berperkara per desa adalah hal yang paling tidak boleh terpajang. */}
      {desaDibuka ? (
        <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold">
              {desaDibuka.nama}
              <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                {desaDibuka.kecamatan}
                {desaDibuka.kabupaten ? `, ${desaDibuka.kabupaten}` : ""} · {angka(desaDibuka.perkara)}{" "}
                perkara
              </span>
            </p>
            <Button type="button" size="sm" variant="ghost" onClick={() => setDesaDibuka(null)}>
              <X className="mr-1 h-3.5 w-3.5" aria-hidden />
              Tutup
            </Button>
          </div>

          {memuatDesa ? (
            <p className="text-xs text-muted-foreground">Membaca daftar perkara…</p>
          ) : (perkaraDesa ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Tidak ada perkara desa ini pada rentang dan jenis yang sedang dipilih.
            </p>
          ) : (
            <div className="max-h-56 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="text-left text-muted-foreground">
                  <tr>
                    <th className="py-1 pr-2 font-medium">Nomor perkara</th>
                    <th className="py-1 pr-2 font-medium">Jenis</th>
                    <th className="py-1 pr-2 font-medium">Putus</th>
                    <th className="py-1 font-medium">Pihak</th>
                  </tr>
                </thead>
                <tbody>
                  {(perkaraDesa ?? []).map((p) => (
                    <tr key={p.nomorPerkara} className="border-t border-border/60">
                      <td className="py-1 pr-2 font-medium">{p.nomorPerkara}</td>
                      <td className="py-1 pr-2 text-muted-foreground">{p.jenisPerkara}</td>
                      <td className="py-1 pr-2 tabular-nums text-muted-foreground">
                        {p.tanggalPutusan || "—"}
                      </td>
                      <td className="py-1 text-muted-foreground">
                        <Users className="mr-1 inline h-3 w-3" aria-hidden />
                        {p.kelamin === "L" ? "L" : p.kelamin === "P" ? "P" : "—"} {p.inisial}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      {berkas?.sumber ? (
        <p className="flex items-start gap-2 text-[0.7rem] text-muted-foreground">
          <Layers className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
          <span>
            Titik desa: {berkas.sumber}
            {berkas.cakupan?.desaBerkoordinat
              ? ` — ${angka(berkas.cakupan.desaBerkoordinat)} dari ${angka(
                  berkas.cakupan.desaSeluruhnya || 0
                )} desa yang pernah muncul di perkara satker`
              : ""}
            . Koordinatnya tidak diambil dari SIPP: satu-satunya tabel SIPP yang punya lintang/bujur
            memuat satu titik untuk seluruh kabupaten.
          </span>
        </p>
      ) : null}
    </div>
  );
}

export default PetaTitikPerkara;
