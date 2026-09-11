"use client";

import {
  Children,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { GripVertical, RotateCcw } from "lucide-react";

import { apiPath } from "@/lib/base-path";

/**
 * ============================================================================
 * MENYUSUN DASBOR DENGAN MENAHAN LALU MENGGESER
 * ============================================================================
 *
 * Dasbor menampilkan hal yang sama bagi semua orang dalam urutan yang sama,
 * padahal yang dikerjakan tiap jabatan berbeda. Berkas ini membuat tiap
 * pengguna dapat menyusunnya sendiri: tahan sebuah kartu, geser, lepas.
 *
 * ============================================================================
 * KENAPA TIDAK SATU PUN GERAKAN MENYENTUH STATE REACT
 * ============================================================================
 *
 * Selama jari atau tetikus bergerak, TIDAK ada setState sama sekali. Posisi
 * kartu ditulis langsung ke `style.transform` lewat ref, dan satu penggambaran
 * ulang React hanya terjadi dua kali: sekali saat seretan dimulai, sekali saat
 * dilepas.
 *
 * Ini bukan penghematan yang dicari-cari. Dasbor ini memuat kartu yang
 * isinya dihitung dari ratusan baris surat dan disposisi; satu render per
 * gerakan berarti seluruh perhitungan itu diulang enam puluh kali per detik,
 * dan seretannya akan tersendat persis pada mesin kantor yang paling lambat -
 * yaitu mesin yang dipakai.
 *
 * Tiga hal lagi yang menjaganya tetap mulus:
 *
 *   1. Ukuran dan letak seluruh kartu diukur SEKALI saat seretan dimulai, lalu
 *      dipakai apa adanya. Memanggil getBoundingClientRect di tengah gerakan
 *      memaksa peramban menghitung ulang tata letak pada tiap pergerakan.
 *   2. Gerakannya digabung ke satu requestAnimationFrame. Peristiwa pointer
 *      datang lebih sering daripada layar menggambar.
 *   3. Yang berpindah hanya `transform` - tidak ada `top`, `left`, atau
 *      penyusunan ulang DOM selama seretan, sehingga peramban dapat
 *      menggesernya di kartu grafis tanpa menghitung tata letak lagi.
 *
 * ============================================================================
 * TAHAN DULU, BARU GESER - DAN ITU BERBEDA ANTARA JARI DAN TETIKUS
 * ============================================================================
 *
 * Pada layar sentuh, menggeser adalah cara menggulir halaman. Karena itu jari
 * harus MENAHAN dulu (250 md) sebelum kartunya terangkat; tanpa itu, setiap
 * usaha menggulir dasbor akan menyeret kartu. Pada tetikus tidak ada
 * kebingungan seperti itu, jadi seretan dimulai begitu kursor bergerak lima
 * piksel - menahan seperempat detik dengan tetikus hanya terasa lambat.
 *
 * ============================================================================
 * KARTUNYA TETAP TAUTAN
 * ============================================================================
 *
 * Kartu ringkasan adalah tautan ke halaman lain, dan itu tidak boleh hilang.
 * Karena itu klik hanya ditahan bila seretan BENAR-BENAR terjadi; menahan lalu
 * melepas tanpa menggeser tetap membuka tautannya seperti biasa.
 */

// ─── Penyimpanan susunan ─────────────────────────────────────────────────────

type Susunan = Record<string, string[]>;

type IsiPenata = {
  susunan: Susunan;
  /** Menyimpan urutan satu zona: seketika di peramban, lalu ke server. */
  simpanZona: (zona: string, urutan: string[]) => void;
  kembalikanBawaan: () => void;
  sudahDisusun: boolean;
};

const KonteksPenata = createContext<IsiPenata | null>(null);

const kunciSinggahan = (halaman: string) => `aleta:tata-letak-dasbor:${halaman}`;

/** Membaca singgahan peramban. Gagal berarti belum pernah disusun, bukan galat. */
function bacaSinggahan(halaman: string): Susunan {
  try {
    const mentah = window.localStorage.getItem(kunciSinggahan(halaman));
    if (!mentah) return {};
    const isi = JSON.parse(mentah);
    return isi && typeof isi === "object" && !Array.isArray(isi) ? (isi as Susunan) : {};
  } catch {
    // Mode penyamaran, kuota penuh, atau data situs yang dimatikan. Tidak satu
    // pun dari itu boleh membuat dasbor gagal tampil.
    return {};
  }
}

function tulisSinggahan(halaman: string, susunan: Susunan) {
  try {
    window.localStorage.setItem(kunciSinggahan(halaman), JSON.stringify(susunan));
  } catch {
    /* penyimpanan peramban ditolak: susunannya tetap tersimpan di server */
  }
}

/**
 * Penyedia susunan untuk satu halaman.
 *
 * Server dibaca sekali saat halaman dibuka, dan ditulis paling cepat sekali
 * per setengah detik. Penulisan yang mengiringi tiap lepasan tidak perlu
 * ditunggu siapa pun: layarnya sudah benar sebelum permintaannya berangkat.
 */
export function PenataDasbor({ halaman, children }: { halaman: string; children: ReactNode }) {
  const [susunan, setSusunan] = useState<Susunan>({});
  const [sudahDisusun, setSudahDisusun] = useState(false);
  const tundaSimpan = useRef<number | null>(null);
  const terakhirDikirim = useRef<Susunan>({});

  // useLayoutEffect, bukan useEffect: keduanya berjalan sesudah HTML dari
  // server terpasang, tetapi hanya useLayoutEffect yang selesai SEBELUM
  // peramban menggambar. Dengan useEffect, dasbor sempat tergambar satu bingkai
  // dalam urutan bawaan lalu melompat ke urutan pengguna - dan lompatan itu
  // terlihat pada tiap pemuatan halaman.
  useLayoutEffect(() => {
    const dariPeramban = bacaSinggahan(halaman);
    if (Object.keys(dariPeramban).length > 0) {
      setSusunan(dariPeramban);
      setSudahDisusun(true);
    }
  }, [halaman]);

  // Server dibaca sesudahnya, dan menang bila berbeda: ia yang mengikuti
  // pengguna berpindah komputer. Singgahan peramban hanya mempercepat gambar
  // pertama.
  useEffect(() => {
    let dibatalkan = false;
    void (async () => {
      try {
        const jawaban = await fetch(
          apiPath(`/api/dasbor/tata-letak?halaman=${encodeURIComponent(halaman)}`),
          { cache: "no-store" }
        );
        if (!jawaban.ok || dibatalkan) return;
        const isi = await jawaban.json();
        const dariServer = (isi?.data ?? isi)?.susunan;
        if (!dariServer || typeof dariServer !== "object" || dibatalkan) return;

        terakhirDikirim.current = dariServer as Susunan;
        if (Object.keys(dariServer).length > 0) {
          setSusunan(dariServer as Susunan);
          setSudahDisusun(true);
          tulisSinggahan(halaman, dariServer as Susunan);
        }
      } catch {
        /* dasbor tetap memakai susunan dari peramban */
      }
    })();
    return () => {
      dibatalkan = true;
    };
  }, [halaman]);

  const kirimKeServer = useCallback(
    (isi: Susunan) => {
      if (tundaSimpan.current !== null) window.clearTimeout(tundaSimpan.current);
      tundaSimpan.current = window.setTimeout(() => {
        tundaSimpan.current = null;
        terakhirDikirim.current = isi;
        void fetch(apiPath("/api/dasbor/tata-letak"), {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ halaman, susunan: isi }),
        }).catch(() => {
          /* tersimpan di peramban; server dicoba lagi pada perubahan berikutnya */
        });
      }, 500);
    },
    [halaman]
  );

  const simpanZona = useCallback(
    (zona: string, urutan: string[]) => {
      setSusunan((lama) => {
        const baru = { ...lama, [zona]: urutan };
        tulisSinggahan(halaman, baru);
        kirimKeServer(baru);
        return baru;
      });
      setSudahDisusun(true);
    },
    [halaman, kirimKeServer]
  );

  const kembalikanBawaan = useCallback(() => {
    setSusunan({});
    setSudahDisusun(false);
    try {
      window.localStorage.removeItem(kunciSinggahan(halaman));
    } catch {
      /* tidak apa-apa */
    }
    if (tundaSimpan.current !== null) window.clearTimeout(tundaSimpan.current);
    void fetch(apiPath(`/api/dasbor/tata-letak?halaman=${encodeURIComponent(halaman)}`), {
      method: "DELETE",
    }).catch(() => {
      /* susunan peramban sudah dibersihkan */
    });
  }, [halaman]);

  // Penyimpanan yang masih tertunda saat halaman ditutup akan hilang. Dikirim
  // paksa lewat sendBeacon - satu-satunya cara yang tidak dibatalkan peramban
  // ketika tabnya ditutup.
  useEffect(() => {
    const saatTutup = () => {
      if (tundaSimpan.current === null) return;
      window.clearTimeout(tundaSimpan.current);
      tundaSimpan.current = null;
      try {
        navigator.sendBeacon?.(
          apiPath("/api/dasbor/tata-letak"),
          new Blob([JSON.stringify({ halaman, susunan })], { type: "application/json" })
        );
      } catch {
        /* tersimpan di peramban */
      }
    };
    window.addEventListener("pagehide", saatTutup);
    return () => {
      window.removeEventListener("pagehide", saatTutup);
      saatTutup();
    };
  }, [halaman, susunan]);

  const isi = useMemo<IsiPenata>(
    () => ({ susunan, simpanZona, kembalikanBawaan, sudahDisusun }),
    [susunan, simpanZona, kembalikanBawaan, sudahDisusun]
  );

  return <KonteksPenata.Provider value={isi}>{children}</KonteksPenata.Provider>;
}

