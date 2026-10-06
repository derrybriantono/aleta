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
 */

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { apiPath } from "@/lib/base-path";
import { mulaiUnduhAlir } from "@/lib/unduh-alir";

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
}) {
  const params = new URLSearchParams({ nomor: pilihan.nomorPerkara, sumber: pilihan.sumber, isi: pilihan.isi });
  if (pilihan.isi === "lengkap" && pilihan.arsipFisik) params.set("arsipFisik", "1");
  return apiPath(`/api/aleta-ecourt/berkas-zip?${params.toString()}`);
}

export function TombolUnduhZip({
  nomorPerkara,
  sumber = "semua",
  isi = "berkas",
  label,
  ukuran = "sm",
}: {
  nomorPerkara: string;
  sumber?: SumberZip;
  isi?: IsiZip;
  label?: string;
  ukuran?: "sm" | "default";
}) {
  /** Bagian yang sedang menunggu kabar mulai unduh ("utama", "sipp", "ecourt"). */
  const [sibuk, setSibuk] = useState<"" | "utama" | "sipp" | "ecourt">("");
  const [catatan, setCatatan] = useState("");
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

  const unduh = async (bagian: "utama" | "sipp" | "ecourt") => {
    setSibuk(bagian);
    setCatatan("");
    try {
      // Per bagian: SIPP membawa data + berkas SIPP (+ arsip fisik bila
      // dicentang); e-Court hanya berkas e-Court. Keduanya lebih kecil
      // daripada ZIP seluruhnya.
      const alamat =
        bagian === "utama"
          ? alamatZipPerkara({ nomorPerkara, sumber, isi, arsipFisik })
          : bagian === "sipp"
            ? alamatZipPerkara({ nomorPerkara, sumber: "sipp", isi, arsipFisik })
            : alamatZipPerkara({ nomorPerkara, sumber: "ecourt", isi: "berkas" });
      const hasil = await mulaiUnduhAlir(alamat);
      if (hasil.ok) setPernahMulai(true);
      else setCatatan(hasil.pesan);
    } catch (kesalahan) {
      setCatatan(kesalahan instanceof Error ? kesalahan.message : "Unduhan ZIP tidak dapat dimulai.");
    } finally {
      setSibuk("");
    }
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

  return (
    <div className="space-y-1">
      <Button size={ukuran} variant="outline" disabled={Boolean(sibuk)} onClick={() => void unduh("utama")}>
        {sibuk === "utama" ? "Menyusun…" : judul}
      </Button>
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
      {catatan ? (
        <p className="max-w-[20rem] text-xs text-rose-700 dark:text-rose-300" role="alert" data-bagian="galat-unduh-zip">
          {catatan}
        </p>
      ) : null}
    </div>
  );
}
