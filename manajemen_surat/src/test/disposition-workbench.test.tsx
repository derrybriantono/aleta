import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DispositionWorkbench } from "@/components/portal/disposition-workbench";
import { PortalProvider } from "@/lib/app-state";
import { DEFAULT_ASSISTANT_JUDGE_CONFIG } from "@/lib/assistant-judge";
import {
  defaultAIConfig,
  defaultInstitutionIdentity,
  defaultWhatsAppWeb,
  dispositions,
  letters,
  moduleVisibility,
  personas,
} from "@/lib/mock-data";
import { type PortalStateData } from "@/lib/types";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  usePathname: () => "/disposisi/dsp-006",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ id: "dsp-006" }),
}));

function renderWorkbench(initialState: PortalStateData, dispositionId: string, letterId: string) {
  return render(
    <PortalProvider initialState={initialState}>
      <DispositionWorkbench
        disposition={dispositions.find((item) => item.id === dispositionId)!}
        letter={letters.find((item) => item.id === letterId)!}
      />
    </PortalProvider>
  );
}

describe("DispositionWorkbench", () => {
  beforeEach(() => {
    push.mockReset();
  });

  it("updates target users when quick target selection changes", () => {
    renderWorkbench(
      {
        currentUserId: "usr-ketua",
        users: personas,
        letters,
        dispositions,
        moduleVisibility,
        theme: "light",
        aiConfig: defaultAIConfig,
        whatsAppWeb: defaultWhatsAppWeb,
        institutionIdentity: defaultInstitutionIdentity,
        assistantJudgeConfig: DEFAULT_ASSISTANT_JUDGE_CONFIG,
      },
      "dsp-006",
      "srt-003"
    );

    expect(screen.getByTestId("switch-bypass")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("switch-bypass"));

    fireEvent.click(screen.getByTestId("target-position-pos-arsiparis"));

    expect((screen.getByTestId("select-user") as HTMLSelectElement).value).toBe("usr-budi");
  });

  it("submits follow-up when final recipient closes the task", () => {
    renderWorkbench(
      {
        currentUserId: "usr-ahmad",
        users: personas,
        letters,
        dispositions,
        moduleVisibility,
        theme: "light",
        aiConfig: defaultAIConfig,
        whatsAppWeb: defaultWhatsAppWeb,
        institutionIdentity: defaultInstitutionIdentity,
        assistantJudgeConfig: DEFAULT_ASSISTANT_JUDGE_CONFIG,
      },
      "dsp-003",
      "srt-001"
    );

    fireEvent.change(screen.getByTestId("textarea-followup"), {
      target: { value: "Rekap tiga perkara prioritas sudah dilampirkan." },
    });
    fireEvent.click(screen.getByTestId("submit-followup"));

    expect(push).toHaveBeenCalledWith("/surat/srt-001");
  });
});
