"use client";

/**
 * ============================================================================
 * TUNDA MEDIASI - POP-UP DI JADWAL MEDIASI (26 Okt 2026)
 * ============================================================================
 *
 * Diminta pengguna: "tambahkan tundaan mediasi di jadwal mediasi, jadi
 * tundaannya itu terisi di SIPP". Formulirnya ringkas seperti Tunda sidang:
 * alasan, tanggal pertemuan berikutnya (hari libur tidak dapat dipilih), jam,
 * tempat, lalu PRATINJAU apa yang akan ditulis, lalu Simpan ke SIPP.
 *
 * Yang ditulis ke SIPP persis Tunda di SIPP (perkara_jadwal_mediasi: pertemuan
 * ini bertanda ditunda, pertemuan berikutnya lahir, dua baris Audit Trail) -
 * lihat aleta_bot/services/tundaMediasiService.js. Alasan dan keterangan tidak
 * punya kolom di SIPP, jadi hanya dicatat di riwayat ALETA.
 *
 * Penulisan HANYA terjadi saat tombol Simpan ke SIPP ditekan; pratinjau selalu
 * kering. Dirender lewat PORTAL ke document.body (induk ber-transform di dalam
 * tabel membuat "fixed" ikut induknya) - pola HasilMediasiDialog.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarClock, Eye, Save, X } from "lucide-react";

import { KabarDiantrekan, TanyaJamKerja, type PilihJamKerja } from "@/components/portal/pilihan-jam-kerja";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PemilihTanggalSidang } from "@/components/ui/pemilih-tanggal-sidang";
import { Textarea } from "@/components/ui/textarea";
import { apiPath } from "@/lib/base-path";
import { pesanGalatPortal } from "@/lib/pesan-galat-portal";
import {
  ALASAN_TUNDA_MEDIASI,
  LAINNYA_TUNDA_MEDIASI,
  PILIHAN_KEHADIRAN_SIPP,
  alasanTundaMediasi,
  peringatanTenggangTunda,
  tanggalUsulanTundaMediasi,
} from "@/lib/tunda-mediasi";

const ALAMAT = "/api/aleta-ecourt/tunda-mediasi";

export type BarisUntukTunda = {
  mediasiId: string;
  perkaraId: string;
  nomorPerkara: string;
  jenisPerkara?: string;
  tanggal: string;
  jam: string;
  tempat: string;
};

export type HasilTundaMediasi = {
  mediasiId: string;
  tanggalLama: string;
  tempatLama: string;
  tanggalBaru: string;
  tempatBaru: string;
  jam: string;
  sampaiJam: string;
  kehadiran: string;
};

type Akun = { username: string; namaLengkap: string } | null;

type Keadaan = {
  ok?: boolean;
  available?: boolean;
  alasan?: string;
  pesan?: string;
  boleh?: boolean;
  sebabTolak?: string;
  bolehAnda?: boolean;
  sebabAnda?: string;
  mediator?: string;
  pertemuan?: { id: number; urutan: number; tanggal: string; jam: string; sampaiJam: string; tempat: string; dihadiriOleh: string; kehadiran: string };
  jumlahPertemuan?: number;
  perluKehadiran?: boolean;
  usulanKehadiran?: string;
  penetapanMediator?: string;
  tenggat?: string;
  hariIni?: string;
  akun?: { panitera: Akun; mediator: Akun; hakim: Akun; paniteraGalat?: string };
};

type LangkahRencana = { tabel: string; aksi: string; keterangan: string };

type Jawaban = {
  ok?: boolean;
  available?: boolean;
  kering?: boolean;
  alasan?: string;
  pesan?: string;
  kode?: string;
  perluPilihan?: boolean;
  diantrekan?: boolean;
  dikerjakanPada?: string;
  baru?: { urutan: number; tanggal: string; tempat: string; jam: string; sampaiJam: string };
  lama?: { tanggal: string; tempat: string };
  kehadiran?: { nilai: string; label: string; diisiSekarang: boolean };
  peringatan?: string[];
  atasNama?: { username: string; namaLengkap: string; sebagai: string };
  rencana?: LangkahRencana[];
  selesai?: LangkahRencana[];
};

async function bukaBungkus<T>(balasan: Response): Promise<{ status: number; isi: T; mentah: unknown }> {
  const mentah = await balasan.json().catch(() => ({}));
  return { status: balasan.status, isi: ((mentah as { data?: T })?.data ?? ({} as T)) as T, mentah };
}

const kelasKotak = "h-8 w-full rounded-md border bg-background px-2 text-sm";

export function TundaMediasiDialog({
  baris,
  onTutup,
  onBerhasil,
}: {
  baris: BarisUntukTunda;
  onTutup: () => void;
  /** Dipanggil sesudah SIPP ditulis (bukan saat diantrekan) - layar memperbarui daftarnya. */
  onBerhasil?: (hasil: HasilTundaMediasi) => void;
}) {
  const tanggalAsal = baris.tanggal.slice(0, 10);
  const [keadaan, setKeadaan] = useState<Keadaan | null>(null);
  const [galatMuat, setGalatMuat] = useState("");

  const [alasanKunci, setAlasanKunci] = useState("");
  const [alasanKetik, setAlasanKetik] = useState("");
  const [tanggalBaru, setTanggalBaru] = useState("");
  const [jam, setJam] = useState("");
  const [sampaiJam, setSampaiJam] = useState("");
  const [tempat, setTempat] = useState(baris.tempat || "");
  const [keterangan, setKeterangan] = useState("");
  const [kehadiran, setKehadiran] = useState("");
  const [atasNama, setAtasNama] = useState<"panitera" | "mediator" | "hakim">("panitera");

  const [hasil, setHasil] = useState<Jawaban | null>(null);
  const [tanyaJam, setTanyaJam] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [sudahTertulis, setSudahTertulis] = useState(false);

  useEffect(() => {
    let batal = false;
    void (async () => {
      try {
        const kueri = new URLSearchParams({ mediasiId: baris.mediasiId, tanggal: tanggalAsal });
        const jawaban = await fetch(apiPath(`${ALAMAT}?${kueri.toString()}`), { cache: "no-store" });
        const { status, isi, mentah } = await bukaBungkus<Keadaan>(jawaban);
        if (batal) return;
        if (!jawaban.ok) throw new Error(pesanGalatPortal(mentah, `Keadaan pertemuan tidak terbaca (${status}).`));
        if (isi.available === false || isi.ok === false) {
          setGalatMuat(String(isi.alasan || isi.pesan || "Keadaan pertemuan tidak terbaca."));
          return;
        }
        setKeadaan(isi);
        const lama = isi.pertemuan;
        setTempat((sekarang) => sekarang || lama?.tempat || "");
        setTanggalBaru(tanggalUsulanTundaMediasi(lama?.tanggal || tanggalAsal, isi.hariIni || tanggalAsal));
        setJam(lama?.jam || "");
        if (isi.perluKehadiran && isi.usulanKehadiran) setKehadiran(isi.usulanKehadiran);
        // Bawaan akun: PP perkara (keputusan 7 Okt); bila PP tidak dapat dipakai, mediator lalu ketua majelis.
        const akun = isi.akun;
        if (akun?.panitera) setAtasNama("panitera");
        else if (akun?.mediator) setAtasNama("mediator");
        else if (akun?.hakim) setAtasNama("hakim");
      } catch (e) {
        if (!batal) setGalatMuat(pesanGalatPortal(e, "Keadaan pertemuan tidak terbaca."));
      }
    })();
    return () => {
      batal = true;
    };
  }, [baris.mediasiId, tanggalAsal]);

  useEffect(() => {
    const tekan = (e: KeyboardEvent) => {
      if (e.key === "Escape") onTutup();
    };
    window.addEventListener("keydown", tekan);
    return () => window.removeEventListener("keydown", tekan);
  }, [onTutup]);

  // Mengubah isian apa pun membatalkan pratinjau: yang disimpan harus yang terlihat.
  const sentuh = useCallback(() => {
    setHasil(null);
    setTanyaJam(null);
  }, []);

  const alasanAkhir = alasanTundaMediasi(alasanKunci, alasanKetik);
  const perluKehadiran = keadaan?.perluKehadiran === true;
  const lengkap = useMemo(
    () => Boolean(alasanAkhir && tanggalBaru && tempat.trim() && (!perluKehadiran || kehadiran)),
    [alasanAkhir, tanggalBaru, tempat, perluKehadiran, kehadiran]
  );
  const peringatan = peringatanTenggangTunda(tanggalBaru, keadaan?.tenggat || "");
  const boleh = keadaan?.boleh === true && keadaan?.bolehAnda === true;

  const kirim = async (kering: boolean, pilihJam?: PilihJamKerja) => {
    setSibuk(true);
    if (kering) setHasil(null);
    try {
      const muatan = {
        mediasiId: baris.mediasiId,
        tanggal: tanggalAsal,
        tanggalBaru,
        tempat: tempat.trim(),
        jam,
        sampaiJam,
        kehadiran: perluKehadiran ? kehadiran : "",
        alasan: alasanAkhir,
        keterangan: keterangan.trim(),
        atasNama,
        kering,
      };
      const jawaban = await fetch(apiPath(ALAMAT), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(kering ? muatan : { ...muatan, tanyaJamKerja: true, ...(pilihJam ? { jamKerja: pilihJam } : {}) }),
      });
      const { status, isi, mentah } = await bukaBungkus<Jawaban>(jawaban);
      if (!jawaban.ok) {
        setHasil({ ok: false, alasan: pesanGalatPortal(mentah, `Penundaan ditolak (${status}).`) });
        return;
      }
      if (isi.perluPilihan || isi.kode === "di_luar_jam_kerja") {
        setTanyaJam(isi.pesan || isi.alasan || "");
        return;
      }
      setTanyaJam(null);
      setHasil(isi);
      if (isi.ok && kering === false) {
        setSudahTertulis(true);
        if (!isi.diantrekan && isi.baru) {
          onBerhasil?.({
            mediasiId: baris.mediasiId,
            tanggalLama: tanggalAsal,
            tempatLama: keadaan?.pertemuan?.tempat || baris.tempat || "",
            tanggalBaru: isi.baru.tanggal,
            tempatBaru: isi.baru.tempat,
            jam: isi.baru.jam,
            sampaiJam: isi.baru.sampaiJam,
            kehadiran: isi.kehadiran?.diisiSekarang ? isi.kehadiran.nilai : "",
          });
        }
      }
    } catch (e) {
      setHasil({ ok: false, alasan: e instanceof Error ? e.message : "Permintaan gagal." });
    } finally {
      setSibuk(false);
    }
  };

  if (typeof document === "undefined") return null;

  const pratinjauSiap = hasil?.ok === true && hasil.kering === true;
  const akun = keadaan?.akun;
  const pilihanAkun: Array<{ nilai: "panitera" | "mediator" | "hakim"; label: string; akun: Akun }> = [
    { nilai: "panitera", label: "Panitera pengganti perkara", akun: akun?.panitera ?? null },
    { nilai: "mediator", label: "Mediator (hakim)", akun: akun?.mediator ?? null },
    { nilai: "hakim", label: "Ketua majelis", akun: akun?.hakim ?? null },
  ];

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/40 p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Tunda mediasi ${baris.nomorPerkara}`}
      onClick={onTutup}
    >
      <div
        className="my-4 w-full max-w-2xl rounded-lg border bg-card p-4 text-card-foreground shadow-lg"
        onClick={(e) => e.stopPropagation()}
        data-tunda-mediasi=""
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h3 className="flex items-center gap-2 text-base font-semibold">
              <CalendarClock className="h-4 w-4" /> Tunda mediasi
            </h3>
            <p className="text-sm text-muted-foreground">
              {baris.nomorPerkara}
              {baris.jenisPerkara ? ` · ${baris.jenisPerkara}` : ""}
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={onTutup} aria-label="Tutup">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {!keadaan && !galatMuat ? <div className="min-h-[1.25rem]" aria-busy="true" /> : null}
        {galatMuat ? (
          <p className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-300" role="alert">
            {galatMuat}
          </p>
        ) : null}

        {keadaan ? (
          <div className="space-y-3 text-sm">
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs" data-pertemuan-sekarang="">
              <div className="font-medium">Pertemuan yang ditunda</div>
              <div className="text-muted-foreground">
                {keadaan.pertemuan?.tanggal || tanggalAsal}
                {keadaan.pertemuan?.jam ? ` · ${keadaan.pertemuan.jam}` : ""}
                {keadaan.pertemuan?.sampaiJam ? ` s.d. ${keadaan.pertemuan.sampaiJam}` : ""}
                {keadaan.pertemuan?.tempat ? ` · ${keadaan.pertemuan.tempat}` : ""}
              </div>
              <div className="text-muted-foreground">
                Pertemuan ke-{keadaan.pertemuan?.urutan ?? 1} dari {keadaan.jumlahPertemuan ?? 1}
                {keadaan.pertemuan?.kehadiran ? ` · dihadiri: ${keadaan.pertemuan.kehadiran}` : ""}
              </div>
            </div>

            {!boleh ? (
              <p
                className="rounded-md border border-amber-400/60 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100"
                role="alert"
                data-tunda-mediasi-ditolak=""
              >
                {keadaan.boleh !== true ? keadaan.sebabTolak || "Pertemuan ini tidak dapat ditunda." : keadaan.sebabAnda || "Anda tidak berhak menunda mediasi ini."}
              </p>
            ) : (
              <>
                <label className="block text-xs">
                  <span className="mb-0.5 block font-medium text-muted-foreground">Alasan penundaan</span>
                  <select
                    value={alasanKunci}
                    onChange={(e) => {
                      sentuh();
                      setAlasanKunci(e.target.value);
                    }}
                    className={kelasKotak}
                    aria-label="Alasan penundaan"
                  >
                    <option value="">- pilih alasan -</option>
                    {ALASAN_TUNDA_MEDIASI.map((a) => (
                      <option key={a.kunci} value={a.kunci}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                </label>
                {alasanKunci ? (
                  <label className="block text-xs">
                    <span className="mb-0.5 block font-medium text-muted-foreground">
                      {alasanKunci === LAINNYA_TUNDA_MEDIASI ? "Tulis alasannya" : "Tambahan (boleh dikosongkan)"}
                    </span>
                    <Input
                      value={alasanKetik}
                      maxLength={200}
                      onChange={(e) => {
                        sentuh();
                        setAlasanKetik(e.target.value);
                      }}
                      aria-label="Alasan ketikan"
                    />
                    <span className="mt-0.5 block text-[10px] leading-tight text-muted-foreground">
                      Alasan dicatat di riwayat ALETA saja - SIPP tidak punya kolom alasan untuk penundaan mediasi.
                    </span>
                  </label>
                ) : null}

                {perluKehadiran ? (
                  <label className="block text-xs">
                    <span className="mb-0.5 block font-medium text-muted-foreground">Kehadiran pihak pada pertemuan ini</span>
                    <select
                      value={kehadiran}
                      onChange={(e) => {
                        sentuh();
                        setKehadiran(e.target.value);
                      }}
                      className={kelasKotak}
                      aria-label="Kehadiran pihak"
                    >
                      <option value="">- pilih kehadiran -</option>
                      {PILIHAN_KEHADIRAN_SIPP.map((k) => (
                        <option key={k.nilai} value={k.nilai}>
                          {k.label}
                        </option>
                      ))}
                    </select>
                    <span className="mt-0.5 block text-[10px] leading-tight text-muted-foreground">
                      SIPP baru menampilkan Tunda sesudah kehadiran pihak diisi, jadi ia ikut diisi sekarang
                      {keadaan.usulanKehadiran ? " (usulan dari catatan kehadiran ALETA)." : "."}
                    </span>
                  </label>
                ) : null}

                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="text-xs sm:col-span-1">
                    <span className="mb-0.5 block font-medium text-muted-foreground">Tanggal berikutnya</span>
                    <PemilihTanggalSidang
                      value={tanggalBaru}
                      onChange={(v) => {
                        sentuh();
                        setTanggalBaru(v);
                      }}
                      min={keadaan.pertemuan?.tanggal || tanggalAsal}
                      sebutan="Tanggal mediasi berikutnya"
                      aria-label="Tanggal mediasi berikutnya"
                      usulan={tanggalUsulanTundaMediasi(keadaan.pertemuan?.tanggal || tanggalAsal, keadaan.hariIni || tanggalAsal)}
                      className={kelasKotak}
                    />
                  </label>
                  <label className="text-xs">
                    <span className="mb-0.5 block font-medium text-muted-foreground">Jam mulai</span>
                    <input
                      type="time"
                      value={jam}
                      onChange={(e) => {
                        sentuh();
                        setJam(e.target.value);
                      }}
                      className={kelasKotak}
                      aria-label="Jam mulai"
                    />
                  </label>
                  <label className="text-xs">
                    <span className="mb-0.5 block font-medium text-muted-foreground">Sampai jam</span>
                    <input
                      type="time"
                      value={sampaiJam}
                      onChange={(e) => {
                        sentuh();
                        setSampaiJam(e.target.value);
                      }}
                      className={kelasKotak}
                      aria-label="Sampai jam"
                    />
                  </label>
                </div>
                {peringatan ? (
                  <p className="rounded-md border border-amber-400/60 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100" data-peringatan-tenggang="">
                    {peringatan}
                  </p>
                ) : null}

                <label className="block text-xs">
                  <span className="mb-0.5 block font-medium text-muted-foreground">Tempat pelaksanaan mediasi berikutnya</span>
                  <Textarea
                    value={tempat}
                    maxLength={500}
                    rows={2}
                    onChange={(e) => {
                      sentuh();
                      setTempat(e.target.value);
                    }}
                    aria-label="Tempat pelaksanaan mediasi"
                  />
                </label>

                <label className="block text-xs">
                  <span className="mb-0.5 block font-medium text-muted-foreground">Keterangan (opsional, riwayat ALETA saja)</span>
                  <Input
                    value={keterangan}
                    maxLength={300}
                    onChange={(e) => {
                      sentuh();
                      setKeterangan(e.target.value);
                    }}
                    aria-label="Keterangan"
                  />
                </label>

                <label className="block text-xs">
                  <span className="mb-0.5 block font-medium text-muted-foreground">Tercatat di SIPP atas nama</span>
                  <select
                    value={atasNama}
                    onChange={(e) => {
                      sentuh();
                      setAtasNama(e.target.value as "panitera" | "mediator" | "hakim");
                    }}
                    className={kelasKotak}
                    aria-label="Dicatat atas nama"
                  >
                    {pilihanAkun.map((p) => (
                      <option key={p.nilai} value={p.nilai} disabled={!p.akun}>
                        {p.label}
                        {p.akun ? ` - ${p.akun.namaLengkap || p.akun.username}` : " - tidak tersedia"}
                      </option>
                    ))}
                  </select>
                  {!akun?.panitera && akun?.paniteraGalat ? (
                    <span className="mt-0.5 block text-[10px] leading-tight text-amber-700 dark:text-amber-300">{akun.paniteraGalat}</span>
                  ) : null}
                </label>

                {hasil && hasil.ok === false ? (
                  <p className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-300" role="alert" data-tunda-mediasi-galat="">
                    {hasil.alasan || hasil.pesan || "Penundaan ditolak."}
                  </p>
                ) : null}

                {pratinjauSiap ? (
                  <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs" data-pratinjau-tunda-mediasi="">
                    <div className="mb-1 font-medium">
                      Akan ditulis ke SIPP{hasil?.atasNama ? ` atas nama ${hasil.atasNama.namaLengkap || hasil.atasNama.username}` : ""}:
                    </div>
                    <ol className="list-decimal space-y-0.5 pl-4">
                      {(hasil?.rencana ?? []).map((l, i) => (
                        <li key={`${l.tabel}-${i}`}>
                          <span className="font-medium">{l.tabel}</span> ({l.aksi}) - {l.keterangan}
                        </li>
                      ))}
                    </ol>
                    {(hasil?.peringatan ?? []).map((p) => (
                      <p key={p} className="mt-1 text-amber-700 dark:text-amber-300">
                        {p}
                      </p>
                    ))}
                  </div>
                ) : null}

                {hasil?.ok === true && hasil.kering === false ? (
                  hasil.diantrekan ? (
                    <KabarDiantrekan pesan={hasil.pesan || "Diantrekan - dikerjakan pada jam kerja berikutnya."} />
                  ) : (
                    <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-300" data-tunda-mediasi-berhasil="">
                      Tersimpan di SIPP: pertemuan {tanggalAsal} ditandai ditunda, pertemuan berikutnya {hasil.baru?.tanggal}
                      {hasil.baru?.jam ? ` pukul ${hasil.baru.jam}` : ""} sudah terisi.
                    </p>
                  )
                ) : null}

                {tanyaJam !== null ? (
                  <TanyaJamKerja pesan={tanyaJam} sibuk={sibuk} bawaan="sekarang" onPilih={(p) => void kirim(false, p)} />
                ) : null}

                <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                  {sudahTertulis ? (
                    <Button size="sm" onClick={onTutup}>
                      Selesai
                    </Button>
                  ) : (
                    <>
                      <Button size="sm" variant="outline" disabled={sibuk || !lengkap} onClick={() => void kirim(true)} data-tombol-pratinjau-tunda="">
                        <Eye className="mr-1 h-4 w-4" /> Pratinjau
                      </Button>
                      <Button size="sm" disabled={sibuk || !pratinjauSiap || tanyaJam !== null} onClick={() => void kirim(false)} data-tombol-simpan-tunda="">
                        <Save className="mr-1 h-4 w-4" /> Simpan ke SIPP
                      </Button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        ) : null}
      </div>
    </div>,
    document.body
  );
}
