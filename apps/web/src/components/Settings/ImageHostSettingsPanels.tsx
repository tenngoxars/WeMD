import {
  CheckCircle2,
  CircleAlert,
  Cloud,
  Image as ImageIcon,
  LoaderCircle,
  ShieldCheck,
  Zap,
} from "lucide-react";
import type { ImageHostConfig } from "../../services/image/ImageUploader";

export interface HostTabProps {
  activeType: ImageHostConfig["type"];
  viewingType: ImageHostConfig["type"];
  onTabChange: (type: ImageHostConfig["type"]) => void;
}

export interface HostTestResult {
  status: "loading" | "success" | "error";
  message: string;
}

function TestResultMessage({ result }: { result: HostTestResult }) {
  const ResultIcon =
    result.status === "success"
      ? CheckCircle2
      : result.status === "error"
        ? CircleAlert
        : LoaderCircle;

  return (
    <div
      className={`test-result test-result--${result.status}`}
      role="status"
      aria-live="polite"
    >
      <ResultIcon
        className={result.status === "loading" ? "test-result__spinner" : ""}
        size={14}
        strokeWidth={2}
        aria-hidden="true"
      />
      <span>{result.message}</span>
    </div>
  );
}

export const HostTabs = ({
  activeType,
  viewingType,
  onTabChange,
}: HostTabProps) => {
  return (
    <div className="host-tabs">
      <button
        className={`host-tab ${viewingType === "official" ? "active" : ""}`}
        onClick={() => onTabChange("official")}
      >
        官方图床
        {activeType === "official" && (
          <span className="tab-active-badge">使用中</span>
        )}
      </button>
      <button
        className={`host-tab ${viewingType === "qiniu" ? "active" : ""}`}
        onClick={() => onTabChange("qiniu")}
      >
        七牛云
        {activeType === "qiniu" && (
          <span className="tab-active-badge">使用中</span>
        )}
      </button>
      <button
        className={`host-tab ${viewingType === "aliyun" ? "active" : ""}`}
        onClick={() => onTabChange("aliyun")}
      >
        阿里云 OSS
        {activeType === "aliyun" && (
          <span className="tab-active-badge">使用中</span>
        )}
      </button>
      <button
        className={`host-tab ${viewingType === "tencent" ? "active" : ""}`}
        onClick={() => onTabChange("tencent")}
      >
        腾讯云 COS
        {activeType === "tencent" && (
          <span className="tab-active-badge">使用中</span>
        )}
      </button>
      <button
        className={`host-tab ${viewingType === "s3" ? "active" : ""}`}
        onClick={() => onTabChange("s3")}
      >
        S3 兼容
        {activeType === "s3" && (
          <span className="tab-active-badge">使用中</span>
        )}
      </button>
    </div>
  );
};

interface OfficialPanelProps {
  activeType: ImageHostConfig["type"];
  onActivate: () => void;
}

export const OfficialHostPanel = ({
  activeType,
  onActivate,
}: OfficialPanelProps) => {
  return (
    <div className="official-host-intro">
      <div className="official-host-summary">
        <div className="intro-icon-wrapper">
          <Cloud size={48} strokeWidth={1.5} className="primary-icon" />
        </div>
        <div className="intro-copy">
          <h3>官方托管服务</h3>
          <p>无需额外配置，直接用于公众号图片上传</p>
        </div>
        {activeType === "official" && (
          <div className="active-status official-active-status">
            <span className="pulsing-dot"></span>
            <span>当前已启用官方图床</span>
          </div>
        )}
      </div>

      <div className="official-feature-list" aria-label="官方图床能力">
        <div className="feature-item">
          <div className="feature-icon">
            <Zap size={20} />
          </div>
          <div className="feature-text">
            <strong>高速访问</strong>
            <span>基于全球边缘网络，加载流畅</span>
          </div>
        </div>
        <div className="feature-item">
          <div className="feature-icon">
            <ShieldCheck size={20} />
          </div>
          <div className="feature-text">
            <strong>安全稳定</strong>
            <span>无需配置 Key，HTTPS 加密传输</span>
          </div>
        </div>
        <div className="feature-item">
          <div className="feature-icon">
            <ImageIcon size={20} />
          </div>
          <div className="feature-text">
            <strong>开箱即用</strong>
            <span>默认集成，专注于内容创作</span>
          </div>
        </div>
      </div>

      {activeType !== "official" && (
        <div className="official-host-actions">
          <button className="btn-activate" onClick={onActivate}>
            启用官方图床
          </button>
        </div>
      )}
    </div>
  );
};

