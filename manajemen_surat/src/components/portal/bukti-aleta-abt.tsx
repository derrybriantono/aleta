"use client";

import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { apiPath } from "@/lib/base-path";
import {
  bandingBaris,
  berkasUntukBukti,
  buktiDariAlinea,
  kalimatBaris,
  katalogDari,
  kolomBukti,
  PIL_COCOK,
  PIL_METERAI,
  tanggalIndo,
  type BarisBukti,
  type DataSipp,
} from "@/lib/bukti-tertulis";
import { bacaKeadaan, susunParagrafBukti, type BuktiMasuk, type JenisCerai } from "@/lib/sinkron-pertimbangan-bukti";

type Dokumen = { judul: string; documentKey: string };
type Bahan = DataSipp & { dokumen: Dokumen[] };
type Butir = { sisi: "P" | "T"; nomor: number; baris: BarisBukti; diperiksa: boolean };

/**
 * Pemeriksaan alat bukti tertulis di layar cetak ALETA ABT (6 Nov 2026). Bahannya kalimat bukti yang tertulis di pratinjau naskah; pembandingnya
 * data SIPP (rute bukti-sipp). Layar ini TIDAK menulis ke SIPP atau ABT: perubahan hanya tampil di sini dan kalimatnya dapat disalin. Penyimpanan
 * ke ABT tetap lewat kotak alat bukti di Blangko ABT by Derry Briantono.
 */
