"use client";

/**
 * Verifikasi dokumen e-Court lewat portal.
 *
 * ============================================================================
 * KENAPA ADA DUA JALUR
 * ============================================================================
 *
 * Menu WhatsApp bagus untuk hakim yang sedang di luar: satu dokumen, satu
 * keputusan, selesai. Tetapi hakim dengan tiga puluh perkara yang harus
 * membalas satu per satu akan menyerah di dokumen kelima.
 *
 * Halaman ini untuk keadaan itu: semua yang menunggu terlihat sekaligus.
 * Penjagaannya sama persis - hanya hakim yang duduk pada majelis perkara itu,
 * dan tetap dituntut konfirmasi kedua sebelum keputusan tersimpan.
 */

import { useCallback, useEffect, useState } from "react";

import { apiPath } from "@/lib/base-path";

type Dokumen = {
  documentKey: string;
  nomorPerkara: string;
  judulDokumen: string;
  peranPengunggah: string;
  diunggahPada: string | null;
  agenda: string;
  batasUnggahTeks: string;
  adaBerkas: boolean;
  sumberUrl: string | null;
};

type Daftar = {
  ok: boolean;
  alasan: string;
  hakim: { nama: string; jabatan: string } | null;
  dokumen: Dokumen[];
};

function formatTanggal(nilai: string | null): string {
  if (!nilai) return "-";
  const tanggal = new Date(nilai);
  if (Number.isNaN(tanggal.getTime())) return "-";
  return tanggal.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function VerifikasiDokumen() {
  const [daftar, setDaftar] = useState<Daftar | null>(null);
  const [pesan, setPesan] = useState("");
  const [memuat, setMemuat] = useState(true);
  // Dokumen yang sedang menunggu konfirmasi kedua, beserta keputusan yang dipilih.
  const [konfirmasi, setKonfirmasi] = useState<{ key: string; keputusan: "valid" | "tidak_valid" } | null>(null);
  const [sedangSimpan, setSedangSimpan] = useState(false);
  const [hasilTerakhir, setHasilTerakhir] = useState("");

  const muat = useCallback(async () => {
    setMemuat(true);
    try {
      const respons = await fetch(apiPath("/api/aleta-bot/verifikasi"), { cache: "no-store" });
      const hasil = await respons.json();
      const isi = hasil?.data ?? hasil;
      if (!isi?.available) {
        setPesan(isi?.message || "ALETA Bot belum dapat dihubungi.");
        setDaftar(null);
      } else if (!isi.daftar?.ok) {
        setPesan(
          isi.daftar?.alasan === "bukan_hakim_terdaftar"
            ? "Halaman ini hanya untuk hakim yang menangani perkara. Bila Anda hakim dan belum terdaftar, hubungi admin portal."
            : "Daftar belum dapat dibaca."
        );
        setDaftar(null);
      } else {
        setPesan("");
        setDaftar(isi.daftar);
      }
    } catch (error) {
      setPesan(error instanceof Error ? error.message : "Gagal memuat data.");
      setDaftar(null);
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void muat();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [muat]);

  const simpan = useCallback(
    async (documentKey: string, keputusan: "valid" | "tidak_valid") => {
      setSedangSimpan(true);
      setHasilTerakhir("");
      try {
        const respons = await fetch(apiPath("/api/aleta-bot/verifikasi"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // konfirmasi:true hanya dikirim dari sini - yaitu setelah tombol
          // kedua ditekan. Tombol pertama tidak pernah menyentuh jaringan.
          body: JSON.stringify({ documentKey, keputusan, konfirmasi: true }),
        });
        const hasil = await respons.json();
        const isi = hasil?.data ?? hasil;
        if (isi?.ok) {
          setHasilTerakhir(
            `Keputusan tersimpan: ${keputusan === "valid" ? "VALID" : "TIDAK VALID"} — ${isi.judulDokumen ?? ""}`
          );
          setKonfirmasi(null);
          await muat();
        } else {
          setHasilTerakhir(`Keputusan TIDAK tersimpan (${isi?.alasan ?? "tidak diketahui"}).`);
        }
      } catch (error) {
        setHasilTerakhir(error instanceof Error ? error.message : "Gagal menyimpan.");
      } finally {
        setSedangSimpan(false);
      }
    },
    [muat]
  );

  if (memuat) {
    return <div className="p-6 text-sm text-slate-600 dark:text-slate-300">Memuat daftar…</div>;
  }

  if (pesan) {
    return (
      <div className="m-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
        <p className="font-medium">{pesan}</p>
        <button
          type="button"
          onClick={() => void muat()}
          className="mt-3 rounded border border-amber-400 px-3 py-1 text-sm font-medium hover:bg-amber-100 dark:hover:bg-amber-900"
        >
          Coba lagi
        </button>
      </div>
    );
  }

  if (!daftar) return null;

  return (
    <div className="space-y-5 p-6">
      <header>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Verifikasi Dokumen e-Litigasi</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          {daftar.hakim?.nama} · hanya perkara yang Anda tangani
        </p>
        <p className="mt-2 rounded border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
          Keputusan tersimpan di ALETA lebih dulu. Status di e-Court belum berubah sampai petugas menjalankan
          penerusan.
        </p>
      </header>

      {hasilTerakhir ? (
        <p className="rounded border border-slate-300 bg-white p-3 text-sm dark:border-slate-600 dark:bg-slate-900">
          {hasilTerakhir}
        </p>
      ) : null}

      {daftar.dokumen.length === 0 ? (
        <p className="rounded-lg border border-slate-200 p-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          Tidak ada dokumen yang menunggu verifikasi pada perkara yang Anda tangani.
        </p>
      ) : (
        <ul className="space-y-3">
          {daftar.dokumen.map((item) => {
            const sedangKonfirmasi = konfirmasi?.key === item.documentKey;
            return (
              <li
                key={item.documentKey}
                className="rounded-lg border border-slate-200 p-4 dark:border-slate-700"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900 dark:text-slate-100">{item.judulDokumen}</p>
                    <p className="mt-1 font-mono text-xs text-slate-600 dark:text-slate-400">{item.nomorPerkara}</p>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                      Dari {item.peranPengunggah || "pihak"} · diunggah {formatTanggal(item.diunggahPada)}
                    </p>
                    {item.batasUnggahTeks ? (
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                        Batas unggah agenda: {item.batasUnggahTeks}
                      </p>
                    ) : null}
                    {!item.adaBerkas ? (
                      <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
                        Berkasnya belum terunduh. Mohon dibuka lewat e-Court sebelum memutuskan.
                      </p>
                    ) : null}
                  </div>

                  {item.sumberUrl ? (
                    <a
                      href={item.sumberUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="shrink-0 rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
                    >
                      Buka di e-Court
                    </a>
                  ) : null}
                </div>

                {sedangKonfirmasi ? (
                  <div className="mt-4 rounded border border-amber-400 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-950">
                    <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                      Simpan keputusan{" "}
                      <strong>{konfirmasi.keputusan === "valid" ? "VALID" : "TIDAK VALID"}</strong> untuk dokumen ini?
                    </p>
                    <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">
                      Pastikan Anda sudah membaca dokumennya.
                    </p>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        disabled={sedangSimpan}
                        onClick={() => void simpan(item.documentKey, konfirmasi.keputusan)}
                        className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
                      >
                        {sedangSimpan ? "Menyimpan…" : "Ya, simpan keputusan"}
                      </button>
                      <button
                        type="button"
                        disabled={sedangSimpan}
                        onClick={() => setKonfirmasi(null)}
                        className="rounded border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-slate-600"
                      >
                        Batal
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setKonfirmasi({ key: item.documentKey, keputusan: "valid" })}
                      className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
                    >
                      Valid
                    </button>
                    <button
                      type="button"
                      onClick={() => setKonfirmasi({ key: item.documentKey, keputusan: "tidak_valid" })}
                      className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
                    >
                      Tidak Valid
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