interface HostConfigPanelProps {
  activeType: ImageHostConfig["type"];
  viewingConfig: ImageHostConfig;
  testResult: HostTestResult | null;
  onConfigChange: (key: string, value: string) => void;
  onTestConnection: () => void;
  onActivate: (type: ImageHostConfig["type"]) => void;
}

export const QiniuPanel = ({
  activeType,
  viewingConfig,
  testResult,
  onConfigChange,
  onTestConnection,
  onActivate,
}: HostConfigPanelProps) => {
  return (
    <div className="host-config">
      {activeType === "qiniu" && (
        <div className="active-status">
          <span className="pulsing-dot"></span>
          <span>当前使用中</span>
        </div>
      )}
      <div className="config-field">
        <label>AccessKey</label>
        <input
          type="text"
          placeholder="从七牛云控制台获取"
          value={viewingConfig.config?.accessKey || ""}
          onChange={(e) => onConfigChange("accessKey", e.target.value)}
        />
      </div>
      <div className="config-field">
        <label>SecretKey</label>
        <input
          type="password"
          placeholder="从七牛云控制台获取"
          value={viewingConfig.config?.secretKey || ""}
          onChange={(e) => onConfigChange("secretKey", e.target.value)}
        />
      </div>
      <div className="config-field">
        <label>存储空间名称（Bucket）</label>
        <input
          type="text"
          placeholder="your-bucket"
          value={viewingConfig.config?.bucket || ""}
          onChange={(e) => onConfigChange("bucket", e.target.value)}
        />
      </div>
      <div className="config-field">
        <label>存储区域</label>
        <select
          value={viewingConfig.config?.region || "z0"}
          onChange={(e) => onConfigChange("region", e.target.value)}
          style={{
            width: "100%",
            padding: "8px 12px",
            borderRadius: "6px",
            border: "1px solid #e2e8f0",
            fontSize: "14px",
            color: "#1e293b",
            backgroundColor: "white",
          }}
        >
          <option value="z0">华东-浙江 (z0)</option>
          <option value="cn-east-2">华东-浙江2 (cn-east-2)</option>
          <option value="z1">华北-河北 (z1)</option>
          <option value="z2">华南-广东 (z2)</option>
          <option value="na0">北美-洛杉矶 (na0)</option>
          <option value="as0">亚太-新加坡 (as0)</option>
          <option value="ap-northeast-1">亚太-首尔 (ap-northeast-1)</option>
        </select>
      </div>
      <div className="config-field">
        <label>CDN 域名</label>
        <input
          type="text"
          placeholder="https://xxx.clouddn.com（七牛云测试域名需加 http://）"
          value={viewingConfig.config?.domain || ""}
          onChange={(e) => onConfigChange("domain", e.target.value)}
        />
      </div>
      <div className="config-footer">
        <small>
          <a href="https://portal.qiniu.com/kodo/bucket" target="_blank">
            七牛云控制台
          </a>
        </small>
        {testResult && <TestResultMessage result={testResult} />}
        <button className="btn-test-connection" onClick={onTestConnection}>
          测试连接
        </button>
      </div>
      {activeType !== "qiniu" && (
        <button className="btn-activate" onClick={() => onActivate("qiniu")}>
          启用七牛云图床
        </button>
      )}
    </div>
  );
};

