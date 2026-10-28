"use client";

/**
 * ============================================================================
 * ISI HASIL MEDIASI KE SIPP - POP-UP DI JADWAL MEDIASI (28 Okt 2026)
 * ============================================================================
 *
 * Diminta pengguna: "buat hasil mediasi serta isi form bagi yang perlu untuk
 * hasil mediasi dan di isi oleh akun PP". Isiannya = borang Edit Hasil Mediasi
 * SIPP: hasil, tanggal laporan mediator, (bila berhasil) tanggal dan isi
 * kesepakatan perdamaian, keterangan - ditambah kehadiran pertemuan terakhir
 * bila belum diisi (SIPP baru membuka borang hasil sesudahnya). Bawaan diambil
 * dari SIPP, lalu dari laporan hasil mediasi (.rtf) yang disusun mediator.
 *
 * Yang ditulis ke SIPP persis borang SIPP (aleta_bot/services/
 * hasilMediasiTulisService.js), tercatat atas akun panitera pengganti perkara
 * bawaannya. Penulisan HANYA saat Simpan ke SIPP; pratinjau selalu kering.
 * Dirender lewat PORTAL ke document.body - pola TundaMediasiDialog.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ClipboardCheck, Eye, Save, X } from "lucide-react";

import { KabarDiantrekan, TanyaJamKerja, type PilihJamKerja } from "@/components/portal/pilihan-jam-kerja";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiPath } from "@/lib/base-path";
import { PILIHAN_HASIL_SIPP, hasilBerkesepakatan, labelHasilSipp, type BawaanHasilSipp } from "@/lib/hasil-mediasi-sipp";
import { pesanGalatPortal } from "@/lib/pesan-galat-portal";
import { PILIHAN_KEHADIRAN_SIPP } from "@/lib/tunda-mediasi";

const ALAMAT = "/api/aleta-ecourt/hasil-mediasi-sipp";

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
  tanggalHasil?: string;
  hariIni?: string;
  jumlahPertemuan?: number;
  perluKehadiran?: boolean;
  usulanKehadiran?: string;
  sipp?: { hasil?: string; hasilLabel?: string; laporan?: string; diisiOleh?: string };
  bawaan?: BawaanHasilSipp;
  akun?: { panitera: Akun; mediator: Akun; hakim: Akun; paniteraGalat?: string };
};

type Jawaban = {
  ok?: boolean;
  kering?: boolean;
  alasan?: string;
  pesan?: string;
  kode?: string;
  perluPilihan?: boolean;
  diantrekan?: boolean;
  tanpaPerubahan?: boolean;
  hasil?: { kode: string; label: string };
  laporan?: string;
  tahapanSesudah?: { tahapan: string; proses: string } | null;
  peringatan?: string[];
  atasNama?: { username: string; namaLengkap: string; sebagai: string };
  rencana?: Array<{ tabel: string; aksi: string; keterangan: string }>;
};

export type HasilIsiMediasiSipp = { mediasiId: string; hasilKode: string; hasilLabel: string; laporan: string };

async function bukaBungkus<T>(balasan: Response): Promise<{ status: number; isi: T; mentah: unknown }> {
  const mentah = await balasan.json().catch(() => ({}));
  return { status: balasan.status, isi: ((mentah as { data?: T })?.data ?? ({} as T)) as T, mentah };
}

const kelasKotak = "h-8 w-full rounded-md border bg-background px-2 text-sm";

export function HasilMediasiSippDialog({
  mediasiId,
  nomorPerkara,
  jenisPerkara,
  onTutup,
  onBerhasil,
}: {
  mediasiId: string;
  nomorPerkara: string;
  jenisPerkara?: string;
  onTutup: () => void;
  onBerhasil?: (hasil: HasilIsiMediasiSipp) => void;
}) {
  const [keadaan, setKeadaan] = useState<Keadaan | null>(null);
  const [galatMuat, setGalatMuat] = useState("");
  const [hasilKode, setHasilKode] = useState("");
  const [laporan, setLaporan] = useState("");
  const [kesepakatan, setKesepakatan] = useState("");
  const [isi, setIsi] = useState("");
  const [keterangan, setKeterangan] = useState("");
  const [kehadiran, setKehadiran] = useState("");
  const [atasNama, setAtasNama] = useState<"panitera" | "mediator" | "hakim">("panitera");
  const [jawab, setJawab] = useState<Jawaban | null>(null);
  const [tanyaJam, setTanyaJam] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [sudahTertulis, setSudahTertulis] = useState(false);

  useEffect(() => {
    let batal = false;
    void (async () => {
      try {
        const jawaban = await fetch(apiPath(`${ALAMAT}?${new URLSearchParams({ mediasiId }).toString()}`), { cache: "no-store" });
        const { status, isi: data, mentah } = await bukaBungkus<Keadaan>(jawaban);
        if (batal) return;
        if (!jawaban.ok) throw new Error(pesanGalatPortal(mentah, `Data mediasi tidak terbaca (${status}).`));
        if (data.available === false || data.ok === false) {
          setGalatMuat(String(data.alasan || data.pesan || "Data mediasi tidak terbaca."));
          return;
        }
        setKeadaan(data);
        const b = data.bawaan;
        setHasilKode(b?.hasil || "");
        setLaporan(b?.tanggalLaporan || data.tanggalHasil || "");
        setKesepakatan(b?.tanggalKesepakatan || b?.tanggalLaporan || data.tanggalHasil || "");
        setIsi(b?.isiKesepakatan || "");
        if (data.perluKehadiran && data.usulanKehadiran) setKehadiran(data.usulanKehadiran);
        // Bawaan akun: PP perkara (permintaan pengguna 28 Okt); bila tidak ada, mediator lalu ketua majelis.
        const akun = data.akun;
        if (akun?.panitera) setAtasNama("panitera");
        else if (akun?.mediator) setAtasNama("mediator");
        else if (akun?.hakim) setAtasNama("hakim");
      } catch (e) {
        if (!batal) setGalatMuat(pesanGalatPortal(e, "Data mediasi tidak terbaca."));
      }
    })();
    return () => {
      batal = true;
    };
  }, [mediasiId]);

  useEffect(() => {
    const tekan = (e: KeyboardEvent) => {
      if (e.key === "Escape") onTutup();
    };
    window.addEventListener("keydown", tekan);
    return () => window.removeEventListener("keydown", tekan);
  }, [onTutup]);

  // Mengubah isian apa pun membatalkan pratinjau: yang disimpan harus yang terlihat.
  const sentuh = useCallback(() => {
    setJawab(null);
    setTanyaJam(null);
  }, []);

  const berkesepakatan = hasilBerkesepakatan(hasilKode);
  const perluKehadiran = keadaan?.perluKehadiran === true;
  const lengkap = useMemo(
    () =>
      Boolean(
        hasilKode &&
          laporan &&
          (!perluKehadiran || kehadiran) &&
          (!berkesepakatan || (kesepakatan && isi.trim().length >= 40)) &&
          (!keterangan.trim() || keterangan.trim().length >= 5)
      ),
    [hasilKode, laporan, perluKehadiran, kehadiran, berkesepakatan, kesepakatan, isi, keterangan]
  );
  const boleh = keadaan?.boleh === true && keadaan?.bolehAnda === true;

  const kirim = async (kering: boolean, pilihJam?: PilihJamKerja) => {
    setSibuk(true);
    if (kering) setJawab(null);
    try {
      const muatan = {
        mediasiId,
        hasil: hasilKode,
        tanggalLaporan: laporan,
        tanggalKesepakatan: berkesepakatan ? kesepakatan : "",
        isiKesepakatan: berkesepakatan ? isi : "",
        keterangan: keterangan.trim(),
        kehadiran: perluKehadiran ? kehadiran : "",
        atasNama,
        kering,
      };
      const jawaban = await fetch(apiPath(ALAMAT), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(kering ? muatan : { ...muatan, tanyaJamKerja: true, ...(pilihJam ? { jamKerja: pilihJam } : {}) }),
      });
      const { status, isi: data, mentah } = await bukaBungkus<Jawaban>(jawaban);
      if (!jawaban.ok) {
        setJawab({ ok: false, alasan: pesanGalatPortal(mentah, `Hasil mediasi ditolak (${status}).`) });
        return;
      }
      if (data.perluPilihan || data.kode === "di_luar_jam_kerja") {
        setTanyaJam(data.pesan || data.alasan || "");
        return;
      }
      setTanyaJam(null);
      setJawab(data);
      if (data.ok && kering === false) {
        setSudahTertulis(true);
        if (!data.diantrekan) {
          onBerhasil?.({ mediasiId, hasilKode, hasilLabel: labelHasilSipp(hasilKode), laporan });
        }
      }
    } catch (e) {
      setJawab({ ok: false, alasan: e instanceof Error ? e.message : "Permintaan gagal." });
    } finally {
      setSibuk(false);
    }
  };

  if (typeof document === "undefined") return null;

  const pratinjauSiap = jawab?.ok === true && jawab.kering === true;
  const akun = keadaan?.akun;
  const pilihanAkun: Array<{ nilai: "panitera" | "mediator" | "hakim"; label: string; akun: Akun }> = [
    { nilai: "panitera", label: "Panitera pengganti perkara", akun: akun?.panitera ?? null },
    { nilai: "mediator", label: "Mediator (hakim)", akun: akun?.mediator ?? null },
    { nilai: "hakim", label: "Ketua majelis", akun: akun?.hakim ?? null },
  ];
  const sumber = keadaan?.bawaan?.sumber;

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto tirai-latar p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Hasil mediasi ${nomorPerkara}`}
      onClick={onTutup}
    >
      <div
        className="my-4 w-full max-w-2xl rounded-lg border bg-card p-4 text-card-foreground shadow-lg"
        onClick={(e) => e.stopPropagation()}
        data-hasil-mediasi-sipp=""
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h3 className="flex items-center gap-2 text-base font-semibold">
              <ClipboardCheck className="h-4 w-4" /> Isi hasil mediasi ke SIPP
            </h3>
            <p className="text-sm text-muted-foreground">
              {nomorPerkara}
              {jenisPerkara ? ` · ${jenisPerkara}` : ""}
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
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs" data-hasil-sekarang="">
              <div>
                <span className="font-medium">Tanggal hasil mediasi:</span> {keadaan.tanggalHasil || "-"}{" "}
                <span className="text-muted-foreground">(pertemuan mediasi terakhir, {keadaan.jumlahPertemuan ?? 0} pertemuan)</span>
              </div>
              <div className="text-muted-foreground">
                Di SIPP sekarang:{" "}
                {keadaan.sipp?.hasilLabel
                  ? `${keadaan.sipp.hasilLabel}, laporan mediator ${keadaan.sipp.laporan || "-"}${keadaan.sipp.diisiOleh ? ` (diisi ${keadaan.sipp.diisiOleh})` : ""}`
                  : "belum ada hasil"}
              </div>
            </div>

            {!boleh ? (
              <p
                className="rounded-md border border-amber-400/60 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100"
                role="alert"
                data-hasil-mediasi-sipp-ditolak=""
              >
                {keadaan.boleh !== true ? keadaan.sebabTolak || "Hasil mediasi ini belum dapat diisi." : keadaan.sebabAnda || "Anda tidak berhak mengisi hasil mediasi ini."}
              </p>
            ) : (
              <>
                {sumber === "laporan-rtf" ? (
                  <p className="text-[11px] leading-tight text-muted-foreground" data-bawaan-rtf="">
                    Isian awal diambil dari laporan hasil mediasi (.rtf) yang disusun mediator. Periksa sebelum disimpan.
                  </p>
                ) : null}

                {perluKehadiran ? (
                  <label className="block text-xs">
                    <span className="mb-0.5 block font-medium text-muted-foreground">Kehadiran pihak pada pertemuan terakhir</span>
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
                      SIPP baru membuka isian hasil sesudah kehadiran pihak diisi, jadi ia ikut diisi sekarang
                      {keadaan.usulanKehadiran ? " (usulan dari catatan kehadiran ALETA)." : "."}
                    </span>
                  </label>
                ) : null}

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-xs">
                    <span className="mb-0.5 block font-medium text-muted-foreground">Hasil mediasi</span>
                    <select
                      value={hasilKode}
                      onChange={(e) => {
                        sentuh();
                        setHasilKode(e.target.value);
                      }}
                      className={kelasKotak}
                      aria-label="Hasil mediasi"
                    >
                      <option value="">- pilih hasil -</option>
                      {PILIHAN_HASIL_SIPP.map((p) => (
                        <option key={p.nilai} value={p.nilai}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-xs">
                    <span className="mb-0.5 block font-medium text-muted-foreground">Tanggal laporan mediator</span>
                    <input
                      type="date"
                      value={laporan}
                      min={keadaan.tanggalHasil || undefined}
                      max={keadaan.hariIni || undefined}
                      onChange={(e) => {
                        sentuh();
                        setLaporan(e.target.value);
                      }}
                      className={kelasKotak}
                      aria-label="Tanggal laporan mediator"
                    />
                  </label>
                </div>

                {berkesepakatan ? (
                  <>
                    <label className="block text-xs sm:w-1/2">
                      <span className="mb-0.5 block font-medium text-muted-foreground">Tanggal kesepakatan perdamaian</span>
                      <input
                        type="date"
                        value={kesepakatan}
                        max={laporan || keadaan.hariIni || undefined}
                        onChange={(e) => {
                          sentuh();
                          setKesepakatan(e.target.value);
                        }}
                        className={kelasKotak}
                        aria-label="Tanggal kesepakatan perdamaian"
                      />
                    </label>
                    <label className="block text-xs">
                      <span className="mb-0.5 block font-medium text-muted-foreground">Isi kesepakatan perdamaian</span>
                      <Textarea
                        value={isi}
                        rows={8}
                        onChange={(e) => {
                          sentuh();
                          setIsi(e.target.value);
                        }}
                        aria-label="Isi kesepakatan perdamaian"
                      />
                      <span className="mt-0.5 block text-[10px] leading-tight text-muted-foreground">
                        Paling sedikit 50 huruf. Baris &quot;Pasal 1&quot; ditebalkan dan butir &quot;1. ...&quot; menjadi daftar bernomor, seperti isian SIPP.
                      </span>
                    </label>
                  </>
                ) : null}

                <label className="block text-xs">
                  <span className="mb-0.5 block font-medium text-muted-foreground">Keterangan (opsional)</span>
                  <Input
                    value={keterangan}
                    maxLength={500}
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

                {jawab && jawab.ok === false ? (
                  <p className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-300" role="alert" data-hasil-mediasi-sipp-galat="">
                    {jawab.alasan || jawab.pesan || "Hasil mediasi ditolak."}
                  </p>
                ) : null}

                {pratinjauSiap ? (
                  <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs" data-pratinjau-hasil-mediasi-sipp="">
                    {jawab?.tanpaPerubahan ? (
                      <p>Isian ini sama persis dengan yang sudah tercatat di SIPP - tidak ada yang akan diubah.</p>
                    ) : (
                      <>
                        <div className="mb-1 font-medium">
                          Akan ditulis ke SIPP{jawab?.atasNama ? ` atas nama ${jawab.atasNama.namaLengkap || jawab.atasNama.username}` : ""}:
                        </div>
                        <ul className="list-disc space-y-0.5 pl-4">
                          {(jawab?.rencana ?? [])
                            .filter((l) => !/disegarkan|dibersihkan/.test(l.keterangan))
                            .map((l, i) => (
                              <li key={`${l.tabel}-${i}`}>{l.keterangan}</li>
                            ))}
                          <li>catatan riwayat perkara disusun ulang seperti SIPP</li>
                        </ul>
                        {jawab?.tahapanSesudah ? (
                          <p className="mt-1 text-muted-foreground">
                            Tahapan perkara sesudahnya: {jawab.tahapanSesudah.tahapan} - {jawab.tahapanSesudah.proses}
                          </p>
                        ) : null}
                      </>
                    )}
                    {(jawab?.peringatan ?? []).map((p) => (
                      <p key={p} className="mt-1 text-amber-700 dark:text-amber-300">
                        {p}
                      </p>
                    ))}
                  </div>
                ) : null}

                {jawab?.ok === true && jawab.kering === false ? (
                  jawab.diantrekan ? (
                    <KabarDiantrekan pesan={jawab.pesan || "Diantrekan - dikerjakan pada jam kerja berikutnya."} />
                  ) : (
                    <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-300" data-hasil-mediasi-sipp-berhasil="">
                      {jawab.tanpaPerubahan
                        ? "Tidak ada yang diubah - isian sudah sama dengan SIPP."
                        : `Tersimpan di SIPP: ${labelHasilSipp(hasilKode)}, laporan mediator ${laporan}.`}
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
                      <Button size="sm" variant="outline" disabled={sibuk || !lengkap} onClick={() => void kirim(true)} data-tombol-pratinjau-hasil-sipp="">
                        <Eye className="mr-1 h-4 w-4" /> Pratinjau
                      </Button>
                      <Button
                        size="sm"
                        disabled={sibuk || !pratinjauSiap || tanyaJam !== null || jawab?.tanpaPerubahan === true}
                        onClick={() => void kirim(false)}
                        data-tombol-simpan-hasil-sipp=""
                      >
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
