import type { ReactNode } from "react";

import "./tema-panel.css";

/** Semua halaman ALETA ABT memakai warna panel Blangko ABT by Derry Briantono. */
export default function TataLetakAletaAbt({ children }: { children: ReactNode }) {
  return <div className="aleta-abt-tema">{children}</div>;
}