export function usePenataDasbor() {
  return useContext(KonteksPenata);
}

// ─── Menyusun ulang daftar ───────────────────────────────────────────────────

/**
 * Menerapkan urutan tersimpan pada kartu yang benar-benar ada.
 *
 * Dua aturan yang menjaga dasbor tidak pernah kehilangan kartu:
 *
 *   - kunci tersimpan yang kartunya tidak ada (dicabut kewenangannya, atau
 *     dihapus dari kode) DIABAIKAN, dan
 *   - kartu yang belum pernah disusun muncul di AKHIR, bukan hilang.
 *
 * Tanpa aturan kedua, setiap kartu baru akan tidak terlihat oleh semua orang
 * yang pernah menyusun dasbornya - yaitu justru pengguna yang paling sering
 * memakainya.
 */
export function terapkanUrutan<T>(daftar: T[], kunciDari: (x: T) => string, urutan: string[] | undefined) {
  if (!urutan || urutan.length === 0) return daftar;

  const belumDipakai = new Map(daftar.map((x) => [kunciDari(x), x]));
  const hasil: T[] = [];

  for (const kunci of urutan) {
    const cocok = belumDipakai.get(kunci);
    if (cocok === undefined) continue;
    hasil.push(cocok);
    belumDipakai.delete(kunci);
  }

  // Sisanya menyusul dalam urutan aslinya, sehingga kartu baru selalu terlihat.
  for (const x of daftar) {
    if (belumDipakai.has(kunciDari(x))) hasil.push(x);
  }

  return hasil;
}

