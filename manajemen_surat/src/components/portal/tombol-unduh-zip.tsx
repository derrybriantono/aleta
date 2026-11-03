"use client";

/**
 * ============================================================================
 * SELURUH BERKAS SATU PERKARA, DALAM SATU TEKAN
 * ============================================================================
 *
 * Majelis yang menyiapkan sidang memerlukan seluruh berkas, bukan satu per
 * satu. ZIP disusun di peladen dari berkas yang SUDAH tersimpan - e-Court
 * tidak disentuh sama sekali oleh tombol ini.
 *
 * Dipindahkan ke berkas sendiri pada 23 September 2026 supaya layar Sidang
 * dan layar Status Perkara dapat memakainya juga. Sebelumnya ia terkurung di
 * panel Arsip e-Court, dan karena panel itu hanya menampilkan perkara yang
 * punya berkas e-Court, perkara yang berkasnya hanya ada di SIPP tidak pernah
 * ditawari ZIP sama sekali - padahal relaas, berita acara, dan putusannya
 * tersimpan lengkap.
 *
 * ============================================================================
 * SEJAK 25 SEPTEMBER 2026: isi="lengkap"
 * ============================================================================
 *
 * Dengan isi="lengkap" yang turun bukan hanya berkasnya, melainkan seluruh
 * DATA perkaranya juga - JSON apa adanya beserta delapan belas tabel CSV.
 * Itulah yang dipakai layar Status Perkara. Bawaannya tetap "berkas" supaya
 * panel Antrian Sidang dan Arsip berkas tidak berubah sedikit pun.
 *
 * ============================================================================
 * SEJAK 6 OKTOBER 2026: UNDUHAN BIASA PERAMBAN, BUKAN fetch + blob (butir 25)
 * ============================================================================
 *
 * Tombol ini dulu memanggil fetch() lalu menunggu seluruh ZIP sebagai blob.
 * Untuk 445/Pdt.G/2026/PA.Dgl (25,8 MB) jawabannya terpotong di 11-13 MB enam
 * kali berturut-turut dan yang tampil hanya "Failed to fetch" - lihat
 * src/lib/unduh-alir.ts untuk ukurannya. Sekarang alamatnya dibuka sebagai
 * unduhan biasa (mulaiUnduhAlir) dan rutenya mengalirkan ZIP sepotong demi
 * sepotong. Bila tetap gagal, sebabnya disebutkan dan unduhan PER BAGIAN
 * ditawarkan - SIPP dan e-Court terpisah, masing-masing lebih kecil.
 *
 * Tulisannya "Unduh seluruh berkas" sejak butir 25 - permintaan pengguna.
 *
 * ============================================================================
 * SEJAK 2 NOVEMBER 2026: LEWAT EKSTENSI ALETA BILA ADA (mulaiUnduhAman)
 * ============================================================================
 *
 * Unduhan bingkai lahir dari halaman http dan ditahan Chrome ("Insecure
 * download blocked", 273/Pdt.G/2026/PA.Dgl). Dengan ekstensi terpasang,
 * ekstensi yang mengambil dan menyimpan ZIP-nya (src/lib/unduh-ekstensi.ts):
 * tombol menampilkan kemajuan MB, dan sesudah tersimpan nama berkasnya.
 * Tanpa ekstensi jalannya tetap bingkai seperti di atas, ditambah petunjuk.
 */

import { useState } from "react";

import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { apiPath } from "@/lib/base-path";
import { mulaiUnduhAman, type HasilUnduhAman } from "@/lib/unduh-alir";
import { formatMb, teksKemajuanUnduh } from "@/lib/unduh-ekstensi";
/* === STATUS-ZIP 12 Okt === */
import {
  KATEGORI_ARSIP,
  KATEGORI_SEMUA,
  LABEL_KATEGORI_ARSIP,
  type KategoriArsip,
} from "@/lib/kategori-zip";
/* === AKHIR STATUS-ZIP === */

