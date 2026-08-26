import fs from "node:fs";
import path from "node:path";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button } from "@/components/ui/button";

const root = process.cwd();

function readSource(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function listAppJsxFiles(relativeDir: string) {
  const dir = path.join(root, relativeDir);
  const files: string[] = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(root, fullPath).replaceAll("\\", "/");

    if (entry.isDirectory()) {
      if (relativePath === "src/test") continue;
      files.push(...listAppJsxFiles(relativePath));
    } else if (/\.(tsx|jsx)$/.test(entry.name)) {
      files.push(relativePath);
    }
  }

  return files;
}

function findNativeButtonsWithoutType(source: string) {
  const missing: string[] = [];
  const pattern = new RegExp("<" + "button\\b[\\s\\S]*?>", "g");
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(source))) {
    const tag = match[0];
    if (!/\btype\s*=/.test(tag)) {
      const line = source.slice(0, match.index).split(/\r?\n/).length;
      missing.push(`${line}: ${tag.replace(/\s+/g, " ").slice(0, 120)}`);
    }
  }

  return missing;
}

describe("button wiring", () => {
  it("uses non-submit buttons by default unless submit is explicit", () => {
    render(
      <form>
        <Button>Simpan</Button>
        <Button type="submit">Kirim</Button>
      </form>
    );

    expect(screen.getByRole("button", { name: "Simpan" }).getAttribute("type")).toBe("button");
    expect(screen.getByRole("button", { name: "Kirim" }).getAttribute("type")).toBe("submit");
  });

  it("keeps native app buttons explicit", () => {
    const files = listAppJsxFiles("src");

    const missing = files.flatMap((file) =>
      findNativeButtonsWithoutType(readSource(file)).map((item) => `${file}:${item}`)
    );

    expect(missing).toEqual([]);
  });

  it("does not leave placeholder ALETA Bot actions wired to empty anchors", () => {
    const source = readSource("src/components/portal/aleta-bot-admin.tsx");

    expect(source).not.toMatch(/href=["']#["']/);
    expect(source).not.toMatch(/actionHref:\s*["']#["']/);
    expect(source).not.toMatch(/onClick=\{\(\) => \{\}\}/);
  });

  it("disables ALETA Bot manual tests until a valid target exists", () => {
    const source = readSource("src/components/portal/aleta-bot-admin.tsx");

    expect(source).toContain("disabled={isSaving || !selectedTemplateId}");
    expect(source).toContain("disabled={isSaving || !selectedQueryId}");
    expect(source).toContain("disabled={isSaving || !selectedNotificationId}");
  });

  it("guards ALETA Bot manual send buttons against invalid state and double submit", () => {
    const source = readSource("src/components/portal/aleta-bot-manual-send.tsx");

    // Tombol TEST dan Aktual dinonaktifkan saat state belum valid atau sedang mengirim.
    expect(source.match(/disabled=\{!canSend\}/g)?.length).toBeGreaterThanOrEqual(2);
    expect(source).toContain("!sendState.inFlight &&");
    expect(source).toContain("selectedRecipients.length > 0 &&");
    expect(source).toContain("invalidSelectedCount === 0 &&");
    expect(source).toContain('(selectedRecipients.length === 1 || confirmMultiple)');
    // Tambah penerima butuh input terisi.
    expect(source).toContain("disabled={!newRecipientInput.trim()}");
    // Request ID diregenerasi setelah kirim sukses agar tidak duplikat.
    expect(source).toContain("clientRequestIdRef.current = makeClientRequestId()");
  });

  it("keeps employee WhatsApp detection links base-path safe", () => {
    const adminSource = readSource("src/components/portal/admin-panels.tsx");
    const botSource = readSource("src/components/portal/aleta-bot-admin.tsx");

    expect(adminSource).toContain('window.location.assign(apiPath("/admin/mapping-user-jabatan"))');
    expect(adminSource).not.toContain('window.location.href = "/admin/mapping-user-jabatan"');
    expect(botSource).toContain('apiPath("/admin/mapping-user-jabatan?missingWhatsapp=true")');
  });

  it("marks employee WhatsApp readiness green only when detection is complete", () => {
    const source = readSource("src/components/portal/aleta-bot-admin.tsx");

    expect(source).toContain('status: employeeWhatsappComplete ? "ready"');
    expect(source).toContain('Badge variant={employeeWhatsappComplete ? "success"');
    expect(source).toContain("if (!employeeWhatsappComplete && (employeeWhatsappCoverage < 0.8 || legacyFallbackUsedCount > 0))");
  });
});
