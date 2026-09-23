"use client";

/**
 * ============================================================================
 * LAYAR ANTRIAN SIDANG - ALAMAT YANG DAPAT DIBUKA TANPA LOGIN
 * ============================================================================
 *
 * Diminta pengguna 23 September 2026: "buatkan link saja yang bisa langsung di
 * liat tanpa harus login untuk menampilkan antrian sidang".
 *
 * Bedanya dari /antrian-layar yang sudah ada: halaman ini menggambar sebanyak
 * yang DIIZINKAN pengaturan di admin ALETA, dan berhenti menggambar ruas yang
 * dimatikan. Yang lama tetap sebagaimana adanya - televisi ruang tunggu yang
 * sudah berjalan tidak boleh berubah karena pengaturan baru.
 *
 * ============================================================================
 * KOLOM YANG DIMATIKAN TIDAK DIGAMBAR, BUKAN DIGAMBAR KOSONG
 * ============================================================================
 *
 * Kolom kosong terbaca sebagai keterangan yang hilang - dan yang membacanya
 * akan mengira datanya bermasalah. Kolom yang tidak ada terbaca sebagai
 * keterangan yang memang tidak ditampilkan.
 */

import { useCallback, useEffect, useState } from "react";

import { apiPath } from "@/lib/base-path";
import { type TampilAntrianPublik } from "@/lib/antrian-publik";

type Baris = {
  nomor?: number | null;
  noRuang?: number | null;
  keadaan?: string;
  jamPanggil?: string;
  menitMenunggu?: number | null;
  nomorPerkara?: string;
  pihak?: string;
  agenda?: string;
  majelis?: string;
};

/** Sekitar satu kali per sepuluh detik - cukup rapat bagi layar ruang tunggu. */
const JEDA_MUAT_MS = 10_000;

