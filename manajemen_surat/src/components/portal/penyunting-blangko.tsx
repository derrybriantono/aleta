"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiPath } from "@/lib/base-path";
import { pasangPenyunting, type PenyuntingDom } from "@/lib/aleta-abt-penyunting-dom";
import type {
  BlangkoBuka,
  FolderDaftar,
  HasilBeda,
  HasilCoba,
  ItemIsian,
  RingkasVersi,
} from "@/lib/aleta-abt-penyunting-tipe";
import type { BagianTeks } from "@/lib/aleta-abt-rtf";
import { pesanGalatPortal } from "@/lib/pesan-galat-portal";

/**
 * Penyunting blangko ALETA ABT (5 Nov 2026, Tahap 3) - Super Admin saja (rute /api/aleta-abt/penyunting menjaga peran).
 * Mengubah teks blangko langsung di layar seperti mengetik dokumen. Tiap simpan menjadi versi baru; versi lama dapat
 * dibandingkan dan dikembalikan; sebelum diterbitkan blangko dicoba pada perkara rekaan. Yang belum terbit tidak dipakai
 * jalur mana pun. Panel Blangko ABT by Derry Briantono masih memakai ABT sampai tahap berikutnya.
 */

async function panggil<T>(cari: string, init?: RequestInit): Promise<T> {
  const r = await fetch(apiPath(`/api/aleta-abt/penyunting${cari}`), { cache: "no-store", ...init });
  const isi = (await r.json().catch(() => null)) as { ok?: boolean; data?: T } | null;
  if (!r.ok || !isi || isi.ok === false) throw new Error(pesanGalatPortal(isi, `Permintaan gagal (HTTP ${r.status}).`));
  return isi.data as T;
}

const kirim = <T,>(badan: Record<string, unknown>) =>
  panggil<T>("", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(badan) });

const q = (o: Record<string, string | number | undefined>) =>
  `?${Object.entries(o)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join("&")}`;

const jam = (iso: string) => {
  const d = new Date(iso);
  return !iso || Number.isNaN(d.getTime()) ? "" : d.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
};

function Galat({ pesan }: { pesan: string }) {
  if (!pesan) return null;
  return (
    <div role="alert" className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200">
      {pesan}
    </div>
  );
}

