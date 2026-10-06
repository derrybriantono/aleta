"use client";

/**
 * ============================================================================
 * NAMA YANG DAPAT DIPANGGIL - POP-UP PANGGIL PETUGAS & PIHAK (BUTIR 33-37)
 * ============================================================================
 *
 * Nama hakim, panitera pengganti, juru sita, mediator, dan para pihak (bukan
 * saksi) di Jadwal Sidang, Hasil Sidang, dan Jadwal Mediasi dibungkus
 * <NamaDapatDipanggil>. Mengkliknya membuka pop-up kecil yang MELAYANG
 * (createPortal ke document.body, position: fixed) - tidak menyisip baris,
 * tidak melebarkan kolom, tidak mengubah skala tabel.
 *
 * Isi pop-up dibaca dari peladen tiap kali dibuka (/api/aleta-ecourt/panggil/
 * sasaran): tiap orang dengan perannya sendiri (Hakim Ketua / Hakim Anggota
 * masing-masing), nomor TERSAMAR beserta keadaannya, dan keadaan bot WhatsApp.
 * Bila bot nonaktif, pop-up mengatakannya - tombolnya tetap dapat ditekan
 * supaya panggilannya tercatat, tetapi hasilnya disebut "tidak terkirim",
 * tidak pernah "terkirim".
 *
 * Berkas ini BARU dan berdiri sendiri supaya layar lama (aleta-ecourt-
 * sidang.tsx, aleta-ecourt-mediasi.tsx, hasil-sidang.tsx) hanya mendapat
 * sisipan sekecil mungkin.
 */

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Megaphone, MessageCircle, Settings2, Volume2, X } from "lucide-react";

import { apiPath } from "@/lib/base-path";
import {
  KUNCI_SIMPANAN_PANGGIL,
  PERISTIWA_SAKLAR_PANGGIL,
  SAKLAR_PANGGIL,
  bacaPanggil,
  golonganPetugas,
  kalimatStatusNomor,
  namaDapatDiklik,
  panggilBawaan,
  type GolonganSasaran,
  type KeadaanWhatsApp,
  type KunciSaklarPanggil,
  type OrangSasaran,
  type PilihanPanggil,
} from "@/lib/panggil-petugas";
import { pesanGalatPortal } from "@/lib/pesan-galat-portal";
import { ucapkan } from "@/lib/suara-panggilan";
import { cn } from "@/lib/utils";

// ============================================================================
// SAKLAR - SATU SIMPANAN UNTUK SELURUH LAYAR DI PERAMBAN INI
// ============================================================================

let cachePilihan: { mentah: string | null; nilai: PilihanPanggil } | null = null;
/** Pengganti localStorage bila peramban menolaknya (jendela pribadi, data situs diblokir). */
let simpananCadangan: string | null = null;

function bacaSimpanan(): PilihanPanggil {
  let mentah: string | null = null;
  try {
    mentah = window.localStorage.getItem(KUNCI_SIMPANAN_PANGGIL) ?? simpananCadangan;
  } catch {
    mentah = simpananCadangan;
  }
  // useSyncExternalStore menuntut nilai yang SAMA selama simpanannya sama.
  if (cachePilihan && cachePilihan.mentah === mentah) return cachePilihan.nilai;
  cachePilihan = { mentah, nilai: bacaPanggil(mentah) };
  return cachePilihan.nilai;
}

const BAWAAN_PELADEN = panggilBawaan();

function langganan(beritahu: () => void) {
  window.addEventListener(PERISTIWA_SAKLAR_PANGGIL, beritahu);
  window.addEventListener("storage", beritahu);
  return () => {
    window.removeEventListener(PERISTIWA_SAKLAR_PANGGIL, beritahu);
    window.removeEventListener("storage", beritahu);
  };
}

/** Pilihan saklar panggil yang berlaku, dan pengubahnya. */
export function usePilihanPanggil(): [PilihanPanggil, (kunci: KunciSaklarPanggil, nyala: boolean) => void] {
  const pilihan = useSyncExternalStore(langganan, bacaSimpanan, () => BAWAAN_PELADEN);
  const ubah = useCallback((kunci: KunciSaklarPanggil, nyala: boolean) => {
    const baru = { ...bacaSimpanan(), [kunci]: nyala };
    simpananCadangan = JSON.stringify(baru);
    try {
      window.localStorage.setItem(KUNCI_SIMPANAN_PANGGIL, simpananCadangan);
    } catch {
      /* tidak tersimpan - tetap berlaku selama halaman terbuka lewat simpananCadangan */
    }
    window.dispatchEvent(new Event(PERISTIWA_SAKLAR_PANGGIL));
  }, []);
  return [pilihan, ubah];
}

