"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LoaderCircle, Search, Sparkles, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { apiPath } from "@/lib/base-path";
import type { AturanElemen, AturanTampilanSipp, ElemenBerlaku, HalamanSipp, JenisElemen, LingkupAturan } from "@/lib/tampilan-sipp";

/**
 * Layar Admin "Tampilan SIPP per peran" (28 Okt 2026): matriks elemen x peran. Tiap sel diklik berganti
 * Ikut bawaan -> Nyala -> Mati -> Selalu -> Tidak tersedia, dan tersimpan langsung untuk peran itu.
 * Penimpaan per pegawai di kolom "Akun terpilih" beserta pratinjau tampilan yang berlaku baginya.
 * Hak: aksi "tampilan-sipp.atur" (Super Admin & Admin), ditegakkan juga di server.
 */

type ElemenKatalog = { kunci: string; halaman: HalamanSipp; nama: string; jelas: string; contoh: string; jenis: JenisElemen; lazim: string[] };
type Baris = { lingkup: LingkupAturan; sasaran: string; aturan: AturanTampilanSipp; catatan: string; diubahOleh: string; diubahPada: string; labelSasaran: string };
type Data = {
  halaman: Record<HalamanSipp, string>;
  katalog: ElemenKatalog[];
  golongan: Array<{ id: string; label: string }>;
  aturan: Baris[];
  pegawai: Array<{ id: string; nama: string; golongan: string[] }>;
  usulan: Record<string, AturanTampilanSipp>;
  bolehUbahSuperAdmin: boolean;
  pratinjau: { penggunaId: string; nama: string; golongan: string[]; berlaku: ElemenBerlaku[] } | null;
};

async function ambil<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(apiPath(url), { credentials: "include", cache: "no-store", ...init, headers: { "content-type": "application/json" } });
  const j = (await r.json().catch(() => null)) as { ok?: boolean; data?: T; error?: { message?: string } } | null;
  if (!r.ok || !j?.ok) throw new Error(j?.error?.message ?? "Data belum dapat dimuat.");
  return j.data as T;
}

const ALAMAT = "/api/admin/tampilan-sipp";

type Keadaan = "ikut" | "nyala" | "mati" | "selalu" | "tidak";
const URUTAN: Keadaan[] = ["ikut", "nyala", "mati", "selalu", "tidak"];
const LABEL: Record<Keadaan, string> = { ikut: "Ikut bawaan", nyala: "Nyala", mati: "Mati", selalu: "Selalu", tidak: "Tidak ada" };
const PENJELASAN: Record<Keadaan, string> = {
  ikut: "Belum diatur - memakai bawaan di atasnya (peran, lalu bawaan sistem: tampil).",
  nyala: "Tampil sebagai bawaan; pengguna boleh menyembunyikannya.",
  mati: "Tersembunyi sebagai bawaan; pengguna boleh menyalakannya.",
  selalu: "Selalu tampil; pengguna tidak dapat menyembunyikannya.",
  tidak: "Tidak tersedia; pengguna tidak dapat menyalakannya.",
};
const WARNA: Record<Keadaan, "muted" | "success" | "warning" | "info" | "danger"> = { ikut: "muted", nyala: "success", mati: "warning", selalu: "info", tidak: "danger" };

function keadaanDari(a: AturanElemen | undefined): Keadaan {
  if (!a) return "ikut";
  if (a.mode === "selalu") return "selalu";
  if (a.mode === "tidak") return "tidak";
  return a.bawaan ? "nyala" : "mati";
}

function aturanDari(k: Keadaan): AturanElemen | null {
  if (k === "ikut") return null;
  if (k === "selalu") return { mode: "selalu", bawaan: true };
  if (k === "tidak") return { mode: "tidak", bawaan: false };
  return { mode: "boleh", bawaan: k === "nyala" };
}

function Sel({ k, onKlik, mati, label }: { k: Keadaan; onKlik: () => void; mati?: boolean; label: string }) {
  return (
    <button type="button" onClick={onKlik} disabled={mati} title={`${label}: ${LABEL[k]}. ${PENJELASAN[k]} Klik untuk mengganti.`} className="disabled:cursor-not-allowed disabled:opacity-50" data-keadaan={k}>
      <Badge variant={WARNA[k]} className="whitespace-nowrap">{LABEL[k]}</Badge>
    </button>
  );
}