export const AliyunPanel = ({
  activeType,
  viewingConfig,
  testResult,
  onConfigChange,
  onTestConnection,
  onActivate,
}: HostConfigPanelProps) => {
  return (
    <div className="host-config">
      {activeType === "aliyun" && (
        <div className="active-status">
          <span className="pulsing-dot"></span>
          <span>当前使用中</span>
        </div>
      )}
      <div className="config-field">
        <label>AccessKey ID</label>
        <input
          type="text"
          placeholder="从阿里云控制台获取"
          value={viewingConfig.config?.accessKeyId || ""}
          onChange={(e) => onConfigChange("accessKeyId", e.target.value)}
        />
      </div>
      <div className="config-field">
        <label>AccessKey Secret</label>
        <input
          type="password"
          placeholder="从阿里云控制台获取"
          value={viewingConfig.config?.accessKeySecret || ""}
          onChange={(e) => onConfigChange("accessKeySecret", e.target.value)}
        />
      </div>
      <div className="config-field">
        <label>Bucket 名称</label>
        <input
          type="text"
          placeholder="your-bucket"
          value={viewingConfig.config?.bucket || ""}
          onChange={(e) => onConfigChange("bucket", e.target.value)}
        />
      </div>
      <div className="config-field">
        <label>地域节点</label>
        <input
          type="text"
          placeholder="oss-cn-hangzhou"
          value={viewingConfig.config?.region || ""}
          onChange={(e) => onConfigChange("region", e.target.value)}
        />
        <small>例如：oss-cn-hangzhou（杭州）、oss-cn-beijing（北京）</small>
      </div>
      <div className="config-field">
        <label>自定义域名（可选）</label>
        <input
          type="text"
          placeholder="https://cdn.example.com"
          value={viewingConfig.config?.endpoint || ""}
          onChange={(e) => onConfigChange("endpoint", e.target.value)}
        />
      </div>
      <div className="config-footer">
        <small>
          <a href="https://oss.console.aliyun.com/bucket" target="_blank">
            阿里云 OSS 控制台
          </a>
        </small>
        {testResult && <TestResultMessage result={testResult} />}
        <button className="btn-test-connection" onClick={onTestConnection}>
          测试连接
        </button>
      </div>
      {activeType !== "aliyun" && (
        <button className="btn-activate" onClick={() => onActivate("aliyun")}>
          启用阿里云 OSS
        </button>
      )}
    </div>
  );
};

export const TencentPanel = ({
  activeType,
  viewingConfig,
  testResult,
  onConfigChange,
  onTestConnection,
  onActivate,
}: HostConfigPanelProps) => {
  return (
    <div className="host-config">
      {activeType === "tencent" && (
        <div className="active-status">
          <span className="pulsing-dot"></span>
          <span>当前使用中</span>
        </div>
      )}
      <div className="config-field">
        <label>SecretId</label>
        <input
          type="text"
          placeholder="从腾讯云控制台获取"
          value={viewingConfig.config?.secretId || ""}
          onChange={(e) => onConfigChange("secretId", e.target.value)}
        />
      </div>
      <div className="config-field">
        <label>SecretKey</label>
        <input
          type="password"
          placeholder="从腾讯云控制台获取"
          value={viewingConfig.config?.secretKey || ""}
          onChange={(e) => onConfigChange("secretKey", e.target.value)}
        />
      </div>
      <div className="config-field">
        <label>存储桶名称（Bucket）</label>
        <input
          type="text"
          placeholder="your-bucket-1234567890"
          value={viewingConfig.config?.bucket || ""}
          onChange={(e) => onConfigChange("bucket", e.target.value)}
        />
        <small>格式：bucketname-appid</small>
      </div>
      <div className="config-field">
        <label>所属地域</label>
        <input
          type="text"
          placeholder="ap-guangzhou"
          value={viewingConfig.config?.region || ""}
          onChange={(e) => onConfigChange("region", e.target.value)}
        />
        <small>例如：ap-guangzhou（广州）、ap-beijing（北京）</small>
      </div>
      <div className="config-field">
        <label>自定义域名（可选）</label>
        <input
          type="text"
          placeholder="https://cdn.example.com"
          value={viewingConfig.config?.endpoint || ""}
          onChange={(e) => onConfigChange("endpoint", e.target.value)}
        />
      </div>
      <div className="config-footer">
        <small>
          <a href="https://console.cloud.tencent.com/cos" target="_blank">
            腾讯云 COS 控制台
          </a>
        </small>
        {testResult && <TestResultMessage result={testResult} />}
        <button className="btn-test-connection" onClick={onTestConnection}>
          测试连接
        </button>
      </div>
      {activeType !== "tencent" && (
        <button className="btn-activate" onClick={() => onActivate("tencent")}>
          启用腾讯云 COS
        </button>
      )}
    </div>
  );
};

