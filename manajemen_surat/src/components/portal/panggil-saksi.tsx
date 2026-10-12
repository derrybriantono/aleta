"use client";

/**
 * ============================================================================
 * NAMA SAKSI DAPAT DIPANGGIL - JADWAL SIDANG (12 Okt 2026, butir 4)
 * ============================================================================
 *
 * "Tambahkan panggilan saksi persidangan di jadwal sidang (dengan cara di klik
 * nama saksinya, bisa dipilih saksi yang mana)."
 *
 * <DaftarNamaSaksi> menggambar nama saksi satu pihak. Bila saklar tampilan
 * `panggil-saksi` menyala (dan hak pengguna ada, dan saklar panggil pihak
 * menyala), tiap nama menjadi tombol: menekannya membuka pop-up melayang berisi
 * SELURUH saksi perkara itu (kedua pihak), dengan saksi yang diklik sudah
 * terpilih. Petugas dapat mencentang satu, beberapa, atau memilih semua saksi
 * satu pihak, lalu memanggil lewat WhatsApp dan/atau pengeras suara.
 *
 * Mekanisme panggilnya adalah yang sudah ada (lihat @/lib/panggil-saksi):
 * sasaran dari /api/aleta-ecourt/panggil/sasaran, panggilan lewat
 * /api/aleta-ecourt/panggil satu per satu. Nomor tidak pernah utuh di peramban.
 * Saksi yang belum dijawab verifikasi nomornya minta persetujuan "Kirim tetap"
 * seperti pihak.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Megaphone, MessageCircle, X } from "lucide-react";

import { apiPath } from "@/lib/base-path";
import { kalimatStatusNomor, namaDapatDiklik } from "@/lib/panggil-petugas";
import {
  pilihSemuaSatuPihak,
  pilihanAwal,
  ringkasHasilPanggil,
  saksiDariSasaran,
  semuaTerpilih,
  ubahPilihan,
  urutanPanggil,
  type GolonganSaksi,
  type SaksiSasaran,
} from "@/lib/panggil-saksi";
import { pesanGalatPortal } from "@/lib/pesan-galat-portal";
import { cn } from "@/lib/utils";
import { usePilihanPanggil } from "@/components/portal/panggil-petugas";

export type KonteksPanggilSaksi = {
  perkaraId: string;
  tanggal: string;
  nomorPerkara: string;
  ruang?: string;
  agenda?: string;
};

type HasilTekan = { ok: boolean; hasil: string; pesan: string };

type DataSaksi = {
  saksi: SaksiSasaran[];
  whatsappBisa: boolean;
  whatsappAlasan: string;
  tidakTerbaca: string[];
};

const JUDUL_SISI: Record<GolonganSaksi, string> = {
  saksi1: "Saksi penggugat / pemohon",
  saksi2: "Saksi tergugat / termohon",
};

function letak(jangkar: DOMRect) {
  const lebar = Math.min(384, window.innerWidth - 32);
  const kiri = Math.max(16, Math.min(jangkar.left, window.innerWidth - lebar - 16));
  const bawahMuat = window.innerHeight - jangkar.bottom > 320;
  return bawahMuat
    ? { left: kiri, top: jangkar.bottom + 4, width: lebar }
    : { left: kiri, bottom: window.innerHeight - jangkar.top + 4, width: lebar };
}

function PopupSaksi({
  jangkar,
  konteks,
  namaKlik,
  golonganKlik,
  onTutup,
}: {
  jangkar: HTMLElement;
  konteks: KonteksPanggilSaksi;
  namaKlik: string;
  golonganKlik: GolonganSaksi;
  onTutup: () => void;
}) {
  const kotak = useRef<HTMLDivElement>(null);
  const [pilihanSaklar] = usePilihanPanggil();
  const [data, setData] = useState<DataSaksi | null>(null);
  const [galat, setGalat] = useState("");
  const [pilihan, setPilihan] = useState<Set<string>>(() => new Set());
  const [sibuk, setSibuk] = useState("");
  const [hasil, setHasil] = useState<Record<string, HasilTekan>>({});
  const [ringkas, setRingkas] = useState("");

  // Tutup: klik di luar, Esc, atau halaman digulir/diubah ukurannya (pola yang
  // sama dengan pop-up panggil lain: pop-up melayang tidak boleh tertinggal).
  useEffect(() => {
    const klik = (e: MouseEvent) => {
      const sasaran = e.target as Node;
      if (kotak.current?.contains(sasaran) || jangkar.contains(sasaran)) return;
      onTutup();
    };
    const tombol = (e: KeyboardEvent) => {
      if (e.key === "Escape") onTutup();
    };
    const gulir = (e: Event) => {
      if (kotak.current && e.target instanceof Node && kotak.current.contains(e.target)) return;
      onTutup();
    };
    document.addEventListener("mousedown", klik);
    document.addEventListener("keydown", tombol);
    window.addEventListener("scroll", gulir, true);
    window.addEventListener("resize", onTutup);
    return () => {
      document.removeEventListener("mousedown", klik);
      document.removeEventListener("keydown", tombol);
      window.removeEventListener("scroll", gulir, true);
      window.removeEventListener("resize", onTutup);
    };
  }, [jangkar, onTutup]);

  const muat = useCallback(async () => {
    setGalat("");
    try {
      const params = new URLSearchParams({
        perkaraId: konteks.perkaraId,
        tanggal: konteks.tanggal,
        golongan: "saksi1,saksi2",
      });
      const jawaban = await fetch(apiPath(`/api/aleta-ecourt/panggil/sasaran?${params.toString()}`), { cache: "no-store" });
      const isi = await jawaban.json().catch(() => ({}));
      if (!jawaban.ok) throw new Error(pesanGalatPortal(isi, "Daftar saksi tidak terbaca."));
      const d = (isi?.data ?? isi) as {
        available?: boolean;
        alasan?: string;
        orang?: unknown[];
        whatsapp?: { dapatKirim?: boolean; alasan?: string };
        tidakTerbaca?: string[];
      };
      if (d.available === false) {
        setGalat(String(d.alasan || "Daftar saksi tidak terbaca."));
        return;
      }
      const saksi = saksiDariSasaran(Array.isArray(d.orang) ? (d.orang as never[]) : []);
      setData({
        saksi,
        whatsappBisa: d.whatsapp?.dapatKirim === true,
        whatsappAlasan: String(d.whatsapp?.alasan ?? ""),
        tidakTerbaca: Array.isArray(d.tidakTerbaca) ? d.tidakTerbaca : [],
      });
      // Pilihan awal HANYA saat pertama dimuat; muat ulang sesudah memanggil tidak
      // boleh membuang centang yang sedang dipegang petugas.
      setPilihan((lama) => (lama.size > 0 ? lama : pilihanAwal(saksi, namaKlik, golonganKlik)));
    } catch (e) {
      setGalat(e instanceof Error ? e.message : String(e));
    }
  }, [konteks.perkaraId, konteks.tanggal, namaKlik, golonganKlik]);

  useEffect(() => {
    void Promise.resolve().then(muat);
  }, [muat]);

  const panggilSatu = useCallback(
    async (orang: SaksiSasaran, saluran: "whatsapp" | "audio", setuju = false): Promise<HasilTekan> => {
      try {
        const jawaban = await fetch(apiPath("/api/aleta-ecourt/panggil"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            perkaraId: konteks.perkaraId,
            tanggal: konteks.tanggal,
            konteks: "sidang",
            kunci: orang.kunci,
            saluran,
            ruang: konteks.ruang ?? "",
            agenda: konteks.agenda ?? "",
            nomorPerkara: konteks.nomorPerkara,
            setujuBelumTerverifikasi: setuju,
          }),
        });
        const isi = await jawaban.json().catch(() => ({}));
        if (!jawaban.ok) throw new Error(pesanGalatPortal(isi, "Panggilan gagal."));
        return (isi?.data ?? isi) as HasilTekan;
      } catch (e) {
        return { ok: false, hasil: "gagal", pesan: e instanceof Error ? e.message : String(e) };
      }
    },
    [konteks]
  );

  /** Memanggil seluruh saksi terpilih, SATU PER SATU (bukan serempak): jeda anti-ganda dan riwayat berjalan per orang. */
  const panggilTerpilih = async (saluran: "whatsapp" | "audio") => {
    if (!data) return;
    const sasaran = urutanPanggil(data.saksi, pilihan);
    if (sasaran.length === 0) return;
    setSibuk(saluran);
    setRingkas("");
    const kumpul: HasilTekan[] = [];
    for (const orang of sasaran) {
      const h = await panggilSatu(orang, saluran);
      kumpul.push(h);
      setHasil((lama) => ({ ...lama, [`${orang.kunci}|${saluran}`]: h }));
    }
    setRingkas(ringkasHasilPanggil(kumpul));
    setSibuk("");
  };

  const kirimTetap = async (orang: SaksiSasaran) => {
    setSibuk("tetap");
    const h = await panggilSatu(orang, "whatsapp", true);
    setHasil((lama) => ({ ...lama, [`${orang.kunci}|whatsapp`]: h }));
    setSibuk("");
  };

  const bolehChat = pilihanSaklar["panggil-pihak-chat"];
  const bolehAudio = pilihanSaklar["panggil-pihak-audio"];
  const jumlahTerpilih = data ? urutanPanggil(data.saksi, pilihan).length : 0;
  const golongan: GolonganSaksi[] = ["saksi1", "saksi2"];
  const rekap = data ? data.saksi.length : 0;

  const posisi = letak(jangkar.getBoundingClientRect());

  return createPortal(
    <div
      ref={kotak}
      role="dialog"
      aria-label="Panggil saksi"
      data-popup-panggil-saksi=""
      style={{ position: "fixed", zIndex: 60, ...posisi }}
      className="max-h-[75vh] overflow-y-auto rounded-lg border bg-card p-3 text-sm text-card-foreground shadow-xl"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold">Panggil saksi</p>
          <p className="text-xs text-muted-foreground">
            {konteks.nomorPerkara}
            {konteks.ruang ? ` · ${konteks.ruang}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={onTutup}
          className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Tutup"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {galat ? <p className="text-xs text-rose-700 dark:text-rose-300">{galat}</p> : null}
      {!data && !galat ? <p className="text-xs text-muted-foreground">Membaca daftar saksi…</p> : null}

      {data && !data.whatsappBisa ? (
        <p className="mb-2 rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          {data.whatsappAlasan || "Bot WhatsApp ALETA tidak dapat mengirim saat ini."}
        </p>
      ) : null}

      {data && rekap === 0 ? (
        <p className="text-xs text-muted-foreground">
          Tidak ada saksi yang terdaftar pada perkara ini di SIPP
          {data.tidakTerbaca.length > 0 ? ` (tidak terbaca: ${data.tidakTerbaca.join("; ")})` : ""}.
        </p>
      ) : null}

      {data
        ? golongan.map((g) => {
            const sisi = data.saksi.filter((s) => s.golongan === g);
            if (sisi.length === 0) return null;
            const semua = semuaTerpilih(data.saksi, pilihan, g);
            return (
              <div key={g} className="mb-2" data-kelompok-saksi={g}>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {JUDUL_SISI[g]} ({sisi.length})
                  </p>
                  <button
                    type="button"
                    onClick={() => setPilihan((lama) => pilihSemuaSatuPihak(data.saksi, lama, g))}
                    className="rounded border px-1.5 py-0.5 text-[11px] font-medium hover:bg-muted"
                    data-pilih-semua={g}
                  >
                    {semua ? "Kosongkan" : "Pilih semua"}
                  </button>
                </div>
                <ul className="space-y-1">
                  {sisi.map((s) => {
                    const hWa = hasil[`${s.kunci}|whatsapp`];
                    const hAudio = hasil[`${s.kunci}|audio`];
                    return (
                      <li key={s.kunci} className="rounded-md border p-1.5" data-saksi={s.kunci}>
                        <label className="flex cursor-pointer items-start gap-2">
                          <input
                            type="checkbox"
                            className="mt-0.5 h-3.5 w-3.5 accent-primary"
                            checked={pilihan.has(s.kunci)}
                            onChange={() => setPilihan((lama) => ubahPilihan(lama, s.kunci))}
                            disabled={sibuk !== ""}
                          />
                          <span className="min-w-0">
                            <span className="block font-medium leading-tight">{s.nama}</span>
                            <span
                              className={cn(
                                "block text-xs",
                                s.statusNomor === "terverifikasi"
                                  ? "text-emerald-700 dark:text-emerald-400"
                                  : s.statusNomor === "belum-terverifikasi"
                                    ? "text-amber-700 dark:text-amber-300"
                                    : "text-rose-700 dark:text-rose-300"
                              )}
                              title={s.keteranganNomor}
                            >
                              {s.nomorTersamar ? `${s.nomorTersamar} - ` : ""}
                              {kalimatStatusNomor(s.statusNomor)}
                            </span>
                          </span>
                        </label>
                        {[hWa, hAudio].map((h, ke) =>
                          h ? (
                            <div
                              key={ke}
                              className={cn(
                                "mt-1 pl-5 text-xs",
                                h.ok ? "text-emerald-700 dark:text-emerald-400" : "text-amber-800 dark:text-amber-300"
                              )}
                              data-hasil-panggil={h.hasil}
                            >
                              {ke === 1 ? "Suara: " : "WA: "}
                              {h.pesan}
                              {h.hasil === "perlu_persetujuan" ? (
                                <button
                                  type="button"
                                  disabled={sibuk !== ""}
                                  onClick={() => void kirimTetap(s)}
                                  className="ml-1 rounded border border-amber-400 px-1.5 py-0.5 font-medium hover:bg-amber-50 dark:hover:bg-amber-950"
                                >
                                  Kirim tetap
                                </button>
                              ) : null}
                            </div>
                          ) : null
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })
        : null}

      {data && rekap > 0 ? (
        <div className="mt-2 border-t pt-2">
          <div className="flex flex-wrap gap-1.5">
            {bolehChat ? (
              <button
                type="button"
                disabled={sibuk !== "" || jumlahTerpilih === 0}
                onClick={() => void panggilTerpilih("whatsapp")}
                className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition hover:bg-muted disabled:opacity-50"
                data-panggil-saksi="whatsapp"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                Panggil terpilih (chat WhatsApp){jumlahTerpilih > 0 ? ` · ${jumlahTerpilih}` : ""}
              </button>
            ) : null}
            {bolehAudio ? (
              <button
                type="button"
                disabled={sibuk !== "" || jumlahTerpilih === 0}
                onClick={() => void panggilTerpilih("audio")}
                className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition hover:bg-muted disabled:opacity-50"
                data-panggil-saksi="audio"
              >
                <Megaphone className="h-3.5 w-3.5" />
                Panggil terpilih (audio speaker){jumlahTerpilih > 0 ? ` · ${jumlahTerpilih}` : ""}
              </button>
            ) : null}
          </div>
          {jumlahTerpilih === 0 ? (
            <p className="mt-1 text-[11px] text-muted-foreground">Centang saksi yang akan dipanggil.</p>
          ) : null}
          {sibuk ? <p className="mt-1 text-[11px] text-muted-foreground">Memanggil satu per satu…</p> : null}
          {ringkas ? (
            <p className="mt-1 text-xs font-medium" data-ringkas-panggil="">
              {ringkas}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>,
    document.body
  );
}

/**
 * Nama saksi satu pihak. `aktif` = saklar tampilan `panggil-saksi` (sudah disaring
 * hak peran oleh layar induk). Tidak aktif, tak ada namanya, atau saklar panggil
 * pihak mati semua: nama digambar APA ADANYA, tanpa tombol maupun garis bawah.
 */
export function DaftarNamaSaksi({
  aktif,
  golongan,
  nama,
  konteks,
  kosong = "nama belum tercatat",
}: {
  aktif: boolean;
  golongan: GolonganSaksi;
  nama: ReadonlyArray<string>;
  konteks: KonteksPanggilSaksi;
  kosong?: string;
}) {
  const [pilihanSaklar] = usePilihanPanggil();
  const [buka, setBuka] = useState<{ jangkar: HTMLElement; nama: string } | null>(null);
  const tutup = useCallback(() => setBuka(null), []);

  if (nama.length === 0) return <>{kosong}</>;
  const dapatDiklik = aktif && Boolean(konteks.perkaraId) && namaDapatDiklik(pilihanSaklar, golongan);
  if (!dapatDiklik) return <>{nama.join(", ")}</>;

  return (
    <>
      {nama.map((n, ke) => (
        <span key={`${n}-${ke}`}>
          {ke > 0 ? ", " : null}
          <button
            type="button"
            onClick={(e) => {
              const ini = e.currentTarget;
              setBuka((lama) => (lama && lama.nama === n ? null : { jangkar: ini, nama: n }));
            }}
            aria-haspopup="dialog"
            aria-expanded={buka?.nama === n}
            data-nama-saksi={golongan}
            title="Klik untuk memanggil saksi ini (pilih saksi mana yang dipanggil)"
            className="inline cursor-pointer break-words text-left underline decoration-dotted decoration-1 underline-offset-2 hover:text-primary"
          >
            {n}
          </button>
        </span>
      ))}
      {buka ? (
        <PopupSaksi
          key={buka.nama}
          jangkar={buka.jangkar}
          konteks={konteks}
          namaKlik={buka.nama}
          golonganKlik={golongan}
          onTutup={tutup}
        />
      ) : null}
    </>
  );
}