export function TampilanSippAdmin() {
  const [data, setData] = useState<Data | null>(null);
  const [galat, setGalat] = useState("");
  const [kabar, setKabar] = useState("");
  const [cari, setCari] = useState("");
  const [halaman, setHalaman] = useState<string>("");
  const [pegawai, setPegawai] = useState("");
  const [sibuk, setSibuk] = useState(false);

  const muat = useCallback(async (pratinjau?: string) => {
    try {
      setData(await ambil<Data>(`${ALAMAT}${pratinjau ? `?pratinjau=${encodeURIComponent(pratinjau)}` : ""}`));
      setGalat("");
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Data belum dapat dimuat.");
    }
  }, []);

  useEffect(() => {
    void muat(pegawai || undefined);
  }, [muat, pegawai]);

  const aturanOf = useCallback(
    (lingkup: LingkupAturan, sasaran: string): AturanTampilanSipp => data?.aturan.find((b) => b.lingkup === lingkup && b.sasaran === sasaran)?.aturan ?? {},
    [data]
  );

  const simpan = useCallback(
    async (lingkup: LingkupAturan, sasaran: string, aturan: AturanTampilanSipp, pesan: string) => {
      setSibuk(true);
      try {
        await ambil(ALAMAT, { method: "PUT", body: JSON.stringify({ lingkup, sasaran, aturan }) });
        await muat(pegawai || undefined);
        setKabar(pesan);
        setGalat("");
      } catch (e) {
        setGalat(e instanceof Error ? e.message : "Belum tersimpan.");
      } finally {
        setSibuk(false);
      }
    },
    [muat, pegawai]
  );

  const putar = useCallback(
    (lingkup: LingkupAturan, sasaran: string, labelSasaran: string, kunci: string, nama: string) => {
      const lama = aturanOf(lingkup, sasaran);
      const k = keadaanDari(lama[kunci]);
      const berikut = URUTAN[(URUTAN.indexOf(k) + 1) % URUTAN.length];
      const baru: AturanTampilanSipp = { ...lama };
      const a = aturanDari(berikut);
      if (a) baru[kunci] = a;
      else delete baru[kunci];
      void simpan(lingkup, sasaran, baru, `${nama} untuk ${labelSasaran}: ${LABEL[berikut]}. Tersimpan.`);
    },
    [aturanOf, simpan]
  );

  const kata = cari.trim().toLowerCase();
  const daftar = useMemo(
    () => (data?.katalog ?? []).filter((el) => (!halaman || el.halaman === halaman) && (!kata || `${el.nama} ${el.jelas}`.toLowerCase().includes(kata))),
    [data, halaman, kata]
  );

  if (!data) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
          {galat ? galat : (
            <>
              <LoaderCircle className="h-4 w-4 animate-spin" /> Memuat matriks tampilan...
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  const pegawaiTerpilih = data.pegawai.find((p) => p.id === pegawai) ?? null;
  const berlakuPratinjau = new Map((data.pratinjau?.berlaku ?? []).map((b) => [b.kunci, b]));
  const bolehKolom = (g: string) => g !== "super-admin" || data.bolehUbahSuperAdmin;

  return (
    <div className="space-y-6" data-tampilan-sipp-admin>
      <Card>
        <CardHeader>
          <CardTitle>Matriks tampilan ALETA di halaman SIPP</CardTitle>
          <CardDescription>
            Tentukan bagian ALETA mana yang tampil di SIPP untuk tiap peran, lalu timpa per pegawai bila perlu. Tiap sel diklik untuk berganti dan langsung tersimpan.
            Urutan yang berlaku: aturan pegawai, lalu aturan perannya, lalu bawaan sistem (tampil). Pegawai dengan beberapa peran mendapat yang paling longgar.
            Tampilan tidak memberi hak: tombol yang tidak berhak tetap tidak digambar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2 text-xs">
            {URUTAN.map((k) => (
              <span key={k} className="flex items-center gap-1" title={PENJELASAN[k]}>
                <Badge variant={WARNA[k]}>{LABEL[k]}</Badge>
                <span className="text-muted-foreground">{PENJELASAN[k]}</span>
              </span>
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari bagian" className="pl-9" aria-label="Cari bagian" />
            </div>
            <NativeSelect value={halaman} onChange={(e) => setHalaman(e.target.value)} aria-label="Halaman SIPP">
              <option value="">Semua halaman SIPP</option>
              {(Object.keys(data.halaman) as HalamanSipp[]).map((h) => (
                <option key={h} value={h}>{data.halaman[h]}</option>
              ))}
            </NativeSelect>
            <NativeSelect value={pegawai} onChange={(e) => setPegawai(e.target.value)} aria-label="Pegawai yang ditimpa">
              <option value="">Penimpaan per pegawai: pilih pegawai</option>
              {data.pegawai.map((p) => (
                <option key={p.id} value={p.id}>{p.nama}{p.golongan.length ? ` - ${p.golongan.join(", ")}` : ""}</option>
              ))}
            </NativeSelect>
          </div>
          {sibuk ? <p className="flex items-center gap-1 text-sm text-muted-foreground"><LoaderCircle className="h-4 w-4 animate-spin" /> Menyimpan...</p> : null}
          {kabar ? <p className="text-sm text-emerald-700 dark:text-emerald-300" role="status">{kabar}</p> : null}
          {galat ? <p className="text-sm text-rose-700 dark:text-rose-300" role="alert">{galat}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead className="sticky top-0 bg-card">
              <tr className="border-b border-border text-left align-bottom">
                <th className="min-w-[260px] p-2">Bagian di SIPP</th>
                {pegawaiTerpilih ? (
                  <>
                    <th className="p-2 text-xs">Akun {pegawaiTerpilih.nama}</th>
                    <th className="p-2 text-xs">Yang berlaku baginya</th>
                  </>
                ) : null}
                {data.golongan.map((g) => (
                  <th key={g.id} className="p-2 text-xs font-medium">
                    <div className="flex flex-col items-start gap-1">
                      <span>{g.label}</span>
                      <span className="flex gap-1">
                        <button
                          type="button"
                          disabled={sibuk || !bolehKolom(g.id)}
                          title="Pakai usulan: bagian yang lazim untuk peran ini nyala, lainnya mati (pengguna tetap boleh menyalakan)"
                          onClick={() => void simpan("peran", g.id, data.usulan[g.id] ?? {}, `Usulan dipakai untuk ${g.label}.`)}
                          className="rounded p-0.5 text-primary hover:bg-muted disabled:opacity-40"
                          aria-label={`Pakai usulan untuk ${g.label}`}
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={sibuk || !bolehKolom(g.id) || !Object.keys(aturanOf("peran", g.id)).length}
                          title="Hapus aturan peran ini (kembali ke bawaan sistem)"
                          onClick={() => void simpan("peran", g.id, {}, `Aturan ${g.label} dihapus.`)}
                          className="rounded p-0.5 text-rose-600 hover:bg-muted disabled:opacity-40"
                          aria-label={`Hapus aturan ${g.label}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {daftar.map((el) => (
                <tr key={el.kunci} className="border-b border-border/60 align-top" data-elemen={el.kunci}>
                  <td className="p-2">
                    <div className="font-medium text-foreground">{el.nama}</div>
                    <div className="text-xs text-muted-foreground">{data.halaman[el.halaman]} - {el.jelas}</div>
                    <div className="mt-1 text-xs"><Badge variant={el.jenis === "aksi" ? "netral" : "muted"}>{el.jenis === "aksi" ? "Ada tombol" : "Keterangan"}</Badge></div>
                  </td>
                  {pegawaiTerpilih ? (
                    <>
                      <td className="p-2">
                        <Sel k={keadaanDari(aturanOf("pengguna", pegawaiTerpilih.id)[el.kunci])} mati={sibuk} label={`${el.nama} - akun ${pegawaiTerpilih.nama}`} onKlik={() => putar("pengguna", pegawaiTerpilih.id, pegawaiTerpilih.nama, el.kunci, el.nama)} />
                      </td>
                      <td className="p-2 text-xs">
                        {(() => {
                          const b = berlakuPratinjau.get(el.kunci);
                          if (!b) return "-";
                          return <Badge variant={b.tampil ? "success" : "muted"}>{b.tampil ? "Tampil" : "Tersembunyi"}{b.terkunci ? " (terkunci)" : ""}</Badge>;
                        })()}
                      </td>
                    </>
                  ) : null}
                  {data.golongan.map((g) => (
                    <td key={g.id} className={`p-2 ${el.lazim.includes(g.id) ? "bg-primary/5" : ""}`}>
                      <Sel k={keadaanDari(aturanOf("peran", g.id)[el.kunci])} mati={sibuk || !bolehKolom(g.id)} label={`${el.nama} - ${g.label}`} onKlik={() => putar("peran", g.id, g.label, el.kunci, el.nama)} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">Sel berlatar biru muda = peran yang lazim membutuhkan bagian itu (dipakai tombol Pakai usulan).</p>
    </div>
  );
}
