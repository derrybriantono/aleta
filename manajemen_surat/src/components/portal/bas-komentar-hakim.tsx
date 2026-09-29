"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, MessageSquarePlus, RotateCcw, Search, TriangleAlert } from "lucide-react";

import { EmptyState, PageIntro } from "@/components/portal/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { apiPath, withBasePath } from "@/lib/base-path";
import { BATAS_ISI_KOMENTAR, BATAS_KUTIPAN, HURUF_ALASAN, kunciAlasan, sebutanBagian } from "@/lib/bas-komentar";
import { pesanGalatPortal } from "@/lib/pesan-galat-portal";

/**
 * Baca BAS & keterangan saksi - layar hakim untuk berkomentar.
 *
 * ============================================================================
 * MEMBACA LALU MENUNJUK, TANPA ACC
 * ============================================================================
 *
 * Hakim membuka perkara, membaca tanya-jawab tiap saksi, lalu menekan
 * "Komentari" pada keterangan yang salah. Komentarnya membawa kutipan
 * keterangan itu, sehingga tetap terbaca walau BAS-nya kemudian diperbaiki.
 * Tidak ada tombol setuju/tolak: komentar tidak pernah menahan panitera.
 *
 * Sumbernya dua dan ditampilkan berdampingan (lihat bacaAlurBas): lembar BAS
 * ALETA dan keterangan saksi di ABT. Batas keduanya ditulis di kepala layar,
 * bukan disembunyikan - hakim harus tahu apa yang TIDAK terbaca di sini.
 */

type OrangSingkat = { id: string; nama: string };

type Komentar = {
  id: string;
  nomor: string;
  perkaraId: string | null;
  sidangKe: number | null;
  bagian: string;
  kutipan: string;
  isi: string;
  penulis: OrangSingkat;
  dibuatPada: string;
  selesai: boolean;
  diselesaikanOleh: OrangSingkat | null;
  diselesaikanPada: string | null;
};

type Saya = { id: string; nama: string; bolehMenulis: boolean; bolehMenyelesaikanSemua: boolean };

type BarisAlur = { bagian: string; urutan: number; penanya: string; pertanyaan: string; jawaban: string };
type SaksiAlur = { sumber: "ABT" | "ALETA"; kunci: string; sebutan: string; nama: string; keterangan: string; baris: BarisAlur[] };
type Alur = { nomorPerkara: string; perkaraId: string; saksi: SaksiAlur[]; batas: string[]; halangan: string[]; dibacaPada: string };
type Pilihan = { perkaraId: string; nomorPerkara: string; jenisPerkara: string; tanggalDaftar: string };

