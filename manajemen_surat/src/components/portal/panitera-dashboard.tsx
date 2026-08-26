"use client";

/**
 * Ringkasan kerja panitera pengganti.
 *
 * Menjawab tiga pertanyaan yang ditanyakan tiap pagi:
 *   1. Dokumen apa yang menunggu diverifikasi majelis?
 *   2. Perkara mana yang tenggatnya dekat atau sudah lewat?
 *   3. Nomor siapa yang salah dan perlu diperbaiki datanya?
 *
 * HANYA MEMBACA. Tidak ada tombol yang mengubah apa pun di sini - keputusan
 * verifikasi tetap di tangan hakim lewat menu WhatsApp-nya sendiri.
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
  sisaHari: number | null;
  mendesak: boolean;
};

type Tenggat = {
  nomorPerkara: string;
  judulDokumen: string;
  agenda: string;
  batasUnggahTeks: string;
  statusVerifikasi: string;
  sudahDiberitahukan: boolean;
  sisaHari: number | null;
};

type Nomor = {
  nomor: string;
  namaPihak: string;
  dijawabPada?: string | null;
  ditanyaPada?: string | null;
  jumlahDitanya?: number;
};

type Dashboard = {
  ambangMendesakHari: number;
  dibuatPada: string;
  ringkasan: {
    menungguVerifikasi: number;
    tenggatMendesak: number;
    tenggatLewat: number;
    nomorSalahAlamat: number;
    nomorBelumMenjawab: number;
  };
  menungguVerifikasi: Dokumen[];
  tenggat: Tenggat[];
  nomorSalahAlamat: Nomor[];
  nomorBelumMenjawab: Nomor[];
};

function formatTanggal(nilai: string | null | undefined): string {
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

/** Keterangan sisa hari, dengan tenggat lewat dinyatakan tegas. */
function keteranganSisa(sisaHari: number | null): { teks: string; nada: "lewat" | "mendesak" | "aman" } {
  if (sisaHari === null) return { teks: "tanpa tenggat", nada: "aman" };
  if (sisaHari < 0) return { teks: `lewat ${Math.abs(sisaHari)} hari`, nada: "lewat" };
  if (sisaHari === 0) return { teks: "hari ini", nada: "mendesak" };
  if (sisaHari <= 3) return { teks: `${sisaHari} hari lagi`, nada: "mendesak" };
  return { teks: `${sisaHari} hari lagi`, nada: "aman" };
}

function KartuAngka({ label, nilai, nada }: { label: string; nilai: number; nada: "lewat" | "mendesak" | "netral" }) {
  const warna =
    nada === "lewat"
      ? "border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-100"
      : nada === "mendesak"
        ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
        : "border-slate-200 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";

  return (
    <div className={`rounded-lg border p-4 ${warna}`}>
      <div className="text-2xl font-semibold tabular-nums">{nilai}</div>
      <div className="mt-1 text-sm opacity-80">{label}</div>
    </div>
  );
}