/**
 * Tiga saklar fitur panggil - disisipkan di panel tampilan Jadwal Sidang dan
 * di pengaturan Jadwal Mediasi. Tidak ikut tombol Mode lengkap / minimalis:
 * lihat kepala @/lib/panggil-petugas.
 */
export function SaklarPanggil({ className }: { className?: string }) {
  const [pilihan, ubah] = usePilihanPanggil();
  return (
    <div className={cn("rounded-lg border bg-card p-2", className)} data-saklar-panggil>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Panggil petugas &amp; pihak
      </p>
      <ul className="space-y-1">
        {SAKLAR_PANGGIL.map((saklar) => (
          <li key={saklar.kunci}>
            <label
              className="flex cursor-pointer items-start gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-muted/60"
              title={saklar.keterangan}
            >
              <input
                type="checkbox"
                className="mt-0.5 h-3.5 w-3.5 accent-primary"
                checked={pilihan[saklar.kunci]}
                onChange={(e) => ubah(saklar.kunci, e.target.checked)}
                data-kunci={saklar.kunci}
              />
              <span className="leading-tight">
                {saklar.label}
                {saklar.bawaan ? null : (
                  <span className="ml-1 text-[10px] text-muted-foreground">(bawaan mati)</span>
                )}
              </span>
            </label>
          </li>
        ))}
      </ul>
      <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
        Klik nama petugas atau pihak untuk memanggil. Berlaku di Jadwal Sidang, Hasil Sidang, dan Jadwal
        Mediasi pada peramban ini; tidak ikut tombol Mode lengkap/minimalis.
      </p>
    </div>
  );
}

/** Tombol roda gigi + panel saklar - untuk layar yang belum punya panel tampilan (Jadwal Mediasi). */
export function PengaturanPanggil() {
  const [terbuka, setTerbuka] = useState(false);
  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setTerbuka((x) => !x)}
        aria-expanded={terbuka}
        className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
      >
        <Settings2 className="h-3.5 w-3.5" />
        Pengaturan panggil
      </button>
      {terbuka ? <SaklarPanggil className="mt-2 max-w-md" /> : null}
    </div>
  );
}

// ============================================================================
// POP-UP
// ============================================================================

type KonteksPanggil = {
  perkaraId: string;
  tanggal: string;
  nomorPerkara: string;
  ruang?: string;
  agenda?: string;
  konteks?: "sidang" | "mediasi";
  mediasiId?: string;
};

type Riwayat = { kunci?: string; nama?: string; saluran?: string; hasil?: string; oleh?: string; waktu?: string };

type DataSasaran = {
  available: boolean;
  alasan?: string;
  orang: Array<OrangSasaran & { golongan: GolonganSasaran }>;
  whatsapp: KeadaanWhatsApp;
  riwayat: Riwayat[];
  tidakTerbaca: string[];
};

type HasilTekan = { ok: boolean; hasil: string; pesan: string; teks?: string };

const SEBUTAN_HASIL: Record<string, string> = {
  diantre: "masuk antrean WA",
  diumumkan: "diumumkan",
  tidak_dikirim: "tidak terkirim",
  nomor_tidak_ada: "tanpa nomor",
  nomor_bermasalah: "nomor bermasalah",
  gagal: "gagal",
  diproses: "diproses",
};

function letakPopup(jangkar: DOMRect) {
  const lebar = Math.min(352, window.innerWidth - 32);
  const kiri = Math.max(16, Math.min(jangkar.left, window.innerWidth - lebar - 16));
  const bawahMuat = window.innerHeight - jangkar.bottom > 280;
  return bawahMuat
    ? { left: kiri, top: jangkar.bottom + 4, width: lebar }
    : { left: kiri, bottom: window.innerHeight - jangkar.top + 4, width: lebar };
}

