"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, Info, Layers, Maximize2, MapPin, Users, X } from "lucide-react";

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

const angka = (n: number) => n.toLocaleString("id-ID");

/** Nama yang aman disisipkan ke dalam tooltip HTML Leaflet. */
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
  /** Pandangan awal hanya disesuaikan sekali - lihat penggambar di bawah. */
  const sudahDipaskan = useRef(false);
  const [galat, setGalat] = useState("");
  const [siap, setSiap] = useState(false);
  const [koordinat, setKoordinat] = useState<Record<string, [number, number]> | null>(null);
  const [berkas, setBerkas] = useState<BerkasTitik | null>(null);
  const [gelap, setGelap] = useState(false);

  /** Lapisan yang sedang digambar - jumlah perkara, atau panggilan tak bertemu. */
  const [lapisan, setLapisan] = useState<"perkara" | "relaas">("perkara");
  const [relaas, setRelaas] = useState<MuatanRelaas | null>(null);
  const [galatRelaas, setGalatRelaas] = useState("");
  const [memuatRelaas, setMemuatRelaas] = useState(false);

  /** Desa yang lingkarannya diketuk, beserta daftar perkaranya. */
  const [desaDibuka, setDesaDibuka] = useState<TitikPerkara | null>(null);
  const [perkaraDesa, setPerkaraDesa] = useState<PerkaraDesa[] | null>(null);
  const [memuatDesa, setMemuatDesa] = useState(false);

  /** Zum berjalan - penentu desa atau kecamatan yang digambar. */
  const [zum, setZum] = useState(9);

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

        kumpulanRef.current = L.layerGroup().addTo(peta);
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
      const kunci = `${x.t.kabupaten}|${x.t.kecamatan}` || x.t.kode;
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
   * Warna lingkaran, menurut lapisan yang dipilih.
   *
   *   perkara  jenis perkara yang paling banyak di tempat itu
   *   relaas   persentase panggilan tidak bertemu, satu rona menua
   *
   * Pada lapisan relaas, tempat yang relaasnya TERLALU SEDIKIT diberi warna
   * kelabu - bukan warna termuda. Desa dengan tiga relaas yang dua di antaranya
   * gagal bukan "67% gagal", itu kebetulan; mewarnainya seperti desa lain
   * membuat kebetulan terbaca sebagai temuan.
   */
  const warnaTitik = useCallback(
    (jenis: Record<string, number>, kode: string) => {
      if (lapisan === "relaas") {
        const d = petaRelaas.get(kode);
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
    [warnaJenis, lapisan, petaRelaas]
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

        const d = x.titik ? petaRelaas.get(x.titik.kode) : null;
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
  }, [siap, digambar, jariJari, warnaTitik, lapisan, petaRelaas]);

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
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant={lapisan === "perkara" ? "default" : "outline"}
          onClick={() => setLapisan("perkara")}
        >
          Jumlah perkara
        </Button>
        <Button
          type="button"
          size="sm"
          variant={lapisan === "relaas" ? "default" : "outline"}
          onClick={() => setLapisan("relaas")}
        >
          Panggilan tidak bertemu
        </Button>
        {memuatRelaas ? (
          <span className="text-xs text-muted-foreground">membaca relaas…</span>
        ) : null}
        <span className="ml-auto text-xs text-muted-foreground">
          {zum >= ZUM_DESA ? "tingkat desa" : "tingkat kecamatan — perbesar untuk desa"}
        </span>
      </div>

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
        className={cn(
          "aleta-peta-wadah relative overflow-hidden rounded-[0.9rem] border border-border",
          gelap && "aleta-peta-gelap"
        )}
      >
        <div ref={wadah} className="h-[26rem] w-full sm:h-[32rem]" />
        {!siap && !galat ? (
          <div className="absolute inset-0 grid place-items-center bg-muted/40 text-sm text-muted-foreground">
            Menggambar peta…
          </div>
        ) : null}
      </div>

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
