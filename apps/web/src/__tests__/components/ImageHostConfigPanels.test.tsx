import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import {
  AliyunPanel,
  QiniuPanel,
  TencentPanel,
} from "../../components/Settings/ImageHostSettingsPanels";
import type { ImageHostConfig } from "../../services/image/ImageUploader";

const CDN_PLACEHOLDER = "https://cdn.example.com";

const panelProps = (viewingConfig: ImageHostConfig) => ({
  activeType: viewingConfig.type,
  viewingConfig,
  testResult: null,
  onConfigChange: vi.fn(),
  onTestConnection: vi.fn(),
  onActivate: vi.fn(),
});

describe("阿里云 OSS / 腾讯云 COS 自定义域名字段", () => {
  it("旧配置存在 endpoint 的域名会显示在自定义域名输入框里", () => {
    const config: ImageHostConfig = {
      type: "aliyun",
      config: { endpoint: "https://legacy.example.com" },
    };

    render(<AliyunPanel {...panelProps(config)} />);

    expect(screen.getByPlaceholderText(CDN_PLACEHOLDER)).toHaveValue(
      "https://legacy.example.com",
    );
  });

  it("在面板里修改自定义域名时写入 cdnHost 字段", () => {
    const config: ImageHostConfig = { type: "aliyun", config: {} };
    const props = panelProps(config);

    render(<AliyunPanel {...props} />);
    fireEvent.change(screen.getByPlaceholderText(CDN_PLACEHOLDER), {
      target: { value: "https://cdn.example.com" },
    });

    expect(props.onConfigChange).toHaveBeenCalledWith(
      "cdnHost",
      "https://cdn.example.com",
    );
  });

  it("腾讯云 COS 同样读旧字段、写新字段", () => {
    const config: ImageHostConfig = {
      type: "tencent",
      config: { endpoint: "https://legacy.example.com" },
    };
    const props = panelProps(config);

    render(<TencentPanel {...props} />);
    const input = screen.getByPlaceholderText(CDN_PLACEHOLDER);
    expect(input).toHaveValue("https://legacy.example.com");

    fireEvent.change(input, { target: { value: "https://cdn.example.com" } });
    expect(props.onConfigChange).toHaveBeenCalledWith(
      "cdnHost",
      "https://cdn.example.com",
    );
  });
});

describe("七牛云存储区域下拉", () => {
  it("只提供 SDK 支持的存储区域", () => {
    const config: ImageHostConfig = { type: "qiniu", config: {} };

    render(<QiniuPanel {...panelProps(config)} />);

    const values = screen
      .getAllByRole("option")
      .map((option) => option.getAttribute("value"));
    expect(values).toEqual(["z0", "cn-east-2", "z1", "z2", "na0", "as0"]);
  });

  it("已保存不受支持的区域时提示重新选择，且不默认成别的区域", () => {
    const config: ImageHostConfig = {
      type: "qiniu",
      config: { region: "ap-northeast-1" },
    };

    render(<QiniuPanel {...panelProps(config)} />);

    expect(
      screen.getByRole("option", { name: /ap-northeast-1（不可用/ }),
    ).toBeDisabled();
    expect(screen.getByRole("combobox")).toHaveValue("");
  });
});