/** Memindahkan satu unsur dari satu kedudukan ke kedudukan lain. */
export function pindahkan<T>(daftar: T[], dari: number, ke: number) {
  if (dari === ke || dari < 0 || ke < 0 || dari >= daftar.length || ke >= daftar.length) return daftar;
  const salinan = daftar.slice();
  const [diambil] = salinan.splice(dari, 1);
  salinan.splice(ke, 0, diambil);
  return salinan;
}

/**
 * Tombol yang mengembalikan dasbor ke susunan bawaan.
 *
 * Hanya digambar setelah dasbornya benar-benar pernah disusun. Tombol yang
 * selalu ada akan menawarkan pembatalan atas sesuatu yang belum pernah diubah -
 * dan pada dasbor yang masih bawaan, menekannya tidak mengubah apa pun,
 * sehingga terbaca sebagai tombol yang rusak.
 */
export function TombolKembalikanSusunan() {
  const penata = usePenataDasbor();
  if (!penata?.sudahDisusun) return null;

  return (
    <button
      type="button"
      onClick={penata.kembalikanBawaan}
      className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <RotateCcw className="h-3.5 w-3.5" aria-hidden />
      Kembalikan susunan bawaan
    </button>
  );
}

// ─── Kartu yang dapat digeser ────────────────────────────────────────────────

type PropItem = { kunci: string; judul?: string; children: ReactNode; className?: string };

/**
 * Pembungkus satu kartu.
 *
 * Sengaja tidak menggambar apa-apa sendiri selain pegangan geser: kartu di
 * dalamnya tetap kartu yang sama, dengan tautan, tombol, dan tata letaknya
 * sendiri. Yang ditambahkan hanya kemampuan dipindahkan.
 */
export function ItemGeser(_prop: PropItem): ReactNode {
  // Tidak pernah dipanggil React: SusunanGeser membaca propnya lalu menggambar
  // sendiri pembungkusnya. Bentuk komponen dipakai supaya tempat pemanggilnya
  // terbaca sebagai JSX biasa, bukan sebagai larik obyek.
  return null;
}
ItemGeser.displayName = "ItemGeser";

// ─── Wadah ───────────────────────────────────────────────────────────────────

const TAHAN_SENTUH_MD = 250;
const AMBANG_TETIKUS_PX = 5;
const AMBANG_BATAL_SENTUH_PX = 10;
const LAMA_JATUH_MD = 180;