export default function HalamanAntrianTampil() {
  const [baris, setBaris] = useState<Baris[]>([]);
  const [tampil, setTampil] = useState<TampilAntrianPublik>({});
  const [judul, setJudul] = useState("");
  const [pesan, setPesan] = useState("");
  const [jam, setJam] = useState("");

  const muat = useCallback(async () => {
    try {
      const ruang =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("ruang") || ""
          : "";
      const alamat = apiPath(`/api/antrian-tampil${ruang ? `?ruang=${encodeURIComponent(ruang)}` : ""}`);
      const r = await fetch(alamat, { cache: "no-store" });
      const isi = (await r.json()) as {
        data?: {
          available?: boolean;
          terbaca?: boolean;
          message?: string;
          judul?: string;
          tampil?: TampilAntrianPublik;
          baris?: Baris[];
        };
      };
      const hasil = isi.data ?? {};
      setTampil(hasil.tampil ?? {});
      setJudul(hasil.judul ?? "");
      // Daftar kosong karena jaringan tersendat TIDAK boleh terlihat sama
      // dengan daftar kosong karena tidak ada yang mengantre.
      // ==================================================================
      // MESIN ANTRIAN MATI BUKAN "BELUM ADA YANG MENGAMBIL NOMOR"
      // ==================================================================
      //
      // Bot menelan kegagalan sambungan ke mesin antrian dan tetap menjawab
      // available:true dengan daftar kosong, hanya terbaca:false. Layar yang
      // hanya membaca available akan berbunyi "belum ada yang mengambil nomor
      // antrian hari ini" - kalimat yang menenangkan, dan salah: orang di
      // ruang tunggu sudah mengambil nomor, hanya mesinnya yang tidak
      // terbaca. Mereka akan menunggu giliran yang tidak pernah tergambar.
      if (hasil.available === false) {
        setPesan(hasil.message || "Antrian belum dapat dibaca.");
      } else if (hasil.terbaca === false) {
        setPesan("Mesin antrian belum dapat dibaca - tanyakan giliran Anda kepada petugas.");
        setBaris([]);
      } else {
        setPesan("");
        setBaris(Array.isArray(hasil.baris) ? hasil.baris : []);
      }
    } catch {
      setPesan("Antrian belum dapat dibaca.");
    }
  }, []);

  // Pemuatan pertama ditunda satu putaran, bukan dipanggil serentak di dalam
  // efek: setState serentak memicu penggambaran berantai, dan aturan lint
  // repositori ini menolaknya.
  useEffect(() => {
    const pertama = window.setTimeout(() => void muat(), 0);
    const jamId = window.setInterval(() => void muat(), JEDA_MUAT_MS);
    return () => {
      window.clearTimeout(pertama);
      window.clearInterval(jamId);
    };
  }, [muat]);

  useEffect(() => {
    const perbarui = () => {
      const n = new Date();
      setJam(
        `${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`
      );
    };
    const pertama = window.setTimeout(perbarui, 0);
    const id = window.setInterval(perbarui, 30_000);
    return () => {
      window.clearTimeout(pertama);
      window.clearInterval(id);
    };
  }, []);

  const SEMUA_KOLOM: Array<{ kunci: keyof Baris; label: string; izin: string }> = [
    { kunci: "nomor", label: "No", izin: "nomorAntrian" },
    { kunci: "noRuang", label: "Ruang", izin: "noRuang" },
    { kunci: "nomorPerkara", label: "Perkara", izin: "nomorPerkara" },
    { kunci: "pihak", label: "Para pihak", izin: "namaPihak" },
    { kunci: "agenda", label: "Agenda", izin: "agenda" },
    { kunci: "majelis", label: "Majelis", izin: "majelis" },
    { kunci: "keadaan", label: "Keadaan", izin: "keadaan" },
    { kunci: "jamPanggil", label: "Dipanggil", izin: "jamPanggil" },
    { kunci: "menitMenunggu", label: "Menunggu", izin: "menitMenunggu" },
  ];
  const kolom = SEMUA_KOLOM.filter((k) => tampil[k.izin]);

  return (
    <main className="min-h-screen bg-neutral-950 p-4 text-neutral-100 sm:p-8">
      <header className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold sm:text-4xl">{judul || "Antrian Sidang"}</h1>
        <span className="text-xl tabular-nums text-neutral-400 sm:text-3xl">{jam}</span>
      </header>

      {pesan ? (
        <p className="rounded border border-neutral-700 bg-neutral-900 p-4 text-lg text-neutral-300">
          {pesan}
        </p>
      ) : kolom.length === 0 ? (
        <p className="rounded border border-neutral-700 bg-neutral-900 p-4 text-lg text-neutral-300">
          Tidak ada keterangan yang diizinkan tampil pada alamat ini.
        </p>
      ) : baris.length === 0 ? (
        <p className="rounded border border-neutral-700 bg-neutral-900 p-4 text-lg text-neutral-300">
          Belum ada yang mengambil nomor antrian hari ini.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-neutral-700 text-sm uppercase tracking-wide text-neutral-400">
                {kolom.map((k) => (
                  <th key={String(k.kunci)} className="px-3 py-2 font-medium">
                    {k.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {baris.map((b, i) => (
                <tr
                  key={`${b.nomor ?? i}-${b.noRuang ?? ""}`}
                  className={
                    b.keadaan === "dipanggil"
                      ? "border-b border-neutral-800 bg-emerald-950/40"
                      : "border-b border-neutral-800"
                  }
                >
                  {kolom.map((k) => (
                    <td
                      key={String(k.kunci)}
                      className={
                        k.kunci === "nomor"
                          ? "px-3 py-3 text-2xl font-bold tabular-nums sm:text-4xl"
                          : "px-3 py-3 text-base sm:text-xl"
                      }
                    >
                      {k.kunci === "menitMenunggu"
                        ? b.menitMenunggu === null || b.menitMenunggu === undefined
                          ? "—"
                          : `${b.menitMenunggu} mnt`
                        : (b[k.kunci] as string | number | null | undefined) || "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