/** Sumber berkas yang dikemas. Bawaannya keduanya. */
export type SumberZip = "semua" | "sipp" | "ecourt";

/** Apa yang dikemas: berkasnya saja, atau berkas + seluruh data SIPP. */
export type IsiZip = "berkas" | "lengkap";

/** Tulisan tombol isi="lengkap" (butir 25, 6 Okt 2026). */
export const LABEL_UNDUH_SELURUH = "Unduh seluruh berkas";

/** Alamat rute ZIP - satu tempat, dipakai tombol utama dan unduhan per bagian. */
export function alamatZipPerkara(pilihan: {
  nomorPerkara: string;
  sumber: SumberZip;
  isi: IsiZip;
  arsipFisik?: boolean;
  /** Hanya kategori ini yang dikemas (butir 11, 12 Okt 2026). Kosong/tidak disebut = seluruhnya. */
  kategori?: readonly KategoriArsip[];
}) {
  const params = new URLSearchParams({ nomor: pilihan.nomorPerkara, sumber: pilihan.sumber, isi: pilihan.isi });
  if (pilihan.isi === "lengkap" && pilihan.arsipFisik) params.set("arsipFisik", "1");
  if (pilihan.kategori && pilihan.kategori.length > 0) params.set("kategori", pilihan.kategori.join(","));
  return apiPath(`/api/aleta-ecourt/berkas-zip?${params.toString()}`);
}