type PropSusunan = {
  zona: string;
  className?: string;
  children: ReactNode;
  /** Diteruskan ke wadah, supaya pengujian yang sudah ada tetap menemukannya. */
  "data-testid"?: string;
  /** Keterangan untuk pembaca layar, mis. "kartu ringkasan". */
  sebutan?: string;
};

export function SusunanGeser({ zona, className, children, sebutan = "kartu", ...sisa }: PropSusunan) {
  const penata = usePenataDasbor();
  const refWadah = useRef<HTMLDivElement | null>(null);
  const [menyeret, setMenyeret] = useState<string | null>(null);
  const [kabar, setKabar] = useState("");

  const anak = useMemo(
    () =>
      Children.toArray(children).filter(
        (x): x is React.ReactElement<PropItem> =>
          isValidElement(x) && typeof (x.props as PropItem)?.kunci === "string"
      ),
    [children]
  );

  const urutanTersimpan = penata?.susunan?.[zona];
  const tersusun = useMemo(
    () => terapkanUrutan(anak, (x) => x.props.kunci, urutanTersimpan),
    [anak, urutanTersimpan]
  );
  const kunciSekarang = useMemo(() => tersusun.map((x) => x.props.kunci), [tersusun]);

  // Seluruh keadaan seretan hidup di ref, bukan di state - lihat catatan kepala
  // berkas. Yang di state hanya kunci kartu yang sedang diangkat, untuk
  // memberinya kelas tampilan.
  const seret = useRef<{
    kunci: string;
    node: HTMLElement;
    indexAwal: number;
    indexTarget: number;
    mulaiX: number;
    mulaiY: number;
    sekarangX: number;
    sekarangY: number;
    kotak: DOMRect[];
    pointerId: number;
    aktif: boolean;
    tundaTahan: number | null;
    sempatGeser: boolean;
    bingkai: number | null;
  } | null>(null);

  const simpanUrutan = useCallback(
    (baru: string[]) => {
      penata?.simpanZona(zona, baru);
    },
    [penata, zona]
  );

  /** Elemen pembungkus tiap kartu, menurut kedudukannya sekarang. */
  const ambilNode = useCallback((): HTMLElement[] => {
    const wadah = refWadah.current;
    if (!wadah) return [];
    return Array.from(wadah.querySelectorAll<HTMLElement>("[data-kunci-geser]"));
  }, []);

  const bersihkanGaya = useCallback(() => {
    for (const node of ambilNode()) {
      node.style.transition = "";
      node.style.transform = "";
      node.style.zIndex = "";
      node.style.willChange = "";
      node.style.position = "";
      node.style.pointerEvents = "";
    }
  }, [ambilNode]);

  /**
   * Menggambar kedudukan sementara seluruh kartu.
   *
   * Kartu yang diseret mengikuti pointer; sisanya digeser ke KOTAK kedudukan
   * barunya - kotak yang sudah diukur, bukan dihitung dari lebar dan jarak.
   * Itu penting pada grid yang berpindah baris: kartu yang naik satu baris
   * berpindah pada dua sumbu sekaligus, dan perhitungan tangan akan meleset
   * persis pada kartu di ujung baris.
   */
  const gambarUlang = useCallback(() => {
    const s = seret.current;
    if (!s || !s.aktif) return;

    const node = ambilNode();
    const urutanBaru = pindahkan(kunciSekarang, s.indexAwal, s.indexTarget);

    for (let i = 0; i < node.length; i += 1) {
      const kunci = node[i].dataset.kunciGeser as string;
      if (kunci === s.kunci) continue;

      const kedudukanBaru = urutanBaru.indexOf(kunci);
      const dari = s.kotak[i];
      const ke = s.kotak[kedudukanBaru];
      if (!dari || !ke) continue;

      const dx = Math.round(ke.left - dari.left);
      const dy = Math.round(ke.top - dari.top);
      node[i].style.transform = dx === 0 && dy === 0 ? "" : `translate3d(${dx}px, ${dy}px, 0)`;
    }

    const dx = s.sekarangX - s.mulaiX;
    const dy = s.sekarangY - s.mulaiY;
    s.node.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(1.02)`;
  }, [ambilNode, kunciSekarang]);

  /** Kedudukan tujuan: kotak yang pusatnya paling dekat dengan kartu yang diseret. */
  const hitungTarget = useCallback(() => {
    const s = seret.current;
    if (!s) return 0;

    const asal = s.kotak[s.indexAwal];
    if (!asal) return s.indexTarget;

    const pusatX = asal.left + asal.width / 2 + (s.sekarangX - s.mulaiX);
    const pusatY = asal.top + asal.height / 2 + (s.sekarangY - s.mulaiY);

    let terbaik = s.indexTarget;
    let jarakTerbaik = Number.POSITIVE_INFINITY;
    for (let i = 0; i < s.kotak.length; i += 1) {
      const k = s.kotak[i];
      const dx = k.left + k.width / 2 - pusatX;
      const dy = k.top + k.height / 2 - pusatY;
      const jarak = dx * dx + dy * dy;
      if (jarak < jarakTerbaik) {
        jarakTerbaik = jarak;
        terbaik = i;
      }
    }

    // Ambang keengganan: tujuan hanya berpindah bila kotak baru benar-benar
    // lebih dekat. Tanpa ini, kartu yang berhenti persis di antara dua kotak
    // akan bertukar bolak-balik pada tiap piksel gerakan tangan.
    if (terbaik !== s.indexTarget) {
      const k = s.kotak[s.indexTarget];
      if (k) {
        const dx = k.left + k.width / 2 - pusatX;
        const dy = k.top + k.height / 2 - pusatY;
        if (dx * dx + dy * dy - jarakTerbaik < 8 * 8) return s.indexTarget;
      }
    }
    return terbaik;
  }, []);

  const mulaiSeret = useCallback(() => {
    const s = seret.current;
    if (!s || s.aktif) return;

    // ========================================================================
    // PENANGKAPAN POINTER DIPASANG DI SINI, BUKAN SAAT JARI MENYENTUH
    // ========================================================================
    //
    // setPointerCapture mengalihkan seluruh peristiwa pointer ke elemen yang
    // menangkap - TERMASUK peristiwa tetikus turunannya, dan termasuk `click`.
    // Bila ia dipasang pada pointerdown, klik biasa tidak pernah sampai ke
    // tautan di dalam kartu: kartu ringkasan berhenti membuka halamannya, dan
    // tidak ada galat apa pun yang muncul - kartunya sekadar tidak melakukan
    // apa-apa ketika ditekan.
    //
    // Dipasang di sini, ia hanya hidup selama seretan yang sungguh terjadi.
    try {
      s.node.setPointerCapture(s.pointerId);
    } catch {
      /* peramban tanpa penangkapan pointer tetap bekerja lewat peristiwa wadah */
    }

    const node = ambilNode();
    // Diukur sekali, di sini. Sesudah ini tidak ada lagi pembacaan tata letak
    // sampai seretannya selesai.
    s.kotak = node.map((n) => n.getBoundingClientRect());
    s.aktif = true;
    s.sempatGeser = true;

    s.node.style.position = "relative";
    s.node.style.zIndex = "50";
    s.node.style.willChange = "transform";
    s.node.style.transition = "none";
    s.node.style.pointerEvents = "none";

    for (const n of node) {
      if (n === s.node) continue;
      n.style.transition = "transform 180ms cubic-bezier(0.2, 0, 0, 1)";
      n.style.willChange = "transform";
    }

    document.body.style.userSelect = "none";
    setMenyeret(s.kunci);
    // Getar sekejap hanya pada perangkat yang punya - penanda bahwa kartunya
    // sudah terangkat, sebab jari menutupi kartunya sendiri.
    try {
      navigator.vibrate?.(8);
    } catch {
      /* peramban tanpa getar */
    }
    gambarUlang();
  }, [ambilNode, gambarUlang]);

  const selesaikan = useCallback(
    (batal: boolean) => {
      const s = seret.current;
      if (!s) return;

      if (s.tundaTahan !== null) window.clearTimeout(s.tundaTahan);
      if (s.bingkai !== null) cancelAnimationFrame(s.bingkai);
      document.body.style.userSelect = "";

      if (!s.aktif) {
        seret.current = null;
        return;
      }

      // Tujuan dihitung ULANG dari kedudukan pointer yang terakhir diketahui,
      // bukan diambil dari nilai yang ditinggalkan bingkai animasi terakhir.
      //
      // Bingkai yang masih tertunda dibatalkan tepat di atas, sehingga gerakan
      // terakhir sebelum jari diangkat bisa saja belum pernah diperhitungkan -
      // dan kartunya mendarat di tempat yang sudah dilewati. Selisihnya hanya
      // satu bingkai, tetapi tepat pada lepasan cepat: gerakan pendek ke kartu
      // sebelah justru yang paling sering tidak jadi apa-apa.
      const indexTujuan = batal ? s.indexAwal : hitungTarget();
      const asal = s.kotak[s.indexAwal];
      const tujuan = s.kotak[indexTujuan];

      // Kartunya diterbangkan ke kotak tujuannya dulu, baru urutannya
      // ditetapkan. Menetapkan urutan selagi kartunya masih di bawah jari
      // membuatnya melompat ke tempatnya seketika - benar, tetapi terbaca
      // seperti tersentak.
      if (asal && tujuan) {
        s.node.style.transition = "transform 180ms cubic-bezier(0.2, 0, 0, 1)";
        s.node.style.transform = `translate3d(${Math.round(tujuan.left - asal.left)}px, ${Math.round(
          tujuan.top - asal.top
        )}px, 0)`;
      }

      const kunciDiseret = s.kunci;
      const indexAwal = s.indexAwal;
      seret.current = null;

      window.setTimeout(() => {
        // Urutan DOM berubah ke susunan yang sudah terlihat di layar, dan
        // seluruh geseran sementara dilepas pada saat yang sama - sehingga
        // kartunya mendarat di piksel yang sama persis, tanpa kedipan.
        bersihkanGaya();
        setMenyeret(null);
        if (!batal && indexTujuan !== indexAwal) {
          const baru = pindahkan(kunciSekarang, indexAwal, indexTujuan);
          simpanUrutan(baru);
          setKabar(`${sebutan} dipindahkan ke urutan ${indexTujuan + 1} dari ${baru.length}.`);
        }
        void kunciDiseret;
      }, LAMA_JATUH_MD);
    },
    [bersihkanGaya, hitungTarget, kunciSekarang, sebutan, simpanUrutan]
  );

  const penanganGeser = useRef<{
    gerak: (e: PointerEvent) => void;
    lepas: (e: PointerEvent) => void;
    batal: () => void;
  }>({ gerak: () => {}, lepas: () => {}, batal: () => {} });

  /**
   * Memasang pendengar gerakan pada window, dan melepasnya sendiri saat usai.
   *
   * Dipasang pada sentuhan, bukan pada awal seretan: gerakan sebelum seretan
   * dimulai itulah yang memutuskan apakah ini seretan atau gulir halaman, dan
   * gerakan itu pun bisa keluar dari wadah.
   */
  const pasangPendengarWindow = useCallback(() => {
    const gerak = (e: PointerEvent) => penanganGeser.current.gerak(e);
    const lepaskan = () => {
      window.removeEventListener("pointermove", gerak, true);
      window.removeEventListener("pointerup", lepas, true);
      window.removeEventListener("pointercancel", batal, true);
    };
    const lepas = (e: PointerEvent) => {
      penanganGeser.current.lepas(e);
      lepaskan();
    };
    const batal = () => {
      penanganGeser.current.batal();
      lepaskan();
    };
    window.addEventListener("pointermove", gerak, true);
    window.addEventListener("pointerup", lepas, true);
    window.addEventListener("pointercancel", batal, true);
  }, []);

  const saatPointerDown = useCallback(
    (peristiwa: React.PointerEvent<HTMLDivElement>) => {
      if (!penata) return;
      if (peristiwa.button !== 0 && peristiwa.pointerType === "mouse") return;
      if (seret.current) return;

      const sasaran = (peristiwa.target as HTMLElement).closest<HTMLElement>("[data-kunci-geser]");
      if (!sasaran) return;

      // Isian dan tombol di dalam kartu tetap milik kartunya sendiri.
      const dalamKendali = (peristiwa.target as HTMLElement).closest(
        "input, textarea, select, [data-tanpa-geser]"
      );
      if (dalamKendali) return;

      const kunci = sasaran.dataset.kunciGeser as string;
      const indexAwal = kunciSekarang.indexOf(kunci);
      if (indexAwal < 0) return;

      seret.current = {
        kunci,
        node: sasaran,
        indexAwal,
        indexTarget: indexAwal,
        mulaiX: peristiwa.clientX,
        mulaiY: peristiwa.clientY,
        sekarangX: peristiwa.clientX,
        sekarangY: peristiwa.clientY,
        kotak: [],
        pointerId: peristiwa.pointerId,
        aktif: false,
        tundaTahan: null,
        sempatGeser: false,
        bingkai: null,
      };

      // Penangkapan pointer TIDAK dipasang di sini - lihat catatan di
      // mulaiSeret. Memasangnya sekarang mematikan tautan di dalam kartu.
      pasangPendengarWindow();

      // Jari menahan dulu supaya menggulir halaman tetap mungkin; tetikus
      // tidak punya kebingungan itu dan mulai begitu kursornya bergerak.
      if (peristiwa.pointerType !== "mouse") {
        seret.current.tundaTahan = window.setTimeout(mulaiSeret, TAHAN_SENTUH_MD);
      }
    },
    [kunciSekarang, mulaiSeret, pasangPendengarWindow, penata]
  );

  /**
   * ==========================================================================
   * GERAKAN DIDENGARKAN DI WINDOW, BUKAN DI WADAH
   * ==========================================================================
   *
   * Selama seretan, kartu yang diangkat dibuat pointer-events: none supaya
   * kotak di bawahnya tetap dapat dikenali. Akibatnya sasaran peristiwa
   * berpindah-pindah ke apa pun yang kebetulan ada di bawah kursor - dan
   * begitu kursor melewati sesuatu di LUAR wadah (celah tata letak, bilah
   * samping, tepi layar), peristiwanya tidak lagi merambat ke wadah.
   *
   * Gejalanya persis yang terlihat: seretan berhasil kadang-kadang. Kartu
   * berhenti mengikuti tangan di titik tertentu, lalu mendarat di tempat
   * terakhir yang sempat terbaca - sering kali tempatnya semula, sehingga
   * tampak seperti "tidak terjadi apa-apa".
   *
   * Window selalu menerima peristiwa pointer, ke mana pun kursornya pergi.
   */
  const saatPointerMove = useCallback(
    (peristiwa: PointerEvent | React.PointerEvent<HTMLDivElement>) => {
      const s = seret.current;
      if (!s || peristiwa.pointerId !== s.pointerId) return;

      s.sekarangX = peristiwa.clientX;
      s.sekarangY = peristiwa.clientY;
      const jauh = Math.hypot(s.sekarangX - s.mulaiX, s.sekarangY - s.mulaiY);

      if (!s.aktif) {
        if (peristiwa.pointerType === "mouse") {
          if (jauh > AMBANG_TETIKUS_PX) mulaiSeret();
        } else if (jauh > AMBANG_BATAL_SENTUH_PX && s.tundaTahan !== null) {
          // Jari bergerak sebelum tahannya selesai: itu gulir halaman, bukan
          // seretan kartu. Dilepaskan, dan halaman bergulir seperti biasa.
          window.clearTimeout(s.tundaTahan);
          s.tundaTahan = null;
          seret.current = null;
        }
        return;
      }

      peristiwa.preventDefault();

      // Peristiwa pointer datang lebih rapat daripada layar menggambar;
      // digabung ke satu bingkai supaya tidak ada pekerjaan yang terbuang.
      if (s.bingkai !== null) return;
      s.bingkai = requestAnimationFrame(() => {
        const kini = seret.current;
        if (!kini || !kini.aktif) return;
        kini.bingkai = null;
        const target = hitungTarget();
        if (target !== kini.indexTarget) kini.indexTarget = target;
        gambarUlang();
      });
    },
    [gambarUlang, hitungTarget, mulaiSeret]
  );

  const saatPointerUp = useCallback(
    (peristiwa: PointerEvent | React.PointerEvent<HTMLDivElement>) => {
      const s = seret.current;
      if (!s || peristiwa.pointerId !== s.pointerId) return;
      selesaikan(false);
    },
    [selesaikan]
  );

  // Penangan terbaru ditaruh di ref, supaya pendengar yang sudah terpasang
  // tetap memanggil yang benar walau komponennya menggambar ulang di tengah
  // seretan - dan supaya pendengarnya tidak perlu dipasang ulang tiap render.
  penanganGeser.current = { gerak: saatPointerMove, lepas: saatPointerUp, batal: () => selesaikan(true) };

  // Escape membatalkan seretan yang sedang berjalan - jalan keluar yang selalu
  // ada, termasuk ketika kartunya tersangkut di tempat yang tidak diinginkan.
  useEffect(() => {
    if (!menyeret) return;
    const saatTombol = (peristiwa: KeyboardEvent) => {
      if (peristiwa.key === "Escape") selesaikan(true);
    };
    window.addEventListener("keydown", saatTombol);
    return () => window.removeEventListener("keydown", saatTombol);
  }, [menyeret, selesaikan]);

  /** Klik yang mengikuti seretan ditahan; klik biasa diteruskan apa adanya. */
  const saatKlik = useCallback((peristiwa: React.MouseEvent<HTMLDivElement>) => {
    const wadah = refWadah.current;
    if (!wadah?.dataset.baruSajaGeser) return;
    peristiwa.preventDefault();
    peristiwa.stopPropagation();
    delete wadah.dataset.baruSajaGeser;
  }, []);

  useEffect(() => {
    const wadah = refWadah.current;
    if (!wadah) return;
    if (menyeret) {
      wadah.dataset.baruSajaGeser = "1";
      return;
    }
    // Ditahan sebentar sesudah lepas: peristiwa klik tiba setelah pointerup.
    const timer = window.setTimeout(() => {
      if (wadah.dataset.baruSajaGeser) delete wadah.dataset.baruSajaGeser;
    }, LAMA_JATUH_MD + 60);
    return () => window.clearTimeout(timer);
  }, [menyeret]);

  /** Pemindahan lewat papan ketik - satu kedudukan tiap tekan. */
  const pindahLewatTombol = useCallback(
    (kunci: string, arah: -1 | 1) => {
      const dari = kunciSekarang.indexOf(kunci);
      const ke = dari + arah;
      if (dari < 0 || ke < 0 || ke >= kunciSekarang.length) return;
      const baru = pindahkan(kunciSekarang, dari, ke);
      simpanUrutan(baru);
      setKabar(`${sebutan} dipindahkan ke urutan ${ke + 1} dari ${baru.length}.`);
    },
    [kunciSekarang, sebutan, simpanUrutan]
  );

  // Tanpa penyedia, kartunya digambar apa adanya - tanpa geser, tanpa pegangan.
  // Itu membuat komponen ini aman dipakai di halaman yang belum dibungkus.
  if (!penata) {
    return (
      <div ref={refWadah} className={className} {...sisa}>
        {tersusun.map((anakSatu) => (
          <div key={anakSatu.props.kunci} className={anakSatu.props.className}>
            {anakSatu.props.children}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      ref={refWadah}
      className={className}
      data-zona-geser={zona}
      data-menyeret={menyeret ? "1" : undefined}
      onPointerDown={saatPointerDown}
      onClickCapture={saatKlik}
      {...sisa}
    >
      {tersusun.map((anakSatu, i) => {
        const kunci = anakSatu.props.kunci;
        const diangkat = menyeret === kunci;
        return (
          <div
            key={kunci}
            data-kunci-geser={kunci}
            data-testid={`kartu-geser-${kunci}`}
            className={[
              "group/geser relative",
              // touch-action hanya dimatikan saat benar-benar menyeret; selama
              // tidak, menggulir halaman dengan jari tetap seperti biasa.
              menyeret ? "touch-none" : "",
              diangkat ? "cursor-grabbing" : "",
              anakSatu.props.className ?? "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {anakSatu.props.children}

            {/*
              Pegangan geser: penanda bahwa kartunya dapat dipindahkan, dan
              satu-satunya jalan bagi yang memakai papan ketik. Tanpa ini,
              kemampuan menyusun dasbor hanya diketahui orang yang kebetulan
              menahan kartunya cukup lama - dan tidak dapat dipakai sama sekali
              oleh yang tidak memakai tetikus.
            */}
            <button
              type="button"
              data-tanpa-geser
              aria-label={`Pindahkan ${sebutan} ${anakSatu.props.judul ?? kunci}. Panah kiri dan kanan memindahkan urutannya.`}
              className="absolute right-1.5 top-1.5 z-10 hidden rounded-md border border-border/70 bg-card/90 p-1 text-muted-foreground opacity-0 shadow-sm transition-opacity focus-visible:opacity-100 group-hover/geser:opacity-100 sm:block"
              onKeyDown={(peristiwa) => {
                const maju = peristiwa.key === "ArrowRight" || peristiwa.key === "ArrowDown";
                const mundur = peristiwa.key === "ArrowLeft" || peristiwa.key === "ArrowUp";
                if (!maju && !mundur) return;
                peristiwa.preventDefault();
                pindahLewatTombol(kunci, maju ? 1 : -1);
                // Fokus dipertahankan pada pegangan kartu yang sama supaya
                // panah berikutnya melanjutkan pemindahan, bukan memulai dari
                // kartu lain.
                const wadah = refWadah.current;
                window.setTimeout(() => {
                  wadah
                    ?.querySelector<HTMLButtonElement>(`[data-kunci-geser="${kunci}"] button[data-tanpa-geser]`)
                    ?.focus();
                }, 0);
              }}
            >
              <GripVertical className="h-3.5 w-3.5" aria-hidden />
            </button>

            <span className="sr-only">{`Urutan ${i + 1} dari ${tersusun.length}.`}</span>
          </div>
        );
      })}

      {/* Hasil pemindahan diucapkan pembaca layar; tanpa ini, memindahkan kartu
          lewat papan ketik tidak menghasilkan tanda apa pun yang terdengar. */}
      <span aria-live="polite" className="sr-only">
        {kabar}
      </span>
    </div>
  );
}