export function PaniteraDashboard() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [pesan, setPesan] = useState("");
  const [memuat, setMemuat] = useState(true);
  const [melepas, setMelepas] = useState("");
  const [catatan, setCatatan] = useState("");

  const muat = useCallback(async () => {
    setMemuat(true);
    try {
      const respons = await fetch(apiPath("/api/aleta-bot/panitera"), { cache: "no-store" });
      const hasil = await respons.json();
      const isi = hasil?.data ?? hasil;
      if (!isi?.available) {
        setPesan(isi?.message || "ALETA Bot belum dapat dihubungi.");
        setData(null);
      } else {
        setPesan("");
        setData(isi.dashboard);
      }
    } catch (error) {
      setPesan(error instanceof Error ? error.message : "Gagal memuat data.");
      setData(null);
    } finally {
      setMemuat(false);
    }
  }, []);

  // Pemuatan ditunda satu putaran, mengikuti pola yang sudah dipakai
  // aleta-bot-dashboard: memanggil setState langsung di dalam effect membuat
  // render pertama menulis state sebelum komponennya benar-benar terpasang.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void muat();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [muat]);

  /**
   * Melepas nomor yang pernah dijawab BUKAN agar ditanya ulang.
   *
   * TIDAK langsung mengizinkan pengiriman: pemiliknya ditanya sekali lagi, dan
   * tetap dialah yang menentukan. Petugas hanya membuka kesempatan bertanya,
   * bukan memutuskan atas nama pemilik nomor.
   */
  const tanyaUlang = useCallback(
    async (nomor: string, namaPihak: string) => {
      setMelepas(nomor);
      setCatatan("");
      try {
        const respons = await fetch(apiPath("/api/aleta-bot/ecourt/pengaturan"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ aksi: "tanya-ulang-nomor", nomor, namaPihak }),
        });
        const hasil = await respons.json();
        const isi = hasil?.data ?? hasil;
        if (isi?.ok) {
          setCatatan(`Nomor ${nomor} akan ditanya ulang pada putaran berikutnya.`);
          await muat();
        } else {
          setCatatan(`Gagal melepas nomor ${nomor} (${isi?.alasan ?? "tidak diketahui"}).`);
        }
      } catch (error) {
        setCatatan(error instanceof Error ? error.message : "Gagal melepas nomor.");
      } finally {
        setMelepas("");
      }
    },
    [muat]
  );

  if (memuat) {
    return <div className="p-6 text-sm text-slate-600 dark:text-slate-300">Memuat ringkasan…</div>;
  }

  if (pesan) {
    return (
      <div className="m-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
        <p className="font-medium">{pesan}</p>
        <p className="mt-1 opacity-80">
          Halaman kosong di sini bukan berarti tidak ada pekerjaan menunggu — hanya berarti bot belum terjangkau.
        </p>
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

  if (!data) return null;

  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Ringkasan Panitera</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Halaman ini hanya membaca. Keputusan verifikasi tetap di tangan majelis hakim.
        </p>
      </header>

      {catatan ? (
        <p className="rounded border border-slate-300 bg-white p-3 text-sm dark:border-slate-600 dark:bg-slate-900">
          {catatan}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <KartuAngka label="Menunggu verifikasi" nilai={data.ringkasan.menungguVerifikasi} nada="netral" />
        <KartuAngka label="Tenggat mendesak" nilai={data.ringkasan.tenggatMendesak} nada="mendesak" />
        <KartuAngka label="Tenggat sudah lewat" nilai={data.ringkasan.tenggatLewat} nada="lewat" />
        <KartuAngka label="Nomor salah alamat" nilai={data.ringkasan.nomorSalahAlamat} nada="lewat" />
        <KartuAngka label="Nomor belum menjawab" nilai={data.ringkasan.nomorBelumMenjawab} nada="netral" />
      </div>

      <section className="rounded-lg border border-slate-200 dark:border-slate-700">
        <h2 className="border-b border-slate-200 px-4 py-3 font-medium text-slate-900 dark:border-slate-700 dark:text-slate-100">
          Dokumen menunggu verifikasi majelis
        </h2>
        {data.menungguVerifikasi.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500 dark:text-slate-400">Tidak ada dokumen yang menunggu.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left dark:bg-slate-800">
                <tr>
                  <th className="px-4 py-2 font-medium">Perkara</th>
                  <th className="px-4 py-2 font-medium">Dokumen</th>
                  <th className="px-4 py-2 font-medium">Dari</th>
                  <th className="px-4 py-2 font-medium">Diunggah</th>
                  <th className="px-4 py-2 font-medium">Batas waktu</th>
                </tr>
              </thead>
              <tbody>
                {data.menungguVerifikasi.map((item) => {
                  const sisa = keteranganSisa(item.sisaHari);
                  return (
                    <tr key={item.documentKey} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="px-4 py-2 font-mono text-xs">{item.nomorPerkara}</td>
                      <td className="px-4 py-2">{item.judulDokumen}</td>
                      <td className="px-4 py-2">{item.peranPengunggah || "-"}</td>
                      <td className="px-4 py-2 whitespace-nowrap">{formatTanggal(item.diunggahPada)}</td>
                      <td className="px-4 py-2">
                        <span
                          className={
                            sisa.nada === "lewat"
                              ? "font-medium text-rose-700 dark:text-rose-300"
                              : sisa.nada === "mendesak"
                                ? "font-medium text-amber-700 dark:text-amber-300"
                                : "text-slate-600 dark:text-slate-300"
                          }
                        >
                          {item.batasUnggahTeks || "-"}
                          <span className="ml-2 opacity-70">({sisa.teks})</span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-rose-300 dark:border-rose-800">
        <h2 className="border-b border-rose-200 px-4 py-3 font-medium text-rose-900 dark:border-rose-800 dark:text-rose-100">
          Nomor salah alamat — perlu diperbaiki di SIPP
        </h2>
        <p className="px-4 pt-3 text-sm text-slate-600 dark:text-slate-300">
          Pemilik nomor menyatakan dirinya bukan pihak yang dimaksud. Selama datanya belum diperbaiki, pihak yang
          bersangkutan tidak menerima pemberitahuan apa pun.
          <br />
          Setelah data di SIPP diperbaiki, tekan Tanya Ulang — pemiliknya akan dikonfirmasi sekali lagi, dan tetap dialah
          yang menentukan.
        </p>
        {data.nomorSalahAlamat.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500 dark:text-slate-400">Tidak ada.</p>
        ) : (
          <ul className="divide-y divide-slate-100 px-4 py-2 dark:divide-slate-800">
            {data.nomorSalahAlamat.map((item) => (
              <li
                key={`${item.nomor}-${item.namaPihak}`}
                className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
              >
                <span>
                  <span className="font-mono">{item.nomor}</span>
                  <span className="mx-2 opacity-50">·</span>
                  <span>tercatat sebagai {item.namaPihak}</span>
                  <span className="ml-2 text-xs opacity-70">({formatTanggal(item.dijawabPada)})</span>
                </span>
                <button
                  type="button"
                  disabled={melepas === item.nomor}
                  onClick={() => void tanyaUlang(item.nomor, item.namaPihak)}
                  className="shrink-0 rounded border border-slate-300 px-2.5 py-1 text-xs font-medium hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:hover:bg-slate-800"
                >
                  {melepas === item.nomor ? "Melepas…" : "Tanya Ulang"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 dark:border-slate-700">
        <h2 className="border-b border-slate-200 px-4 py-3 font-medium text-slate-900 dark:border-slate-700 dark:text-slate-100">
          Nomor belum menjawab konfirmasi
        </h2>
        <p className="px-4 pt-3 text-sm text-slate-600 dark:text-slate-300">
          Berkas tidak dikirim sampai pemiliknya membenarkan identitasnya.
        </p>
        {data.nomorBelumMenjawab.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500 dark:text-slate-400">Tidak ada.</p>
        ) : (
          <ul className="divide-y divide-slate-100 px-4 py-2 dark:divide-slate-800">
            {data.nomorBelumMenjawab.map((item) => (
              <li key={`${item.nomor}-${item.namaPihak}`} className="py-2 text-sm">
                <span className="font-mono">{item.nomor}</span>
                <span className="mx-2 opacity-50">·</span>
                <span>{item.namaPihak}</span>
                <span className="ml-2 text-xs opacity-70">ditanya {formatTanggal(item.ditanyaPada)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-xs text-slate-500 dark:text-slate-400">
        Diperbarui {formatTanggal(data.dibuatPada)} · ambang mendesak {data.ambangMendesakHari} hari
      </p>
    </div>
  );
}
