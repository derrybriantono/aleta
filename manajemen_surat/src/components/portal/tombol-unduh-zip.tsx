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
 */

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { apiPath } from "@/lib/base-path";
import { pesanGalatPortal } from "@/lib/pesan-galat-portal";

/** Sumber berkas yang dikemas. Bawaannya keduanya. */
export type SumberZip = "semua" | "sipp" | "ecourt";

export function TombolUnduhZip({
  nomorPerkara,
  sumber = "semua",
  label,
  ukuran = "sm",
}: {
  nomorPerkara: string;
  sumber?: SumberZip;
  label?: string;
  ukuran?: "sm" | "default";
}) {
  const [sibuk, setSibuk] = useState(false);
  const [catatan, setCatatan] = useState("");

  const unduh = async () => {
    setSibuk(true);
    setCatatan("");
    try {
      const params = new URLSearchParams({ nomor: nomorPerkara, sumber });
      const respons = await fetch(apiPath(`/api/aleta-ecourt/berkas-zip?${params.toString()}`), {
        cache: "no-store",
      });

      const tipe = respons.headers.get("content-type") || "";
      if (!respons.ok || tipe.includes("application/json")) {
        const isi = await respons.json().catch(() => null);
        setCatatan(pesanGalatPortal(isi, `HTTP ${respons.status}`).replace(/_/g, " "));
        return;
      }

      const blob = await respons.blob();
      if (blob.size === 0) {
        setCatatan("ZIP-nya kosong.");
        return;
      }

      const alamat = URL.createObjectURL(blob);
      const tautan = document.createElement("a");
      tautan.href = alamat;

      const disposisi = respons.headers.get("content-disposition") || "";
      const cocok = disposisi.match(/filename\*?=(?:UTF-8''|")?([^";]+)/i);
      tautan.download = cocok
        ? decodeURIComponent(cocok[1])
        : `berkas-${nomorPerkara.replace(/[^\w.-]+/g, "-")}.zip`;

      document.body.appendChild(tautan);
      tautan.click();
      tautan.remove();
      window.setTimeout(() => URL.revokeObjectURL(alamat), 60000);
    } catch (kesalahan) {
      setCatatan(kesalahan instanceof Error ? kesalahan.message : "Gagal mengunduh ZIP.");
    } finally {
      setSibuk(false);
    }
  };

  const judul =
    label ||
    (sumber === "ecourt" ? "Unduh ZIP e-Court" : sumber === "sipp" ? "Unduh ZIP SIPP" : "Unduh semua berkas");

  return (
    <div className="space-y-1">
      <Button size={ukuran} variant="outline" disabled={sibuk} onClick={() => void unduh()}>
        {sibuk ? "Menyusun…" : judul}
      </Button>
      {catatan ? <p className="max-w-[18rem] text-xs text-muted-foreground">{catatan}</p> : null}
    </div>
  );
}
