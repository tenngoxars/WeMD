import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ExportLongImageDialog } from "../../components/Export/ExportLongImageDialog";
import type { DesktopBridge } from "../../types/desktop";

vi.mock("../../services/exportFonts", () => ({
  formatFontSize: () => "12 KB",
  isExportFontLoaded: () => true,
  loadExportFont: vi.fn(),
  loadExportFontCatalog: async () => [
    {
      id: "wenkai",
      label: "霞鹜文楷",
      family: "LXGW WenKai",
      licenseFiles: ["wenkai/OFL.txt"],
      weights: [{ bytes: 12288 }],
    },
  ],
}));

const OPTIONS_KEY = "wemd-export-image-options";
const LICENSE_URL = "https://img.wemd.app/fonts/wenkai/OFL.txt";

const renderLicenseLink = async () => {
  render(<ExportLongImageDialog open onClose={vi.fn()} />);
  return screen.findByRole("link", { name: "字体许可" });
};

describe("长图导出的字体许可链接", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", {
      getItem: (key: string) =>
        key === OPTIONS_KEY ? JSON.stringify({ fontId: "wenkai" }) : null,
      setItem: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.wemdDesktop = undefined;
  });

  it("桌面端用系统浏览器打开许可文件，不在应用内导航", async () => {
    const openExternal = vi.fn(async () => {});
    const bridge: Pick<DesktopBridge, "platform" | "shell"> = {
      platform: "win32",
      shell: { openExternal },
    };
    window.wemdDesktop = bridge as DesktopBridge;

    expect(fireEvent.click(await renderLicenseLink())).toBe(false);
    expect(openExternal).toHaveBeenCalledExactlyOnceWith(LICENSE_URL);
  });

  it("网页版保留原生新标签页行为", async () => {
    const link = await renderLicenseLink();
    expect(link).toHaveAttribute("href", LICENSE_URL);
    expect(link).toHaveAttribute("target", "_blank");
    expect(fireEvent.click(link)).toBe(true);
  });
});