export const S3Panel = ({
  activeType,
  viewingConfig,
  testResult,
  onConfigChange,
  onTestConnection,
  onActivate,
}: HostConfigPanelProps) => {
  return (
    <div className="host-config">
      {activeType === "s3" && (
        <div className="active-status">
          <span className="pulsing-dot"></span>
          <span>当前使用中</span>
        </div>
      )}
      <div className="config-field">
        <label>Endpoint（必填）</label>
        <input
          type="text"
          placeholder="https://s3.amazonaws.com 或 https://xxx.r2.cloudflarestorage.com"
          value={viewingConfig.config?.endpoint || ""}
          onChange={(e) => onConfigChange("endpoint", e.target.value)}
        />
        <small>S3 服务地址，不同服务商格式不同</small>
      </div>
      <div className="config-field">
        <label>Region（必填）</label>
        <input
          type="text"
          placeholder="us-east-1 或 auto"
          value={viewingConfig.config?.region || ""}
          onChange={(e) => onConfigChange("region", e.target.value)}
        />
        <small>存储区域，Cloudflare R2 可填 auto</small>
      </div>
      <div className="config-field">
        <label>Access Key ID（必填）</label>
        <input
          type="text"
          placeholder="从服务商控制台获取"
          value={viewingConfig.config?.accessKeyId || ""}
          onChange={(e) => onConfigChange("accessKeyId", e.target.value)}
        />
      </div>
      <div className="config-field">
        <label>Secret Access Key（必填）</label>
        <input
          type="password"
          placeholder="从服务商控制台获取"
          value={viewingConfig.config?.secretAccessKey || ""}
          onChange={(e) => onConfigChange("secretAccessKey", e.target.value)}
        />
      </div>
      <div className="config-field">
        <label>Bucket 名称（必填）</label>
        <input
          type="text"
          placeholder="your-bucket"
          value={viewingConfig.config?.bucket || ""}
          onChange={(e) => onConfigChange("bucket", e.target.value)}
        />
      </div>
      <div className="config-field">
        <label>路径前缀（可选）</label>
        <input
          type="text"
          placeholder="images/wemd"
          value={viewingConfig.config?.pathPrefix || ""}
          onChange={(e) => onConfigChange("pathPrefix", e.target.value)}
        />
        <small>图片存储的目录前缀</small>
      </div>
      <div className="config-field">
        <label>自定义域名（可选）</label>
        <input
          type="text"
          placeholder="https://cdn.example.com"
          value={viewingConfig.config?.customDomain || ""}
          onChange={(e) => onConfigChange("customDomain", e.target.value)}
        />
        <small>用于访问图片的 CDN 或自定义域名</small>
      </div>
      <div className="config-field">
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={viewingConfig.config?.forcePathStyle || false}
            onChange={(e) =>
              onConfigChange("forcePathStyle", e.target.checked ? "true" : "")
            }
            style={{ width: "auto", margin: 0 }}
          />
          <span>强制 Path Style</span>
        </label>
        <small>MinIO 等自建服务需要开启此选项</small>
      </div>
      <div className="config-field">
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={viewingConfig.config?.legacyCompatibility || false}
            onChange={(e) =>
              onConfigChange(
                "legacyCompatibility",
                e.target.checked ? "true" : "",
              )
            }
            style={{ width: "auto", margin: 0 }}
          />
          <span>兼容旧版 S3</span>
        </label>
        <small>
          老版本 S3 兼容服务报 501 NotImplemented 时开启（不发送新版 SDK
          附加的校验和、x-amz-user-agent 等请求头与 x-id 查询参数）
        </small>
      </div>
      <div className="config-footer">
        {testResult && <TestResultMessage result={testResult} />}
        <button className="btn-test-connection" onClick={onTestConnection}>
          测试连接
        </button>
      </div>
      {activeType !== "s3" && (
        <button className="btn-activate" onClick={() => onActivate("s3")}>
          启用 S3 图床
        </button>
      )}
    </div>
  );
};