export function BuktiAletaAbt({ alinea, perkaraId, nomor, jenisPerkara = "" }: { alinea: ReadonlyArray<{ teks: string }>; perkaraId: string; nomor: string; jenisPerkara?: string }) {
  const dariNaskah = (l: ReadonlyArray<{ teks: string }>) => buktiDariAlinea(l).map((x) => ({ ...x, diperiksa: false }));
  const [sumber, setSumber] = useState(alinea);
  const [daftar, setDaftar] = useState<Butir[]>(() => dariNaskah(alinea));
  const [aktif, setAktif] = useState(0);
  const [bahan, setBahan] = useState<Bahan | null>(null);
  const [tersalin, setTersalin] = useState(false);

  // Pratinjau baru: daftar dibaca ulang dari naskah.
  if (sumber !== alinea) {
    setSumber(alinea);
    setDaftar(dariNaskah(alinea));
    setAktif(0);
  }

  useEffect(() => {
    let batal = false;
    const q = new URLSearchParams({ perkaraId, nomor });
    fetch(apiPath(`/api/aleta-ecourt/blangko-derry/bukti-sipp?${q.toString()}`), { cache: "no-store" })
      .then((r) => r.json())
      .then((j: { ok?: boolean; data?: Bahan }) => {
        if (!batal && j && j.ok && j.data) setBahan(j.data);
      })
      .catch(() => undefined);
    return () => {
      batal = true;
    };
  }, [perkaraId, nomor]);

  if (!daftar.length) return null;
  const b = daftar[Math.min(aktif, daftar.length - 1)];
  const r = b.baris;
  const urutanKtp = (i: number) => daftar.slice(0, i).filter((x) => x.sisi === daftar[i].sisi && katalogDari(x.baris.nm)?.kunci === "ktp").length;
  const banding = (i: number) => bandingBaris(daftar[i].baris, daftar[i].sisi, urutanKtp(i), bahan);
  const iAktif = daftar.indexOf(b);
  const hasil = banding(iAktif);
  const kol = kolomBukti(r.nm);
  const jenis = katalogDari(r.nm);
  const berkas = bahan ? berkasUntukBukti(r.nm, bahan.dokumen) : null;
  const jumlahBeda = daftar.reduce((n, _, i) => n + Object.values(banding(i)).filter((h) => h.keadaan === "beda").length, 0);
  const selesai = daftar.filter((x) => x.diperiksa).length;
  const kalimat = kalimatBaris(r, b.sisi, b.nomor - 1);
  const ubah = (kolom: keyof BarisBukti, nilai: string | number) =>
    setDaftar((l) => l.map((x, i) => (i === iAktif ? { ...x, baris: { ...x.baris, [kolom]: nilai } } : x)));

  const medan = (kolom: "nm" | "an" | "no" | "tgl" | "oleh", label: string, jenisInput = "text", contoh = "") => {
    const h = hasil[kolom];
    return (
      <div key={kolom} className="flex flex-col gap-1">
        <label className="text-sm font-medium" htmlFor={`bukti-${kolom}`}>
          {label}
        </label>
        <Input id={`bukti-${kolom}`} type={jenisInput} value={String(r[kolom] ?? "")} placeholder={contoh} onChange={(e) => ubah(kolom, e.target.value)} />
        {h?.keadaan === "sama" ? <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Sama dengan SIPP</p> : null}
        {h?.keadaan === "beda" ? (
          <div className="flex flex-wrap items-center gap-2 rounded-md bg-amber-100 px-2 py-1.5 text-xs font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-200">
            <span className="min-w-0 flex-1">Di SIPP tertulis {kolom === "tgl" ? tanggalIndo(h.sipp) : h.sipp}</span>
            {h.pakai !== null ? (
              <Button type="button" size="sm" variant="outline" onClick={() => ubah(kolom, h.pakai as string)}>
                Pakai data SIPP
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  };
  const pilihan = (kolom: "meterai" | "cocok", label: string, opsi: readonly string[]) => (
    <label className="flex flex-col gap-1 text-sm font-medium">
      {label}
      <select
        className="min-h-10 w-full rounded-md border border-input bg-background px-2 text-sm font-normal"
        value={String(r[kolom] ?? 0)}
        onChange={(e) => ubah(kolom, Number(e.target.value))}
      >
        {opsi.map((t, v) => (
          <option key={t} value={v}>
            {t}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Alat bukti tertulis</CardTitle>
        <CardDescription>
          Dibaca dari naskah di atas dan diadu dengan SIPP. Perubahan di sini tidak tersimpan ke ABT: salin kalimatnya, atau simpan lewat kotak alat bukti di Blangko ABT by Derry Briantono.
        </CardDescription>
        <div className="flex flex-wrap gap-2 pt-1">
          <Badge variant="success">
            {selesai} dari {daftar.length} sudah diperiksa
          </Badge>
          {jumlahBeda ? <Badge variant="warning">{jumlahBeda} isian berbeda dari SIPP</Badge> : null}
        </div>
      </CardHeader>
      <CardContent className="flex flex-wrap items-start gap-4">
        <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-1.5 lg:max-w-xs">
          {daftar.map((x, i) => {
            const beda = Object.values(banding(i)).filter((h) => h.keadaan === "beda").length;
            return (
              <button
                key={`${x.sisi}.${x.nomor}`}
                type="button"
                aria-current={i === iAktif}
                onClick={() => setAktif(i)}
                className={`flex min-h-11 gap-2.5 rounded-lg border p-2.5 text-left ${i === iAktif ? "border-primary bg-primary/10" : "border-border bg-card"}`}
              >
                <span className="w-8 flex-none text-sm font-bold text-primary">
                  {x.sisi}.{x.nomor}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{x.baris.nm || "Tanpa nama"}</span>
                  <span className="block text-xs text-muted-foreground">{x.diperiksa ? "Sudah diperiksa" : beda ? `${beda} isian berbeda dari SIPP` : "Belum diperiksa"}</span>
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-lg font-bold">
              <span className="text-primary">
                {b.sisi}.{b.nomor}
              </span>{" "}
              {r.nm}
            </p>
            {jenis ? <Badge variant="outline">{jenis.kuat}</Badge> : null}
          </div>
          <div className="flex flex-wrap gap-4">
            <div className="flex min-h-48 min-w-0 flex-[1_1_240px] items-center justify-center rounded-lg border border-dashed border-border p-2 text-center text-sm text-muted-foreground">
              {berkas ? (
                <div className="w-full">
                  <iframe title={`Pindaian ${berkas.judul}`} className="h-80 w-full rounded" src={apiPath(`/api/aleta-ecourt/berkas?documentKey=${encodeURIComponent(berkas.documentKey)}&format=pdf&tampil=1`)} />
                  <a className="text-xs underline" target="_blank" rel="noreferrer" href={apiPath(`/api/aleta-ecourt/berkas?documentKey=${encodeURIComponent(berkas.documentKey)}&format=pdf&tampil=1`)}>
                    Buka {berkas.judul} di tab baru
                  </a>
                </div>
              ) : (
                "Pindaian bukti ini belum ada di arsip e-Court."
              )}
            </div>
            {typeof r.manual === "string" ? (
              <p className="min-w-0 flex-[2_1_320px] text-sm text-muted-foreground">Bukti ini tertulis sebagai kalimat bebas di naskah.</p>
            ) : (
              <div className="flex min-w-0 flex-[2_1_320px] flex-col gap-3">
                {medan("an", kol.an)}
                {medan("no", kol.no, "text", kol.contohNo)}
                {medan("tgl", kol.tgl, "date")}
                {medan("oleh", "Dikeluarkan oleh")}
              </div>
            )}
          </div>
          {typeof r.manual === "string" ? null : (
            <div className="grid gap-3 sm:grid-cols-2">
              {pilihan("meterai", "Meterai", PIL_METERAI)}
              {pilihan("cocok", "Dicocokkan dengan aslinya", PIL_COCOK)}
            </div>
          )}
          <div className="rounded-lg bg-muted/50 px-4 py-3 font-serif text-base leading-relaxed">{kalimat}</div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void navigator.clipboard
                  .writeText(kalimat)
                  .then(() => setTersalin(true))
                  .catch(() => setTersalin(false));
              }}
            >
              {tersalin ? "Tersalin" : "Salin kalimat"}
            </Button>
            <Button type="button" onClick={() => setDaftar((l) => l.map((x, i) => (i === iAktif ? { ...x, diperiksa: !x.diperiksa } : x)))}>
              {b.diperiksa ? "Batalkan tanda selesai" : "Tandai sudah diperiksa"}
            </Button>
          </div>
        </div>
      </CardContent>
      <PertimbanganBukti daftar={daftar} alinea={alinea} jenisPerkara={jenisPerkara} tglNikah={bahan?.nikah?.tglNikah} />
    </Card>
  );
}

const PILIHAN_STATUS = [
  { nilai: "", teks: "Belum dipilih" },
  { nilai: "Dikabulkan", teks: "Dikabulkan" },
  { nilai: "Ditolak", teks: "Ditolak" },
  { nilai: "Tidak Dapat Diterima", teks: "Tidak dapat diterima" },
  { nilai: "Dicabut", teks: "Dicabut" },
  { nilai: "Gugur", teks: "Gugur atau digugurkan" },
  { nilai: "Perdamaian", teks: "Berakhir damai" },
];
const PILIHAN_AGENDA = [
  { nilai: 0, teks: "Sebelum ada pembuktian" },
  { nilai: 1, teks: "Pada pembuktian pertama" },
  { nilai: 2, teks: "Pada pembuktian kedua" },
];

/** Keadaan putusan yang tertulis di naskah, sebagai tebakan awal yang bisa diubah. */
function bacaDariNaskah(alinea: ReadonlyArray<{ teks: string }>): { status: string; verstek: boolean } {
  const t = alinea.map((a) => a.teks).join("\n");
  const status = /tidak dapat diterima/i.test(t) ? "Tidak Dapat Diterima" : /mencabut|dicabut/i.test(t) ? "Dicabut" : /menolak/i.test(t) ? "Ditolak" : /mengabulkan/i.test(t) ? "Dikabulkan" : "";
  return { status, verstek: /verstek|tidak pernah hadir/i.test(t) };
}

/**
 * Pertimbangan dari alat bukti (cerai gugat dan cerai talak). Bunyi dari Blangko ABT by Derry Briantono lewat kartu aturan; layar ini hanya
 * menampilkan dan menyalin, tidak menyisipkan ke naskah dan tidak menulis ke SIPP atau ABT.
 */
function PertimbanganBukti({ daftar, alinea, jenisPerkara, tglNikah }: { daftar: Butir[]; alinea: ReadonlyArray<{ teks: string }>; jenisPerkara: string; tglNikah?: string }) {
  const awal = useMemo(() => bacaDariNaskah(alinea), [alinea]);
  const [status, setStatus] = useState(awal.status);
  const [verstek, setVerstek] = useState(awal.verstek);
  const [lawanMembantah, setLawanMembantah] = useState(false);
  const [agenda, setAgenda] = useState(0);
  const [dipilih, setDipilih] = useState<ReadonlySet<string>>(new Set());
  const [tersalin, setTersalin] = useState(false);
  const jenisCerai: JenisCerai | null = /talak/i.test(jenisPerkara) ? "CT" : /cerai/i.test(jenisPerkara) ? "CG" : null;

  const masuk: BuktiMasuk[] = daftar.map((x) => ({ sisi: x.sisi, nomor: x.nomor, baris: x.baris }));
  const hasil = useMemo(
    () =>
      jenisCerai
        ? susunParagrafBukti({ jenisCerai, status, verstek, lawanHadir: !verstek, lawanMembantah, agendaPembuktianKe: agenda, bukti: masuk, konteks: { tglNikah } })
        : null,
    // masuk dibuat ulang tiap render; isi daftar yang menentukan.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [jenisCerai, status, verstek, lawanMembantah, agenda, daftar, tglNikah]
  );
  if (!jenisCerai || !hasil) return null;

  const otomatis = hasil.paragraf.filter((p) => p.cara === "otomatis");
  const usulan = hasil.paragraf.filter((p) => p.cara === "usulan");
  const kunciUsulan = (p: { kode: string; bunyi: string }, i: number) => `${i}|${p.kode}|${p.bunyi.slice(0, 40)}`;
  const terpilih = usulan.filter((p, i) => dipilih.has(kunciUsulan(p, i)));
  const salinan = [...otomatis, ...terpilih].map((p) => p.bunyi).join("\n\n");
  const bacaan = bacaKeadaan(status, verstek);
  const bisaLawanBantah = !verstek && (bacaan.kunci === "kabul" || bacaan.kunci === "cabut");

  return (
    <CardContent className="flex flex-col gap-4 border-t border-border pt-4">
      <div>
        <p className="text-lg font-bold">Pertimbangan dari alat bukti</p>
        <p className="text-sm text-muted-foreground">
          Paragraf disusun dari bunyi Blangko ABT by Derry Briantono menurut keadaan putusan dan isian bukti di atas. Belum disisipkan ke naskah cetak: salin lalu tempel bila cocok.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Keadaan putusan
          <NativeSelect value={status} onChange={(e) => setStatus(e.target.value)}>
            {PILIHAN_STATUS.map((o) => (
              <option key={o.nilai} value={o.nilai}>
                {o.teks}
              </option>
            ))}
          </NativeSelect>
          <span className="text-xs font-normal text-muted-foreground">{status ? `Terbaca: ${hasil.keadaan}` : "Pilih keadaan putusan agar paragraf tersusun."}</span>
        </label>
        {bacaan.kunci === "cabut" ? (
          <label className="flex flex-col gap-1 text-sm font-medium">
            Perkara dicabut
            <NativeSelect value={String(agenda)} onChange={(e) => setAgenda(Number(e.target.value))}>
              {PILIHAN_AGENDA.map((o) => (
                <option key={o.nilai} value={o.nilai}>
                  {o.teks}
                </option>
              ))}
            </NativeSelect>
          </label>
        ) : null}
        <label className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-border px-3 text-sm font-medium">
          Lawan tidak hadir (verstek)
          <Switch checked={verstek} onCheckedChange={setVerstek} aria-label="Lawan tidak hadir (verstek)" />
        </label>
        {bisaLawanBantah ? (
          <label className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-border px-3 text-sm font-medium">
            Lawan membantah
            <Switch checked={lawanMembantah} onCheckedChange={setLawanMembantah} aria-label="Lawan membantah" />
          </label>
        ) : null}
      </div>
      {hasil.catatan.map((c) => (
        <p key={c} className="rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
          {c}
        </p>
      ))}
      {otomatis.length ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold">Tertulis otomatis</p>
          {otomatis.map((p, i) => (
            <div key={`${p.kode}-${i}`} className="rounded-lg bg-muted/50 px-4 py-3 font-serif text-base leading-relaxed">
              {p.bunyi}
              <span className="mt-1 block font-sans text-xs text-muted-foreground">Bukti {p.kode}. Dari {p.asal}</span>
            </div>
          ))}
        </div>
      ) : null}
      {usulan.length ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold">Usulan, centang yang dipakai</p>
          {usulan.map((p, i) => {
            const k = kunciUsulan(p, i);
            return (
              <label key={k} className="flex cursor-pointer items-start gap-3 rounded-lg border border-border px-3 py-2.5">
                <input
                  type="checkbox"
                  className="mt-1 size-5 flex-none"
                  checked={dipilih.has(k)}
                  onChange={(e) =>
                    setDipilih((s) => {
                      const n = new Set(s);
                      if (e.target.checked) n.add(k);
                      else n.delete(k);
                      return n;
                    })
                  }
                />
                <span className="min-w-0 font-serif text-base leading-relaxed">
                  {p.bunyi}
                  <span className="mt-1 block font-sans text-xs text-muted-foreground">Bukti {p.kode}. Dari {p.asal}</span>
                </span>
              </label>
            );
          })}
        </div>
      ) : null}
      {hasil.belumAdaBunyi.length ? (
        <div className="rounded-lg border border-amber-300 bg-amber-100 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          <p className="font-semibold">Belum ada bunyinya di blangko</p>
          <ul className="list-disc pl-5">
            {hasil.belumAdaBunyi.map((b) => (
              <li key={`${b.kode}-${b.alasan}`}>
                {b.kode} {b.nama}: {b.alasan}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={!salinan}
          onClick={() => {
            void navigator.clipboard
              .writeText(salinan)
              .then(() => setTersalin(true))
              .catch(() => setTersalin(false));
          }}
        >
          {tersalin ? "Tersalin" : "Salin pertimbangan"}
        </Button>
      </div>
    </CardContent>
  );
}