function waktuSingkat(iso: string | null) {
  if (!iso) return "";
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return iso;
  return t.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

function KartuKomentar({
  komentar,
  saya,
  sibuk,
  onTandai,
}: {
  komentar: Komentar;
  saya: Saya | null;
  sibuk: boolean;
  onTandai: (id: string, selesai: boolean) => void;
}) {
  const boleh = Boolean(saya && (saya.bolehMenyelesaikanSemua || saya.id === komentar.penulis.id));
  return (
    <div
      className={
        "rounded-lg border px-3 py-2 text-sm " +
        (komentar.selesai ? "border-border/60 bg-muted/30 text-muted-foreground" : "border-amber-300/70 bg-amber-50/70 dark:border-amber-700/50 dark:bg-amber-950/30")
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs">
          <span className="font-medium text-foreground">{komentar.penulis.nama}</span> · {waktuSingkat(komentar.dibuatPada)} ·{" "}
          {sebutanBagian(komentar.bagian)}
        </span>
        {komentar.selesai ? (
          <Badge variant="success">Selesai{komentar.diselesaikanOleh ? " - " + komentar.diselesaikanOleh.nama : ""}</Badge>
        ) : (
          <Badge variant="warning">Belum ditanggapi</Badge>
        )}
      </div>
      {komentar.kutipan ? (
        <blockquote className="mt-1.5 border-l-2 border-border pl-2 text-xs italic text-muted-foreground">
          {komentar.kutipan}
        </blockquote>
      ) : null}
      <p className="mt-1.5 whitespace-pre-wrap">{komentar.isi}</p>
      {boleh ? (
        <div className="mt-2">
          <Button size="sm" variant="outline" disabled={sibuk} onClick={() => onTandai(komentar.id, !komentar.selesai)}>
            {komentar.selesai ? (
              <>
                <RotateCcw className="mr-1 h-3.5 w-3.5" /> Buka lagi
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Tandai selesai
              </>
            )}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function IsianKomentar({
  bagian,
  kutipanAwal,
  sibuk,
  onKirim,
  onBatal,
}: {
  bagian: string;
  kutipanAwal: string;
  sibuk: boolean;
  onKirim: (masukan: { bagian: string; kutipan: string; isi: string }) => void;
  onBatal?: () => void;
}) {
  const [kutipan, setKutipan] = useState(kutipanAwal.slice(0, BATAS_KUTIPAN));
  const [isi, setIsi] = useState("");
  return (
    <div className="mt-2 space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
      <p className="text-xs text-muted-foreground">Komentar untuk: {sebutanBagian(bagian)}</p>
      <Textarea
        className="min-h-[60px]"
        value={kutipan}
        maxLength={BATAS_KUTIPAN}
        onChange={(e) => setKutipan(e.target.value)}
        placeholder="Kutipan keterangan yang dikomentari (boleh dipersingkat)"
        aria-label="Kutipan"
      />
      <Textarea
        className="min-h-[80px]"
        value={isi}
        maxLength={BATAS_ISI_KOMENTAR}
        onChange={(e) => setIsi(e.target.value)}
        placeholder="Apa yang salah, dan seharusnya bagaimana"
        aria-label="Isi komentar"
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={sibuk || !isi.trim()} onClick={() => onKirim({ bagian, kutipan, isi })}>
          {sibuk ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null} Kirim komentar
        </Button>
        {onBatal ? (
          <Button size="sm" variant="ghost" disabled={sibuk} onClick={onBatal}>
            Batal
          </Button>
        ) : null}
        <span className="text-xs text-muted-foreground">
          {isi.length}/{BATAS_ISI_KOMENTAR}
        </span>
      </div>
    </div>
  );
}

export function BasKomentarHakim() {
  const [nomor, setNomor] = useState("");
  const [memuat, setMemuat] = useState(false);
  const [pesan, setPesan] = useState("");
  const [alur, setAlur] = useState<Alur | null>(null);
  const [pilihan, setPilihan] = useState<Pilihan[]>([]);
  const [komentar, setKomentar] = useState<Komentar[]>([]);
  const [saya, setSaya] = useState<Saya | null>(null);
  const [terbuka, setTerbuka] = useState<string>("");
  const [sibuk, setSibuk] = useState(false);
  const [bagianUmum, setBagianUmum] = useState("umum");

  const muatKomentar = useCallback(async (nomorPerkara: string) => {
    const jawaban = await fetch(apiPath(`/api/aleta-ecourt/bas-komentar?nomor=${encodeURIComponent(nomorPerkara)}`), {
      cache: "no-store",
    });
    const isi = await jawaban.json().catch(() => null);
    if (!jawaban.ok) throw new Error(pesanGalatPortal(isi, "Komentar tidak terbaca."));
    setKomentar((isi?.data?.komentar ?? []) as Komentar[]);
    setSaya((isi?.data?.saya ?? null) as Saya | null);
  }, []);

  const buka = useCallback(
    async (kunci: { nomor?: string; perkaraId?: string }) => {
      setMemuat(true);
      setPesan("");
      setAlur(null);
      setPilihan([]);
      setTerbuka("");
      try {
        const query = kunci.perkaraId
          ? `perkaraId=${encodeURIComponent(kunci.perkaraId)}`
          : `nomor=${encodeURIComponent(kunci.nomor ?? "")}`;
        const jawaban = await fetch(apiPath(`/api/aleta-ecourt/bas-komentar/alur?${query}`), { cache: "no-store" });
        const isi = await jawaban.json().catch(() => null);
        if (!jawaban.ok) throw new Error(pesanGalatPortal(isi, "Alur BAS tidak terbaca."));
        const data = isi?.data ?? {};
        if (data.perluDipilih && Array.isArray(data.pilihan)) {
          setPilihan(data.pilihan as Pilihan[]);
          return;
        }
        if (!data.ada) {
          setPesan((data.halangan ?? []).join(" ") || "Perkara tidak ditemukan.");
          return;
        }
        const hasil = data.alur as Alur;
        setAlur(hasil);
        await muatKomentar(hasil.nomorPerkara || kunci.nomor || "");
      } catch (galat) {
        setPesan(galat instanceof Error ? galat.message : "Tidak dapat menghubungi ALETA.");
      } finally {
        setMemuat(false);
      }
    },
    [muatKomentar]
  );

  // Dibuka dari Status Perkara atau Alat Bantu Tulis BAS: ?nomor=... di alamat.
  useEffect(() => {
    const awal = new URLSearchParams(window.location.search).get("nomor") ?? "";
    if (!awal.trim()) return;
    const timer = window.setTimeout(() => {
      setNomor(awal);
      void buka({ nomor: awal });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [buka]);

  const kirim = useCallback(
    async (masukan: { bagian: string; kutipan: string; isi: string }) => {
      if (!alur) return;
      setSibuk(true);
      setPesan("");
      try {
        const jawaban = await fetch(apiPath("/api/aleta-ecourt/bas-komentar"), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            nomor: alur.nomorPerkara || nomor,
            perkaraId: alur.perkaraId || undefined,
            bagian: masukan.bagian,
            kutipan: masukan.kutipan,
            isi: masukan.isi,
          }),
        });
        const isi = await jawaban.json().catch(() => null);
        if (!jawaban.ok) throw new Error(pesanGalatPortal(isi, "Komentar gagal dikirim."));
        setKomentar((lama) => [...lama, isi.data.komentar as Komentar]);
        setTerbuka("");
      } catch (galat) {
        setPesan(galat instanceof Error ? galat.message : "Komentar gagal dikirim.");
      } finally {
        setSibuk(false);
      }
    },
    [alur, nomor]
  );

  const tandai = useCallback(async (id: string, selesai: boolean) => {
    setSibuk(true);
    setPesan("");
    try {
      const jawaban = await fetch(apiPath("/api/aleta-ecourt/bas-komentar"), {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, selesai }),
      });
      const isi = await jawaban.json().catch(() => null);
      if (!jawaban.ok) throw new Error(pesanGalatPortal(isi, "Komentar gagal ditandai."));
      const baru = isi.data.komentar as Komentar;
      setKomentar((lama) => lama.map((k) => (k.id === baru.id ? baru : k)));
    } catch (galat) {
      setPesan(galat instanceof Error ? galat.message : "Komentar gagal ditandai.");
    } finally {
      setSibuk(false);
    }
  }, []);

  const perBagian = useMemo(() => {
    const peta = new Map<string, Komentar[]>();
    for (const k of komentar) {
      if (!peta.has(k.bagian)) peta.set(k.bagian, []);
      peta.get(k.bagian)!.push(k);
    }
    return peta;
  }, [komentar]);

  const bagianTampil = useMemo(() => new Set(alur?.saksi.flatMap((s) => s.baris.map((b) => b.bagian)) ?? []), [alur]);
  const komentarLain = komentar.filter((k) => !bagianTampil.has(k.bagian));
  const belum = komentar.filter((k) => !k.selesai).length;

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Kepaniteraan · Hakim"
        title="Baca BAS & Keterangan Saksi"
        description="Baca tanya-jawab saksi suatu perkara, lalu tunjuk keterangan yang salah. Komentar sampai ke panitera pengganti; BAS tetap dapat dikerjakan tanpa menunggu."
        actions={
          <a
            href={withBasePath("/bas")}
            className="inline-flex items-center rounded-md border border-border px-3 py-1.5 text-sm transition hover:bg-muted/50"
          >
            Alat Bantu Tulis BAS
          </a>
        }
      />

      <Card>
        <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row">
          <Input
            value={nomor}
            onChange={(e) => setNomor(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && nomor.trim()) void buka({ nomor: nomor.trim() });
            }}
            placeholder="Nomor perkara, misalnya 324/Pdt.G/2026/PA.Dgl"
            aria-label="Nomor perkara"
          />
          <Button disabled={memuat || !nomor.trim()} onClick={() => void buka({ nomor: nomor.trim() })}>
            {memuat ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Search className="mr-1 h-4 w-4" />} Buka
          </Button>
        </CardContent>
      </Card>

      {pesan ? (
        <p className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300">
          <TriangleAlert className="h-4 w-4" /> {pesan}
        </p>
      ) : null}

      {pilihan.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pilih perkara yang dimaksud</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {pilihan.map((p) => (
              <button
                key={p.perkaraId}
                type="button"
                className="block w-full rounded-md border border-border px-3 py-2 text-left text-sm hover:bg-muted/50"
                onClick={() => {
                  setNomor(p.nomorPerkara);
                  void buka({ perkaraId: p.perkaraId });
                }}
              >
                <span className="font-medium">{p.nomorPerkara}</span>
                <span className="ml-2 text-muted-foreground">
                  {p.jenisPerkara} {p.tanggalDaftar ? "· " + p.tanggalDaftar : ""}
                </span>
              </button>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {alur ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                {alur.nomorPerkara || "Perkara " + alur.perkaraId}
                <Badge variant={belum > 0 ? "warning" : "muted"}>
                  {komentar.length} komentar{belum > 0 ? `, ${belum} belum ditanggapi` : ""}
                </Badge>
              </CardTitle>
              <CardDescription>Dibaca {waktuSingkat(alur.dibacaPada)}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                {alur.batas.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
              {alur.halangan.map((h) => (
                <p key={h} className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-300">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /> {h}
                </p>
              ))}
              {saya && !saya.bolehMenulis ? (
                <p className="text-sm text-muted-foreground">
                  Komentar ditulis hakim. Anda dapat membaca dan{" "}
                  {saya.bolehMenyelesaikanSemua ? "menandai komentar yang sudah ditanggapi." : "mengikuti tanggapannya."}
                </p>
              ) : null}
            </CardContent>
          </Card>

          {alur.saksi.length === 0 ? (
            <EmptyState
              title="Belum ada keterangan saksi"
              description="Tidak ada lembar BAS ALETA maupun keterangan saksi di ABT untuk perkara ini."
            />
          ) : (
            alur.saksi.map((s) => (
              <Card key={s.sumber + s.kunci}>
                <CardHeader>
                  <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                    <span className="capitalize">{s.sebutan}</span>
                    {s.nama ? <span className="font-normal text-muted-foreground">- {s.nama}</span> : null}
                    <Badge variant={s.sumber === "ALETA" ? "info" : "netral"}>
                      {s.sumber === "ALETA" ? "Lembar BAS ALETA" : "Keterangan saksi ABT"}
                    </Badge>
                  </CardTitle>
                  <CardDescription>{s.keterangan}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {s.baris.length === 0 ? <p className="text-sm text-muted-foreground">Belum ada tanya-jawab.</p> : null}
                  {s.baris.map((b) => {
                    const milik = perBagian.get(b.bagian) ?? [];
                    return (
                      <div key={b.bagian} className="border-b border-border/60 pb-3 last:border-0">
                        <p className="text-sm">
                          <span className="mr-1 text-xs tabular-nums text-muted-foreground">{b.urutan}.</span>
                          <span className="text-muted-foreground">Tanya{b.penanya ? ` (${b.penanya})` : ""}:</span> {b.pertanyaan}
                        </p>
                        <p className="mt-0.5 text-sm">
                          <span className="text-muted-foreground">Jawab:</span>{" "}
                          {b.jawaban || <span className="italic text-muted-foreground">belum dijawab</span>}
                        </p>
                        {milik.length > 0 ? (
                          <div className="mt-2 space-y-2">
                            {milik.map((k) => (
                              <KartuKomentar key={k.id} komentar={k} saya={saya} sibuk={sibuk} onTandai={tandai} />
                            ))}
                          </div>
                        ) : null}
                        {saya?.bolehMenulis ? (
                          terbuka === b.bagian ? (
                            <IsianKomentar
                              bagian={b.bagian}
                              kutipanAwal={b.jawaban}
                              sibuk={sibuk}
                              onKirim={kirim}
                              onBatal={() => setTerbuka("")}
                            />
                          ) : (
                            <Button size="sm" variant="ghost" className="mt-1 h-7 px-2 text-xs" onClick={() => setTerbuka(b.bagian)}>
                              <MessageSquarePlus className="mr-1 h-3.5 w-3.5" /> Komentari
                            </Button>
                          )
                        ) : null}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            ))
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Komentar umum dan alasan perceraian</CardTitle>
              <CardDescription>
                Untuk hal yang tidak menunjuk satu keterangan saksi - atau komentar yang bagiannya tidak lagi tampil di atas.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {komentarLain.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada.</p>
              ) : (
                komentarLain.map((k) => <KartuKomentar key={k.id} komentar={k} saya={saya} sibuk={sibuk} onTandai={tandai} />)
              )}
              {saya?.bolehMenulis ? (
                <div className="space-y-2">
                  <NativeSelect value={bagianUmum} onChange={(e) => setBagianUmum(e.target.value)} aria-label="Bagian">
                    <option value="umum">Umum</option>
                    {HURUF_ALASAN.map((h) => (
                      <option key={h} value={kunciAlasan(h)}>
                        Alasan perceraian huruf {h}
                      </option>
                    ))}
                  </NativeSelect>
                  <IsianKomentar key={bagianUmum} bagian={bagianUmum} kutipanAwal="" sibuk={sibuk} onKirim={kirim} />
                </div>
              ) : null}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