export function TombolUnduhZip({
  nomorPerkara,
  sumber = "semua",
  isi = "berkas",
  label,
  ukuran = "sm",
  menu = false,
}: {
  nomorPerkara: string;
  sumber?: SumberZip;
  isi?: IsiZip;
  label?: string;
  ukuran?: "sm" | "default";
  /**
   * Status Perkara (rancangan 3 Nov 2026): pilihan tambahan - sertakan pindaian
   * arsip dan "Pilih isi unduhan" - masuk ke menu kecil di samping tombol utama,
   * tidak berdiri sebagai dua baris di kepala perkara. Fungsinya sama persis.
   */
  menu?: boolean;
}) {
  const [menuBuka, setMenuBuka] = useState(false);
  /** Bagian yang sedang menunggu kabar mulai unduh ("utama", "sipp", "ecourt"). */
  const [sibuk, setSibuk] = useState<"" | "utama" | "sipp" | "ecourt">("");
  const [catatan, setCatatan] = useState("");
  /** Keterangan bukan-galat: nama berkas yang tersimpan, atau petunjuk bila Chrome menahan unduhan. */
  const [info, setInfo] = useState("");
  /** Tulisan tombol selama ekstensi mengunduh ("Mengunduh 12,3 MB…"). */
  const [kemajuan, setKemajuan] = useState("");
  /** Sudah pernah dimulai - jalan per bagian ditawarkan sebagai cadangan. */
  const [pernahMulai, setPernahMulai] = useState(false);
  /**
   * Berkas pindaian arsip fisik ikut atau tidak.
   *
   * DIPILIH, bukan diputuskan sendiri: arsip perkara terukur 2 MB sampai 28 MB
   * sebuah, dan selisih itulah yang menentukan apakah seseorang mengunduhnya
   * sekarang atau menunggu - pertanyaan tentang jaringannya, bukan tentang
   * datanya. Bawaannya MATI supaya tekanan pertama tidak pernah berubah jadi
   * tiga puluh megabita tanpa diminta.
   */
  const [arsipFisik, setArsipFisik] = useState(false);

  /** Satu jalan untuk semua tombol: ekstensi bila ada, bingkai bila tidak. */
  const jalankan = async (alamat: string) => {
    setCatatan("");
    setInfo("");
    setKemajuan("");
    try {
      const hasil: HasilUnduhAman = await mulaiUnduhAman(alamat, { onKabar: (k) => setKemajuan(teksKemajuanUnduh(k)) });
      if (hasil.ok) {
        setPernahMulai(true);
        if (hasil.lewat === "ekstensi") {
          setInfo(
            hasil.berjalan
              ? `Ekstensi ALETA sedang menyimpan ${hasil.nama} - lihat bilah unduhan Chrome.`
              : `Tersimpan lewat ekstensi ALETA: ${hasil.nama}${hasil.ukuran ? ` (${formatMb(hasil.ukuran)})` : ""}.`
          );
        } else {
          setInfo(hasil.petunjuk);
        }
      } else {
        setCatatan(hasil.pesan);
      }
    } catch (kesalahan) {
      setCatatan(kesalahan instanceof Error ? kesalahan.message : "Unduhan ZIP tidak dapat dimulai.");
    } finally {
      setKemajuan("");
      setSibuk("");
    }
  };

  /* === STATUS-ZIP 12 Okt === */
  /**
   * Pilihan isi unduhan (butir 11): BAS saja, relaas saja, e-Court dan
   * lainnya. Tombol "Unduh seluruh berkas" tetap satu tekan seperti sebelumnya;
   * pilihan ini panel tambahan di bawahnya, bukan penggantinya.
   */
  const [panelPilih, setPanelPilih] = useState(false);
  const [terpilih, setTerpilih] = useState<readonly KategoriArsip[]>(KATEGORI_SEMUA);
  const semuaTerpilih = KATEGORI_SEMUA.every((k) => terpilih.includes(k));
  const alihkan = (k: KategoriArsip) =>
    setTerpilih((sekarang) => (sekarang.includes(k) ? sekarang.filter((x) => x !== k) : [...sekarang, k]));
  const unduhPilihan = async () => {
    if (terpilih.length === 0) {
      setCatatan("Pilih sedikitnya satu isi yang akan diunduh.");
      return;
    }
    setSibuk("utama");
    await jalankan(
      // Urutan baku (sama dengan folder 00-08), bukan urutan mencentang.
      alamatZipPerkara({ nomorPerkara, sumber, isi: "lengkap", kategori: KATEGORI_ARSIP.filter((k) => terpilih.includes(k)) })
    );
  };
  /* === AKHIR STATUS-ZIP === */

  const unduh = async (bagian: "utama" | "sipp" | "ecourt") => {
    setSibuk(bagian);
    // Per bagian: SIPP membawa data + berkas SIPP (+ arsip fisik bila
      // dicentang); e-Court hanya berkas e-Court. Keduanya lebih kecil
      // daripada ZIP seluruhnya.
    const alamat =
      bagian === "utama"
        ? alamatZipPerkara({ nomorPerkara, sumber, isi, arsipFisik })
        : bagian === "sipp"
          ? alamatZipPerkara({ nomorPerkara, sumber: "sipp", isi, arsipFisik })
          : alamatZipPerkara({ nomorPerkara, sumber: "ecourt", isi: "berkas" });
    await jalankan(alamat);
  };

  const judul =
    label ||
    (isi === "lengkap"
      ? LABEL_UNDUH_SELURUH
      : sumber === "ecourt"
        ? "Unduh ZIP e-Court"
        : sumber === "sipp"
          ? "Unduh ZIP SIPP"
          : "Unduh semua berkas");

  // 6 Okt 2026: TETAP SATU ZIP (permintaan pengguna) - tautan "unduh per
  // bagian" yang sempat ditawarkan sesudah gagal/mulai dibuang. Jalur per
  // sumber (unduh("sipp"/"ecourt")) tetap ada di kode, tidak digambar.
  void pernahMulai;

  const tambahan = (
    <>
      {isi === "lengkap" ? (
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={arsipFisik}
            disabled={Boolean(sibuk)}
            onChange={(e) => setArsipFisik(e.target.checked)}
          />
          Sertakan berkas pindaian arsip (2–28 MB)
        </label>
      ) : null}
      {/* === STATUS-ZIP 12 Okt === */}
      {isi === "lengkap" ? (
        <div className="space-y-1">
          <button
            type="button"
            className="text-xs text-primary underline underline-offset-2"
            aria-expanded={panelPilih}
            data-bagian="buka-pilihan-unduh-zip"
            onClick={() => setPanelPilih((x) => !x)}
          >
            {panelPilih ? "Tutup pilihan isi" : "Pilih isi unduhan (BAS saja, relaas saja, e-Court, dll.)"}
          </button>
          {panelPilih ? (
            <fieldset
              className="max-w-[24rem] space-y-1 rounded-md border border-border p-2 text-xs"
              data-bagian="pilihan-unduh-zip"
            >
              <legend className="px-1 font-medium">Isi ZIP yang diunduh</legend>
              <label className="flex items-center gap-1.5 font-medium">
                <input
                  type="checkbox"
                  checked={semuaTerpilih}
                  disabled={Boolean(sibuk)}
                  onChange={(e) =>
                    setTerpilih((sekarang) =>
                      e.target.checked
                        ? [...new Set([...sekarang, ...KATEGORI_SEMUA])]
                        : sekarang.filter((k) => !KATEGORI_SEMUA.includes(k))
                    )
                  }
                />
                Semua (kecuali arsip fisik)
              </label>
              {KATEGORI_ARSIP.map((k) => (
                <label key={k} className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={terpilih.includes(k)}
                    disabled={Boolean(sibuk)}
                    onChange={() => alihkan(k)}
                  />
                  {LABEL_KATEGORI_ARSIP[k]}
                </label>
              ))}
              <Button
                size="sm"
                variant="outline"
                disabled={Boolean(sibuk) || terpilih.length === 0}
                onClick={() => void unduhPilihan()}
              >
                {sibuk === "utama" ? kemajuan || "Menyusun…" : "Unduh yang dipilih"}
              </Button>
              <p className="text-muted-foreground">
                Berkas yang tercatat tetapi gagal diambil disebut beserta sebabnya di DAFTAR ISI.csv dan KETERANGAN.txt
                di dalam ZIP.
              </p>
            </fieldset>
          ) : null}
        </div>
      ) : null}
      {/* === AKHIR STATUS-ZIP === */}
    </>
  );
  const tombolUtama = (
    <Button size={ukuran} variant="outline" disabled={Boolean(sibuk)} onClick={() => void unduh("utama")}>
        {sibuk === "utama" ? kemajuan || "Menyusun…" : judul}
    </Button>
  );

  return (
    <div className={menu ? "relative" : "space-y-1"}>
      {menu ? (
        <div className="inline-flex">
          {tombolUtama}
          {isi === "lengkap" ? (
            <Button
              size={ukuran}
              variant="outline"
              className="-ml-px rounded-l-none px-2"
              aria-label="Pilihan unduhan"
              aria-expanded={menuBuka}
              onClick={() => setMenuBuka((x) => !x)}
            >
              <ChevronDown className="h-3.5 w-3.5" aria-hidden />
            </Button>
          ) : null}
        </div>
      ) : (
        tombolUtama
      )}
      {menu ? (
        menuBuka ? (
          <div className="absolute left-0 top-full z-30 mt-1.5 w-80 max-w-[calc(100vw-2rem)] space-y-1.5 rounded-lg border border-border bg-card p-2.5 shadow-xl">
            {tambahan}
          </div>
        ) : null
      ) : (
        tambahan
      )}      {info ? (
        <p className="max-w-[24rem] text-xs text-muted-foreground" role="status" data-bagian="info-unduh-zip">
          {info}
        </p>
      ) : null}
      {catatan ? (
        <p className="max-w-[20rem] text-xs text-rose-700 dark:text-rose-300" role="alert" data-bagian="galat-unduh-zip">
          {catatan}
        </p>
      ) : null}
    </div>
  );
}