function Info({ pesan }: { pesan: string }) {
  if (!pesan) return null;
  return (
    <div role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
      {pesan}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Daftar
// ---------------------------------------------------------------------------------------------------------------

type Daftar = { folder: FolderDaftar[]; jumlah: number; tersalin: boolean };

export function PenyuntingBlangko() {
  const [daftar, setDaftar] = useState<Daftar | null>(null);
  const [galat, setGalat] = useState("");
  const [cari, setCari] = useState("");
  const [buka, setBuka] = useState<Record<string, boolean>>({});
  const [pilih, setPilih] = useState("");

  const muat = useCallback(() => {
    panggil<Daftar>("")
      .then((d) => {
        setDaftar(d);
        setGalat("");
      })
      .catch((e: Error) => setGalat(e.message));
  }, []);

  useEffect(() => {
    muat();
  }, [muat]);

  const kata = cari.trim().toLowerCase();
  const tampil = useMemo(() => {
    if (!daftar) return [];
    return daftar.folder
      .map((f) => ({ ...f, blangko: kata ? f.blangko.filter((b) => b.nama.toLowerCase().includes(kata) || f.label.toLowerCase().includes(kata)) : f.blangko }))
      .filter((f) => f.blangko.length > 0);
  }, [daftar, kata]);

  if (pilih) {
    return (
      <LayarSunting
        id={pilih}
        saatTutup={() => {
          setPilih("");
          muat();
        }}
      />
    );
  }

  if (galat) return <Galat pesan={galat} />;
  if (!daftar) return <p className="text-sm text-muted-foreground">Memuat daftar blangko...</p>;
  if (!daftar.tersalin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pustaka blangko masih kosong</CardTitle>
          <CardDescription>Salin dulu blangko dari ABT di Pengaturan SIPP & ABT, bagian Pustaka blangko. Setelah itu blangko dapat disunting di sini.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Pilih blangko untuk disunting</CardTitle>
          <CardDescription>
            {daftar.jumlah.toLocaleString("id-ID")} blangko dari pustaka. Tiap simpan menjadi versi baru dan baru dipakai setelah Anda menerbitkannya.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari nama blangko atau folder" aria-label="Cari blangko" />
          <div className="space-y-2">
            {tampil.map((f) => {
              const terbuka = Boolean(kata) || Boolean(buka[f.folder]);
              return (
                <div key={f.folder} className="rounded-xl border border-border">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm font-medium"
                    aria-expanded={terbuka}
                    onClick={() => setBuka((s) => ({ ...s, [f.folder]: !s[f.folder] }))}
                  >
                    <span className="min-w-0 truncate">{f.label}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{f.blangko.length} blangko</span>
                  </button>
                  {terbuka ? (
                    <ul className="divide-y divide-border border-t border-border">
                      {f.blangko.slice(0, 300).map((b) => (
                        <li key={b.id}>
                          <button
                            type="button"
                            disabled={!b.rtf}
                            className="flex w-full flex-wrap items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent/60 disabled:cursor-not-allowed disabled:opacity-60"
                            onClick={() => setPilih(b.id)}
                          >
                            <span className="min-w-0 flex-1 break-words">{b.nama}</span>
                            {b.adaDraf ? <Badge variant="warning">Belum terbit</Badge> : b.disunting ? <Badge variant="success">Disunting</Badge> : null}
                            {b.arsip ? <Badge variant="muted">Arsip</Badge> : null}
                            {!b.rtf ? <Badge variant="muted">Tidak dapat disunting</Badge> : null}
                            {b.hilang ? <Badge variant="muted">Tidak ada lagi di ABT</Badge> : null}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              );
            })}
            {!tampil.length ? <p className="text-sm text-muted-foreground">Tidak ada blangko yang cocok.</p> : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Layar sunting
// ---------------------------------------------------------------------------------------------------------------

type Tab = "teks" | "riwayat" | "beda" | "coba";
type Riwayat = { id: string; nama: string; versi: RingkasVersi[]; belumDisimpan: boolean };

const STATUS_TEKS: Record<RingkasVersi["status"], string> = { terbit: "Terbit", draf: "Belum terbit", lama: "Pernah terbit" };
const STATUS_WARNA: Record<RingkasVersi["status"], "success" | "warning" | "muted"> = { terbit: "success", draf: "warning", lama: "muted" };
const JENIS_TEKS: Record<RingkasVersi["jenis"], string> = { asal: "Salinan dari ABT", sunting: "Disunting", pulih: "Dikembalikan" };

function TeksBagian({ bagian, isian }: { bagian: BagianTeks[]; isian: BlangkoBuka["isian"] }) {
  return (
    <>
      {bagian.map((b, i) => {
        if (b.j === "isian") {
          return (
            <span key={i} className="mx-0.5 inline-block rounded-md border border-primary/30 bg-primary/10 px-1.5 text-[0.92em] font-medium text-primary">
              {isian[b.no]?.nama ?? `Isian ${b.no}`}
            </span>
          );
        }
        if (b.j === "kotak") {
          return (
            <span key={i} className="mx-0.5 inline-block rounded-md border border-dashed border-border bg-muted px-1.5 text-[0.85em] text-muted-foreground">
              Terkunci: {b.label}
            </span>
          );
        }
        return (
          <span key={i} style={{ fontWeight: b.g & 1 ? 700 : undefined, fontStyle: b.g & 2 ? "italic" : undefined, textDecoration: b.g & 4 ? "underline" : undefined }}>
            {b.t}
          </span>
        );
      })}
    </>
  );
}

function LayarSunting({ id, saatTutup }: { id: string; saatTutup: () => void }) {
  const [data, setData] = useState<BlangkoBuka | null>(null);
  const [tab, setTab] = useState<Tab>("teks");
  const [ubah, setUbah] = useState(0);
  const [galat, setGalat] = useState("");
  const [pesan, setPesan] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [catatan, setCatatan] = useState("");
  const [panelIsian, setPanelIsian] = useState(false);
  const [semuaIsian, setSemuaIsian] = useState<ItemIsian[] | null>(null);
  const [cariIsian, setCariIsian] = useState("");
  const [catatanSisip, setCatatanSisip] = useState("");
  const [riwayat, setRiwayat] = useState<Riwayat | null>(null);
  const [beda, setBeda] = useState<HasilBeda | null>(null);
  const [coba, setCoba] = useState<HasilCoba | null>(null);
  const akar = useRef<HTMLDivElement>(null);
  const dom = useRef<PenyuntingDom | null>(null);
  const [pilihA, setPilihA] = useState(0);
  const [pilihB, setPilihB] = useState(0);

  const muat = useCallback(
    (versi?: number) =>
      panggil<BlangkoBuka>(q({ bagian: "blangko", id, versi }))
        .then((d) => {
          setData(d);
          setUbah(0);
          setGalat("");
        })
        .catch((e: Error) => setGalat(e.message)),
    [id]
  );

  useEffect(() => {
    muat();
  }, [muat]);

  // Pasang dokumen yang bisa diketik tiap data/tab teks berganti.
  useEffect(() => {
    if (tab !== "teks" || !data || !akar.current) return;
    const bisa = data.dapatDisunting && data.versi.nomor === data.terakhir;
    const p = pasangPenyunting(akar.current, data.paragraf, { dapatDisunting: bisa, isian: data.isian, saatUbah: setUbah });
    dom.current = p;
    return () => {
      p.hancurkan();
      dom.current = null;
    };
  }, [data, tab]);

  // Peringatan sebelum meninggalkan halaman dengan suntingan yang belum disimpan.
  useEffect(() => {
    if (!ubah) return;
    const f = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", f);
    return () => window.removeEventListener("beforeunload", f);
  }, [ubah]);

  const yakinBuang = () => !ubah || window.confirm("Ada suntingan yang belum disimpan dan akan hilang. Lanjutkan?");

  const terbaru = data ? data.versi.nomor === data.terakhir : true;

  const simpan = async () => {
    if (!data || !dom.current) return;
    const { suntingan, hapus } = dom.current.ambil();
    if (!suntingan.length && !hapus.length) return;
    setSibuk(true);
    setGalat("");
    setPesan("");
    try {
      const h = await kirim<{ nomor: number; ringkas: string }>({ tindakan: "simpan", id, dasarNomor: data.terakhir, suntingan, hapus, catatan });
      setCatatan("");
      await muat();
      setPesan(`Tersimpan sebagai versi ${h.nomor}${h.ringkas ? ` (${h.ringkas})` : ""}. Belum terbit: belum dipakai di mana pun.`);
    } catch (e) {
      setGalat((e as Error).message);
    } finally {
      setSibuk(false);
    }
  };

  const terbitkan = async () => {
    if (!data) return;
    if (
      !window.confirm(
        `Terbitkan versi ${data.versi.nomor}? Isi blangko ini di pustaka diganti dengan versi tersebut. Panel Blangko ABT by Derry Briantono masih memakai ABT sampai tahap berikutnya.`
      )
    )
      return;
    setSibuk(true);
    setGalat("");
    setPesan("");
    try {
      await kirim({ tindakan: "terbitkan", id, nomor: data.versi.nomor });
      await muat();
      setPesan(`Versi ${data.versi.nomor} sudah terbit.`);
    } catch (e) {
      setGalat((e as Error).message);
    } finally {
      setSibuk(false);
    }
  };

  const kembalikan = async (nomor: number) => {
    if (!window.confirm(`Kembalikan ke isi versi ${nomor}? Isinya disalin persis menjadi versi baru (belum terbit); versi lain tidak hilang.`)) return;
    if (!yakinBuang()) return;
    setSibuk(true);
    setGalat("");
    setPesan("");
    try {
      const h = await kirim<{ nomor: number }>({ tindakan: "pulihkan", id, nomor });
      await muat();
      setTab("teks");
      setRiwayat(null);
      setPesan(`Isi versi ${nomor} dikembalikan sebagai versi ${h.nomor} (belum terbit).`);
    } catch (e) {
      setGalat((e as Error).message);
    } finally {
      setSibuk(false);
    }
  };

  const bukaRiwayat = () => {
    if (!yakinBuang()) return;
    setUbah(0);
    setTab("riwayat");
    setGalat("");
    panggil<Riwayat>(q({ bagian: "riwayat", id }))
      .then((r) => {
        setRiwayat(r);
        setPilihB(r.versi[0]?.nomor ?? 0);
        setPilihA(r.versi[1]?.nomor ?? r.versi[0]?.nomor ?? 0);
      })
      .catch((e: Error) => setGalat(e.message));
  };

  const bandingkan = (a: number, b: number) => {
    setGalat("");
    panggil<HasilBeda>(q({ bagian: "beda", id, a, b }))
      .then((h) => {
        setBeda(h);
        setTab("beda");
      })
      .catch((e: Error) => setGalat(e.message));
  };

  const cobaRekaan = () => {
    setTab("coba");
    setGalat("");
    setCoba(null);
    panggil<HasilCoba>(q({ bagian: "coba", id, versi: data?.versi.nomor }))
      .then(setCoba)
      .catch((e: Error) => setGalat(e.message));
  };

  const unduhContoh = async () => {
    setGalat("");
    try {
      const h = await panggil<HasilCoba>(q({ bagian: "coba", id, versi: data?.versi.nomor, berkas: 1 }));
      if (!h.rtfBase64) {
        setGalat(h.sebabTanpaBerkas || "Berkas contoh tidak dapat dibuat dengan aman.");
        return;
      }
      const bita = Uint8Array.from(atob(h.rtfBase64), (c) => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bita], { type: "application/rtf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(data?.nama ?? "blangko").replace(/[^\w\- ]+/g, "")} - contoh rekaan.rtf`;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e) {
      setGalat((e as Error).message);
    }
  };

  const bukaPanelIsian = () => {
    const baru = !panelIsian;
    setPanelIsian(baru);
    if (baru && !semuaIsian) {
      panggil<{ isian: ItemIsian[] }>(q({ bagian: "isian" }))
        .then((d) => setSemuaIsian(d.isian))
        .catch((e: Error) => setGalat(e.message));
    }
  };

  const sisip = (item: ItemIsian) => {
    const ok = dom.current?.sisipIsian(item.no) ?? false;
    setCatatanSisip(ok ? `Disisipkan: ${item.nama}.` : "Ketuk dulu tempat di teks tempat isian akan disisipkan.");
  };

  const cocokIsian = useMemo(() => {
    if (!semuaIsian) return [];
    const k = cariIsian.trim().toLowerCase();
    return (k ? semuaIsian.filter((i) => i.nama.toLowerCase().includes(k)) : semuaIsian).slice(0, 60);
  }, [semuaIsian, cariIsian]);

  if (!data) {
    return (
      <div className="space-y-3">
        <Button variant="outline" size="sm" onClick={saatTutup}>
          Kembali ke daftar
        </Button>
        {galat ? <Galat pesan={galat} /> : <p className="text-sm text-muted-foreground">Membuka blangko...</p>}
      </div>
    );
  }

  const v = data.versi;
  const bolehSunting = data.dapatDisunting && terbaru;
  const bolehTerbit = v.status !== "terbit" && ubah === 0;

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="space-y-3 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (yakinBuang()) saatTutup();
              }}
            >
              Kembali ke daftar
            </Button>
            <h2 className="min-w-0 flex-1 break-words text-base font-semibold">{data.nama}</h2>
            <Badge variant="outline">Versi {v.nomor}</Badge>
            <Badge variant={STATUS_WARNA[v.status]}>{STATUS_TEKS[v.status]}</Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            {bolehSunting ? (
              <Button size="sm" onClick={simpan} disabled={sibuk || ubah === 0}>
                {sibuk ? "Menyimpan..." : ubah ? `Simpan sebagai versi baru (${ubah} paragraf)` : "Simpan sebagai versi baru"}
              </Button>
            ) : null}
            <Button variant="outline" size="sm" onClick={() => (tab === "teks" ? bukaRiwayat() : setTab("teks"))}>
              {tab === "teks" ? "Riwayat versi" : "Kembali ke teks"}
            </Button>
            <Button variant="outline" size="sm" onClick={cobaRekaan} disabled={ubah > 0} title={ubah > 0 ? "Simpan dulu suntingan Anda." : undefined}>
              Coba pada perkara rekaan
            </Button>
            {bolehTerbit ? (
              <Button variant="default" size="sm" onClick={terbitkan} disabled={sibuk}>
                Terbitkan versi {v.nomor}
              </Button>
            ) : null}
            {!terbaru ? (
              <Button variant="outline" size="sm" onClick={() => kembalikan(v.nomor)} disabled={sibuk}>
                Kembalikan ke versi {v.nomor}
              </Button>
            ) : null}
          </div>
          {bolehSunting ? (
            <Input value={catatan} onChange={(e) => setCatatan(e.target.value)} maxLength={300} placeholder="Catatan untuk versi ini (boleh kosong)" aria-label="Catatan versi" />
          ) : null}
          <p className="text-xs text-muted-foreground">
            {v.jenis === "asal" ? "Salinan dari ABT." : `${JENIS_TEKS[v.jenis]}${v.dibuatNama ? ` oleh ${v.dibuatNama}` : ""}${v.dibuatAt ? `, ${jam(v.dibuatAt)}` : ""}.`}
            {v.catatan && v.jenis !== "asal" ? ` Catatan: ${v.catatan}` : ""}
            {data.terbit !== v.nomor && data.terbit > 0 ? ` Yang terbit sekarang: versi ${data.terbit}.` : ""}
          </p>
        </CardContent>
      </Card>

      <Galat pesan={galat} />
      <Info pesan={pesan} />
      {!terbaru ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
          Ini versi lama (hanya dibaca). Versi terkini adalah versi {data.terakhir}.{" "}
          <button type="button" className="underline" onClick={() => muat()}>
            Buka versi terkini
          </button>
        </div>
      ) : null}
      {!data.dapatDisunting ? <Galat pesan={data.sebabTerkunci} /> : null}

      {tab === "teks" ? (
        <>
          {bolehSunting ? (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={bukaPanelIsian} aria-expanded={panelIsian}>
                  Sisipkan isian
                </Button>
                <p className="min-w-0 flex-1 text-xs text-muted-foreground">
                  Ketuk tempat di teks, lalu pilih isian. Bagian bertanda Terkunci, kepala, dan kaki halaman tidak dapat diubah di sini agar letaknya tidak bergeser
                  {data.jumlahTerkunci ? `; ${data.jumlahTerkunci} paragraf dikunci karena memuat huruf khusus` : ""}.
                </p>
              </div>
              {panelIsian ? (
                <Card>
                  <CardContent className="space-y-2 pt-4">
                    <Input value={cariIsian} onChange={(e) => setCariIsian(e.target.value)} placeholder="Cari isian, mis. Nama Penggugat" aria-label="Cari isian" />
                    {catatanSisip ? <p className="text-xs text-muted-foreground">{catatanSisip}</p> : null}
                    <div className="flex max-h-56 flex-wrap gap-1.5 overflow-y-auto">
                      {!semuaIsian ? <span className="text-sm text-muted-foreground">Memuat daftar isian...</span> : null}
                      {cocokIsian.map((i) => (
                        <button
                          key={i.no}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => sisip(i)}
                          className={`rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-left text-sm text-primary hover:bg-primary/20 ${i.bersyarat ? "border-dashed" : ""}`}
                          title={i.bersyarat ? "Isian ini bisa kosong atau berganti menurut keadaan perkara." : undefined}
                        >
                          {i.nama}
                        </button>
                      ))}
                      {semuaIsian && !cocokIsian.length ? <span className="text-sm text-muted-foreground">Tidak ada isian yang cocok.</span> : null}
                    </div>
                  </CardContent>
                </Card>
              ) : null}
            </div>
          ) : null}

          {data.tetap.filter((t) => t.jenis === "kepala" && t.baris.length).map((t, i) => (
            <TetapKunci key={`k${i}`} judul="Kepala halaman" baris={t.baris} isian={data.isian} />
          ))}
          <div className="rounded-xl border border-border bg-card px-3 py-3 text-[15px] leading-relaxed text-foreground sm:px-5">
            <div ref={akar} className="space-y-1" />
          </div>
          {data.tetap.filter((t) => t.jenis === "kaki" && t.baris.length).map((t, i) => (
            <TetapKunci key={`f${i}`} judul="Kaki halaman" baris={t.baris} isian={data.isian} />
          ))}
        </>
      ) : null}

      {tab === "riwayat" ? (
        <Card>
          <CardHeader>
            <CardTitle>Riwayat versi</CardTitle>
            <CardDescription>Tiap simpan menjadi satu versi. Mengembalikan versi lama menyalin isinya persis menjadi versi baru; tidak ada versi yang dihapus.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!riwayat ? <p className="text-sm text-muted-foreground">Memuat riwayat...</p> : null}
            {riwayat && riwayat.versi.length > 1 ? (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span>Bandingkan versi</span>
                <select className="h-9 rounded-lg border border-border bg-background px-2" value={pilihA} onChange={(e) => setPilihA(Number(e.target.value))} aria-label="Versi pertama">
                  {riwayat.versi.map((x) => (
                    <option key={x.nomor} value={x.nomor}>
                      Versi {x.nomor}
                    </option>
                  ))}
                </select>
                <span>dengan</span>
                <select className="h-9 rounded-lg border border-border bg-background px-2" value={pilihB} onChange={(e) => setPilihB(Number(e.target.value))} aria-label="Versi kedua">
                  {riwayat.versi.map((x) => (
                    <option key={x.nomor} value={x.nomor}>
                      Versi {x.nomor}
                    </option>
                  ))}
                </select>
                <Button size="sm" variant="outline" onClick={() => bandingkan(pilihA, pilihB)} disabled={pilihA === pilihB}>
                  Lihat beda
                </Button>
              </div>
            ) : null}
            <ul className="space-y-2">
              {riwayat?.versi.map((x) => (
                <li key={x.nomor} className="rounded-xl border border-border px-3 py-2 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">Versi {x.nomor}</span>
                    <Badge variant={STATUS_WARNA[x.status]}>{STATUS_TEKS[x.status]}</Badge>
                    <span className="text-muted-foreground">{JENIS_TEKS[x.jenis]}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {x.dibuatNama ? `${x.dibuatNama}, ` : ""}
                    {jam(x.dibuatAt)}
                    {x.jenis === "pulih" ? ` · isi persis versi ${x.dariNomor}` : ""}
                    {x.ringkas ? ` · ${x.ringkas}` : ""}
                    {x.terbitAt && x.jenis !== "asal" ? ` · terbit ${jam(x.terbitAt)} oleh ${x.terbitNama}` : ""}
                  </p>
                  {x.catatan && x.jenis === "sunting" ? <p className="mt-1 text-sm">{x.catatan}</p> : null}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => muat(x.nomor).then(() => setTab("teks"))}>
                      Lihat isinya
                    </Button>
                    {riwayat && x.nomor !== riwayat.versi[0].nomor ? (
                      <>
                        <Button size="sm" variant="outline" onClick={() => bandingkan(x.nomor, riwayat.versi[0].nomor)}>
                          Bandingkan dengan terkini
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => kembalikan(x.nomor)} disabled={sibuk}>
                          Kembalikan
                        </Button>
                      </>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {tab === "beda" && beda ? <TampilBeda beda={beda} isian={data.isian} saatKembali={() => setTab("riwayat")} /> : null}

      {tab === "coba" ? (
        <Card>
          <CardHeader>
            <CardTitle>Coba pada perkara rekaan</CardTitle>
            <CardDescription>
              Versi {v.nomor} diisi data karangan (bukan perkara sungguhan) hanya untuk melihat letak teks dan kalimat di sekitar isian. Ini bukan pengisian sungguhan oleh mesin.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!coba ? <p className="text-sm text-muted-foreground">Menyiapkan contoh...</p> : null}
            {coba ? (
              <>
                <p className="text-sm text-muted-foreground">
                  {coba.perkara}. {coba.terisi} isian terisi contoh
                  {coba.takBerContoh ? `; ${coba.takBerContoh} isian belum punya contoh dan tampil dengan namanya` : ""}.
                </p>
                <Button size="sm" variant="outline" onClick={unduhContoh}>
                  Unduh berkas contoh
                </Button>
                <div className="rounded-xl border border-border bg-card px-3 py-3 text-[15px] leading-relaxed sm:px-5">
                  {coba.paragraf.map((p) => (
                    <p
                      key={p.i}
                      className="min-h-[1.5em] whitespace-pre-wrap break-words"
                      style={{ textAlign: p.rata === "tengah" ? "center" : p.rata === "kanan" ? "right" : p.rata === "rata" ? "justify" : "left" }}
                    >
                      {p.awalan ? <span className="mr-2 text-muted-foreground">{p.awalan}</span> : null}
                      <TeksBagian bagian={p.bagian} isian={data.isian} />
                    </p>
                  ))}
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function TetapKunci({ judul, baris, isian }: { judul: string; baris: BagianTeks[][]; isian: BlangkoBuka["isian"] }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
      <p className="text-xs font-medium uppercase tracking-wide">{judul} (terkunci)</p>
      {baris.map((b, i) => (
        <p key={i} className="break-words">
          <TeksBagian bagian={b} isian={isian} />
        </p>
      ))}
      <p className="mt-1 text-xs">Tidak disunting di sini agar letak halamannya tidak bergeser.</p>
    </div>
  );
}

function PotongBedaTampil({ potong }: { potong: Array<{ t: string; d?: "hapus" | "tambah" }> }) {
  return (
    <>
      {potong.map((p, i) =>
        p.d === "hapus" ? (
          <del key={i} className="rounded bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200">
            {p.t}
          </del>
        ) : p.d === "tambah" ? (
          <ins key={i} className="rounded bg-emerald-100 font-medium text-emerald-800 no-underline dark:bg-emerald-950/60 dark:text-emerald-200" style={{ textDecoration: "underline" }}>
            {p.t}
          </ins>
        ) : (
          <span key={i}>{p.t}</span>
        )
      )}
    </>
  );
}

function TampilBeda({ beda, isian, saatKembali }: { beda: HasilBeda; isian: BlangkoBuka["isian"]; saatKembali: () => void }) {
  const r = beda.ringkas;
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Beda versi {beda.a.nomor} dengan versi {beda.b.nomor}
        </CardTitle>
        <CardDescription>
          {beda.samaBita
            ? "Isi kedua versi sama persis."
            : beda.samaTeks
              ? "Teksnya sama; yang berbeda hanya pengaturan format atau bagian terkunci."
              : `${r.ubah} paragraf berubah, ${r.tambah} ditambah, ${r.hapus} dihapus.`}
          {beda.kepalaKakiBeda ? " Kepala atau kaki halaman juga berbeda." : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <Button size="sm" variant="outline" onClick={saatKembali}>
          Kembali ke riwayat
        </Button>
        <div className="space-y-1 text-[15px] leading-relaxed">
          {beda.baris.map((b, i) => {
            if (b.k === "lipat") return <p key={i} className="rounded bg-muted px-2 py-0.5 text-center text-xs text-muted-foreground">{b.n} paragraf tidak berubah</p>;
            if (b.k === "sama") return <p key={i} className="whitespace-pre-wrap break-words text-muted-foreground"><TeksBagian bagian={b.a} isian={isian} /></p>;
            if (b.k === "ubah") {
              return (
                <div key={i} className="rounded-lg border border-border p-2">
                  <p className="whitespace-pre-wrap break-words text-xs text-muted-foreground">Sebelum</p>
                  <p className="whitespace-pre-wrap break-words"><PotongBedaTampil potong={b.a} /></p>
                  <p className="mt-1 whitespace-pre-wrap break-words text-xs text-muted-foreground">Sesudah</p>
                  <p className="whitespace-pre-wrap break-words"><PotongBedaTampil potong={b.b} /></p>
                </div>
              );
            }
            if (b.k === "tambah") return <p key={i} className="whitespace-pre-wrap break-words rounded-lg border border-emerald-300 p-2 dark:border-emerald-800"><span className="mr-1 text-xs text-muted-foreground">Ditambah</span><PotongBedaTampil potong={b.b} /></p>;
            return <p key={i} className="whitespace-pre-wrap break-words rounded-lg border border-rose-300 p-2 dark:border-rose-800"><span className="mr-1 text-xs text-muted-foreground">Dihapus</span><PotongBedaTampil potong={b.a} /></p>;
          })}
          {beda.terpotong ? <p className="text-xs text-muted-foreground">Daftar beda dipotong; banyak sekali yang berbeda.</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}