function PopupPanggil({
  jangkar,
  golongan,
  konteks,
  pilihan,
  onTutup,
}: {
  jangkar: HTMLElement;
  golongan: GolonganSasaran;
  konteks: KonteksPanggil;
  pilihan: PilihanPanggil;
  onTutup: () => void;
}) {
  const kotak = useRef<HTMLDivElement>(null);

  const [data, setData] = useState<DataSasaran | null>(null);
  const [galat, setGalat] = useState("");
  const [sibuk, setSibuk] = useState("");
  const [hasil, setHasil] = useState<Record<string, HasilTekan>>({});


  // Tutup: klik di luar, Esc, atau tabel/halaman digulir (pop-up melayang
  // tidak boleh tertinggal di tempat yang barisnya sudah pindah).
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
      const params = new URLSearchParams({ perkaraId: konteks.perkaraId, tanggal: konteks.tanggal, golongan });
      const jawaban = await fetch(apiPath(`/api/aleta-ecourt/panggil/sasaran?${params.toString()}`), {
        cache: "no-store",
      });
      const isi = await jawaban.json().catch(() => ({}));
      if (!jawaban.ok) throw new Error(pesanGalatPortal(isi, "Daftar petugas tidak terbaca."));
      const d = (isi?.data ?? isi) as DataSasaran;
      if (d.available === false) {
        setGalat(String(d.alasan || "Daftar petugas dan pihak tidak terbaca."));
        return;
      }
      setData({
        available: true,
        orang: Array.isArray(d.orang) ? d.orang : [],
        whatsapp: d.whatsapp ?? { dapatKirim: false, alasan: "Keadaan bot WhatsApp tidak terbaca." },
        riwayat: Array.isArray(d.riwayat) ? d.riwayat : [],
        tidakTerbaca: Array.isArray(d.tidakTerbaca) ? d.tidakTerbaca : [],
      });
    } catch (e) {
      setGalat(e instanceof Error ? e.message : String(e));
    }
  }, [konteks.perkaraId, konteks.tanggal, golongan]);

  useEffect(() => {
    void Promise.resolve().then(muat);
  }, [muat]);

  const tekan = async (orang: OrangSasaran, saluran: "whatsapp" | "audio", setuju = false) => {
    const kunciTekan = `${orang.kunci}|${saluran}`;
    setSibuk(kunciTekan);
    try {
      const jawaban = await fetch(apiPath("/api/aleta-ecourt/panggil"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          perkaraId: konteks.perkaraId,
          tanggal: konteks.tanggal,
          mediasiId: konteks.mediasiId ?? "",
          konteks: konteks.konteks ?? "sidang",
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
      const h = (isi?.data ?? isi) as HasilTekan;
      setHasil((lama) => ({ ...lama, [kunciTekan]: h }));
      if (h.hasil !== "perlu_persetujuan") void muat();
    } catch (e) {
      setHasil((lama) => ({
        ...lama,
        [kunciTekan]: { ok: false, hasil: "gagal", pesan: e instanceof Error ? e.message : String(e) },
      }));
    } finally {
      setSibuk("");
    }
  };

  const orangTampil = (data?.orang ?? []).filter((o) =>
    o.jenis === "petugas"
      ? pilihan["panggil-petugas-chat"] || pilihan["panggil-petugas-audio"]
      : pilihan["panggil-pihak-chat"] || pilihan["panggil-pihak-audio"]
  );

  // Dihitung tiap gambar dari letak nama yang diklik; pop-up menutup sendiri
  // saat halaman digulir atau jendela diubah ukurannya, jadi tidak pernah basi.
  const letak = letakPopup(jangkar.getBoundingClientRect());

  return createPortal(
    <div
      ref={kotak}
      role="dialog"
      aria-label="Panggil petugas atau pihak"
      data-popup-panggil
      style={{ position: "fixed", zIndex: 60, ...letak }}
      className="max-h-[70vh] overflow-y-auto rounded-lg border bg-card p-3 text-sm text-card-foreground shadow-xl"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold">Panggil</p>
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
      {!data && !galat ? <p className="text-xs text-muted-foreground">Membaca petugas dan nomornya…</p> : null}

      {data && !data.whatsapp.dapatKirim ? (
        <p
          className="mb-2 rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
          data-wa-nonaktif
        >
          {data.whatsapp.alasan}
        </p>
      ) : null}

      {data && orangTampil.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Tidak ada orang yang dapat dipanggil di sini
          {data.tidakTerbaca.length > 0 ? ` (tidak terbaca: ${data.tidakTerbaca.join("; ")})` : ""}.
        </p>
      ) : null}

      <ul className="space-y-2">
        {orangTampil.map((orang) => {
          const bolehChat =
            orang.jenis === "petugas" ? pilihan["panggil-petugas-chat"] : pilihan["panggil-pihak-chat"];
          // Lanjutan butir 23 (6 Okt 2026): pihak juga, lewat saklarnya sendiri.
          const bolehAudio = orang.jenis === "petugas" ? pilihan["panggil-petugas-audio"] : pilihan["panggil-pihak-audio"];
          const hWa = hasil[`${orang.kunci}|whatsapp`];
          const hAudio = hasil[`${orang.kunci}|audio`];
          return (
            <li key={orang.kunci} className="rounded-md border p-2" data-orang={orang.kunci}>
              <div className="font-medium leading-tight">{orang.nama}</div>
              <div className="text-xs text-muted-foreground">
                {orang.peran}
                {" · "}
                <span
                  className={
                    orang.statusNomor === "terverifikasi"
                      ? "text-emerald-700 dark:text-emerald-400"
                      : orang.statusNomor === "belum-terverifikasi"
                        ? "text-amber-700 dark:text-amber-300"
                        : "text-rose-700 dark:text-rose-300"
                  }
                  title={orang.keteranganNomor}
                >
                  {orang.nomorTersamar ? `${orang.nomorTersamar} - ` : ""}
                  {kalimatStatusNomor(orang.statusNomor)}
                </span>
              </div>
              {orang.statusNomor !== "terverifikasi" ? (
                <div className="mt-0.5 text-[11px] text-muted-foreground">{orang.keteranganNomor}</div>
              ) : null}
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {bolehChat ? (
                  <button
                    type="button"
                    disabled={sibuk !== "" || !orang.nomorTersamar}
                    onClick={() => void tekan(orang, "whatsapp")}
                    className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition hover:bg-muted disabled:opacity-50"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    Panggil (chat WhatsApp)
                  </button>
                ) : null}
                {bolehAudio ? (
                  <button
                    type="button"
                    disabled={sibuk !== ""}
                    onClick={() => void tekan(orang, "audio")}
                    className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition hover:bg-muted disabled:opacity-50"
                  >
                    <Megaphone className="h-3.5 w-3.5" />
                    Panggil (audio speaker)
                  </button>
                ) : null}
              </div>
              {hWa ? (
                <div
                  className={cn(
                    "mt-1 text-xs",
                    hWa.ok ? "text-emerald-700 dark:text-emerald-400" : "text-amber-800 dark:text-amber-300"
                  )}
                  data-hasil-panggil={hWa.hasil}
                >
                  {hWa.pesan}
                  {hWa.hasil === "perlu_persetujuan" ? (
                    <button
                      type="button"
                      disabled={sibuk !== ""}
                      onClick={() => void tekan(orang, "whatsapp", true)}
                      className="ml-1 rounded border border-amber-400 px-1.5 py-0.5 font-medium hover:bg-amber-50 dark:hover:bg-amber-950"
                    >
                      Kirim tetap
                    </button>
                  ) : null}
                </div>
              ) : null}
              {hAudio ? (
                <div
                  className={cn(
                    "mt-1 text-xs",
                    hAudio.ok ? "text-emerald-700 dark:text-emerald-400" : "text-amber-800 dark:text-amber-300"
                  )}
                  data-hasil-panggil={hAudio.hasil}
                >
                  {hAudio.pesan}
                  {hAudio.ok && hAudio.teks ? (
                    <button
                      type="button"
                      onClick={() => ucapkan(hAudio.teks ?? "")}
                      className="ml-1 inline-flex items-center gap-0.5 rounded border px-1.5 py-0.5 font-medium hover:bg-muted"
                      title="Putar juga di perangkat ini (bila perangkat ini tersambung ke pengeras suara)"
                    >
                      <Volume2 className="h-3 w-3" /> Putar di sini
                    </button>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      {data && data.riwayat.length > 0 ? (
        <div className="mt-2 border-t pt-1.5">
          <p className="text-[11px] font-semibold text-muted-foreground">Riwayat panggilan hari ini</p>
          <ul className="text-[11px] text-muted-foreground">
            {data.riwayat.slice(0, 5).map((r, ke) => (
              <li key={ke}>
                {String(r.waktu ?? "").slice(11, 16)} {r.saluran === "audio" ? "suara" : "WA"} {r.nama} -{" "}
                {SEBUTAN_HASIL[String(r.hasil)] ?? r.hasil} ({r.oleh})
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>,
    document.body
  );
}

/**
 * Pembungkus nama. Bila fitur panggil golongan ini dimatikan (saklar), atau
 * golongannya tidak dikenal (saksi, turut tergugat), anak-anaknya digambar
 * APA ADANYA - tanpa tombol, tanpa garis bawah.
 */
export function NamaDapatDipanggil({
  golongan,
  children,
  className,
  ...konteks
}: KonteksPanggil & { golongan: GolonganSasaran | null; children: ReactNode; className?: string }) {
  const [pilihan] = usePilihanPanggil();
  const [jangkar, setJangkar] = useState<HTMLElement | null>(null);
  const tutup = useCallback(() => setJangkar(null), []);

  if (!golongan || !konteks.perkaraId || !namaDapatDiklik(pilihan, golongan)) return <>{children}</>;

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          const ini = e.currentTarget;
          setJangkar((lama) => (lama ? null : ini));
        }}
        aria-haspopup="dialog"
        aria-expanded={jangkar !== null}
        data-nama-panggil={golongan}
        title={golonganPetugas(golongan) ? "Klik untuk memanggil petugas ini" : "Klik untuk memanggil pihak ini (WhatsApp / suara)"}
        className={cn(
          "inline cursor-pointer break-words text-left underline decoration-dotted decoration-1 underline-offset-2 hover:text-primary",
          className
        )}
      >
        {children}
      </button>
      {jangkar ? (
        <PopupPanggil
          jangkar={jangkar}
          golongan={golongan}
          konteks={konteks}
          pilihan={pilihan}
          onTutup={tutup}
        />
      ) : null}
    </>
  );
}

/** Golongan sasaran untuk sisi pihak di Jadwal Mediasi (butir 23: turut tergugat & intervensi ikut). */
export function golonganSisi(kunci: string): GolonganSasaran | null {
  if (kunci === "pihak-pertama" || kunci === "penggugat" || kunci === "pihak1") return "pihak1";
  if (kunci === "pihak-kedua" || kunci === "tergugat" || kunci === "pihak2") return "pihak2";
  if (kunci === "turut" || kunci === "turut-tergugat" || kunci === "pihak4") return "pihak4";
  if (kunci === "intervensi" || kunci === "pihak3") return "pihak3";
  return null;
}

/**
 * Kartu "Panggil petugas & pihak" untuk Hasil Sidang - layar itu tidak
 * menampilkan nama majelis maupun pihak, jadi tiap golongan digambar sebagai
 * tombol yang membuka pop-up yang sama.
 */
export function KartuPanggil(props: KonteksPanggil) {
  const [pilihan] = usePilihanPanggil();
  const [pengaturan, setPengaturan] = useState(false);
  const golongan: Array<{ kunci: GolonganSasaran; label: string }> = [
    { kunci: "majelis", label: "Majelis hakim" },
    { kunci: "pp", label: "Panitera pengganti" },
    { kunci: "js", label: "Juru sita" },
    { kunci: "pihak1", label: "Pihak pertama & kuasa" },
    { kunci: "pihak2", label: "Pihak kedua & kuasa" },
    // Butir 23 (6 Okt 2026). Perkara tanpa turut tergugat / intervensi:
    // pop-up menyebut tidak ada orangnya.
    { kunci: "pihak4", label: "Turut tergugat & kuasa" },
    { kunci: "pihak3", label: "Intervensi & kuasa" },
  ];
  const tampil = golongan.filter((g) => namaDapatDiklik(pilihan, g.kunci));
  return (
    <div className="rounded-xl border bg-card p-3" data-kartu-panggil>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">Panggil petugas &amp; pihak</p>
        <button
          type="button"
          onClick={() => setPengaturan((x) => !x)}
          aria-expanded={pengaturan}
          className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted"
        >
          <Settings2 className="h-3.5 w-3.5" /> Saklar
        </button>
      </div>
      {pengaturan ? <SaklarPanggil className="mt-2" /> : null}
      {tampil.length === 0 ? (
        <p className="mt-1 text-xs text-muted-foreground">Seluruh fitur panggil dimatikan lewat saklarnya.</p>
      ) : (
        <div className="mt-2 flex flex-wrap gap-2 text-sm">
          {tampil.map((g) => (
            <span key={g.kunci} className="rounded-md border px-2 py-1">
              <NamaDapatDipanggil golongan={g.kunci} {...props}>
                {g.label}
              </NamaDapatDipanggil>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
