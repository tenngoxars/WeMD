import { useRef, useState, useEffect } from "react";
import {
  Bold,
  Italic,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Code,
  Link,
  Image,
  Minus,
  Loader2,
  Activity,
  Calendar,
  Database,
  Route,
  Workflow,
  GitGraph,
  Clock,
  Network,
  Binary,
  PieChart,
  ChevronRight,
  ChevronLeft,
  ListEnd,
} from "lucide-react";
import toast from "react-hot-toast";

import { ImageHostManager } from "../../services/image/ImageUploader";
import type { ImageHostConfig } from "../../services/image/ImageUploader";
import { setLinkToFootnoteEnabled } from "./ToolbarState";
import "./Toolbar.css";

interface ToolbarProps {
  onInsert: (prefix: string, suffix: string, placeholder: string) => void;
}

const mermaidPrimaryTemplates = [
  {
    icon: Workflow,
    label: "流程图",
    code: `graph TD
    A[开始] --> B{判断}
    B -- 是 --> C[执行操作]
    B -- 否 --> D[结束]
    C --> D`,
  },
  {
    icon: Clock,
    label: "时序图",
    code: `sequenceDiagram
    participant Alice
    participant Bob
    Alice->>Bob: Hello Bob, how are you?
    Bob-->>Alice: I am good thanks!
    Bob->>John: Hello John!`,
  },
  {
    icon: Network,
    label: "类图",
    code: `classDiagram
    class Animal {
        +String name
        +void eat()
    }
    class Duck {
        +void swim()
    }
    Animal <|-- Duck`,
  },
  {
    icon: GitGraph,
    label: "甘特图",
    code: `gantt
    title 项目开发计划
    dateFormat  YYYY-MM-DD
    section 设计
    需求分析       :a1, 2024-01-01, 3d
    原型设计       :after a1, 5d
    section 开发
    前端开发       :2024-01-10, 10d
    后端开发       :2024-01-10, 10d`,
  },
  {
    icon: Binary,
    label: "思维导图",
    code: `mindmap
  root((思维导图))
    主题一
      子节点 A
      子节点 B
    主题二
      子节点 C`,
  },
  {
    icon: PieChart,
    label: "饼图",
    code: `pie title 市场份额
    "产品 A" : 40
    "产品 B" : 30
    "产品 C" : 20
    "其他" : 10`,
  },
];

const mermaidMoreTemplates = [
  {
    icon: Activity,
    label: "状态图",
    code: `stateDiagram-v2
    [*] --> 空闲
    空闲 --> 处理中: 触发
    处理中 --> 完成: 成功
    处理中 --> 失败: 异常
    失败 --> 空闲
    完成 --> [*]`,
  },
  {
    icon: Database,
    label: "ER 图",
    code: `erDiagram
    USER ||--o{ ORDER : places
    USER {
        int id
        string name
    }
    ORDER {
        int id
        string status
    }`,
  },
  {
    icon: Calendar,
    label: "时间线",
    code: `timeline
    title 项目里程碑
    2024-01-01 : 立项
    2024-02-15 : 原型完成
    2024-03-20 : 开发完成
    2024-04-01 : 上线`,
  },
  {
    icon: Route,
    label: "用户旅程",
    code: `journey
    title 用户旅程
    section 认知
      了解产品: 5: 用户
    section 转化
      试用: 4: 用户
      购买: 3: 用户`,
  },
];

export function Toolbar({ onInsert }: ToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [showMermaidMenu, setShowMermaidMenu] = useState(false);
  const [showMermaidMore, setShowMermaidMore] = useState(false);
  const mermaidMenuRef = useRef<HTMLDivElement>(null);
  const mermaidMoreRef = useRef<HTMLDivElement>(null);
  const mermaidSubmenuRef = useRef<HTMLDivElement>(null);
  const [mermaidSubmenuSide, setMermaidSubmenuSide] = useState<
    "left" | "right"
  >("right");
  const [linkToFootnote, setLinkToFootnote] = useState(() => {
    const saved = localStorage.getItem("wemd-link-to-footnote");
    return saved === "true";
  });

  // 同步状态到全局变量和 localStorage
  useEffect(() => {
    setLinkToFootnoteEnabled(linkToFootnote);
    localStorage.setItem("wemd-link-to-footnote", String(linkToFootnote));
  }, [linkToFootnote]);

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        mermaidMenuRef.current &&
        !mermaidMenuRef.current.contains(event.target as Node)
      ) {
        setShowMermaidMenu(false);
        setShowMermaidMore(false);
      }
    };

    if (showMermaidMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showMermaidMenu]);

  useEffect(() => {
    if (!showMermaidMore) return;

    const updateSubmenuSide = () => {
      const container = mermaidMoreRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const spaceRight = window.innerWidth - rect.right;

      const isInRightHalf = rect.left > window.innerWidth / 2;
      const isTightSpace = spaceRight < 300;

      if (isInRightHalf || isTightSpace) {
        setMermaidSubmenuSide("left");
      } else {
        setMermaidSubmenuSide("right");
      }
    };

    const rafId = requestAnimationFrame(updateSubmenuSide);
    window.addEventListener("resize", updateSubmenuSide);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", updateSubmenuSide);
    };
  }, [showMermaidMore]);

  const tools = [
    {
      icon: Bold,
      label: "粗体",
      prefix: "**",
      suffix: "**",
      placeholder: "粗体文字",
    },
    {
      icon: Italic,
      label: "斜体",
      prefix: "*",
      suffix: "*",
      placeholder: "斜体文字",
    },
    {
      icon: Strikethrough,
      label: "删除线",
      prefix: "~~",
      suffix: "~~",
      placeholder: "删除文字",
    },
    {
      icon: Heading1,
      label: "一级标题",
      prefix: "# ",
      suffix: "",
      placeholder: "标题",
    },
    {
      icon: Heading2,
      label: "二级标题",
      prefix: "## ",
      suffix: "",
      placeholder: "标题",
    },
    {
      icon: Heading3,
      label: "三级标题",
      prefix: "### ",
      suffix: "",
      placeholder: "标题",
    },
    {
      icon: List,
      label: "无序列表",
      prefix: "- ",
      suffix: "",
      placeholder: "列表项",
    },
    {
      icon: ListOrdered,
      label: "有序列表",
      prefix: "1. ",
      suffix: "",
      placeholder: "列表项",
    },
    {
      icon: Quote,
      label: "引用",
      prefix: "> ",
      suffix: "",
      placeholder: "引用文字",
    },
    {
      icon: Code,
      label: "代码块",
      prefix: "```\n",
      suffix: "\n```",
      placeholder: "代码",
    },
    // Mermaid 按钮单独处理
    {
      icon: Link,
      label: "链接",
      prefix: "[",
      suffix: "](url)",
      placeholder: "链接文字",
    },
    {
      icon: Minus,
      label: "分割线",
      prefix: "\n---\n",
      suffix: "",
      placeholder: "",
    },
  ];

  const handleMermaidInsert = (code: string) => {
    onInsert("```mermaid\n", "\n```", code);
    setShowMermaidMenu(false);
    setShowMermaidMore(false);
  };

  const toggleMermaidMenu = () => {
    setShowMermaidMenu((prev) => {
      const next = !prev;
      if (!next) {
        setShowMermaidMore(false);
      }
      return next;
    });
  };

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 验证文件类型
    if (!file.type.startsWith("image/")) {
      toast.error("请选择图片文件");
      return;
    }

    // 验证文件大小（最大 2MB，微信公众号限制）
    if (file.size > 2 * 1024 * 1024) {
      const sizeMB = (file.size / 1024 / 1024).toFixed(1);
      toast.error(
        `请压缩图片后再试，公众号不支持超过 2MB 的图片外链(当前 ${sizeMB}MB)`,
        { duration: 4000 },
      );
      return;
    }

    setUploading(true);
    try {
      // 获取图床配置
      const configStr = localStorage.getItem("imageHostConfig");
      const config: ImageHostConfig = configStr
        ? JSON.parse(configStr)
        : { type: "official" };

      // 上传图片
      const manager = new ImageHostManager(config);
      const url = await manager.upload(file);

      // 插入 Markdown
      onInsert("![", `](${url})`, file.name.replace(/\.[^/.]+$/, ""));
      toast.success("图片上传成功");
    } catch (error) {
      console.error("图片上传失败:", error);
      toast.error(error instanceof Error ? error.message : "图片上传失败");
    } finally {
      setUploading(false);
      // 清空 input，允许重复上传同一文件
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const toggleLinkToFootnote = () => {
    const next = !linkToFootnote;
    setLinkToFootnote(next);
    toast.success(next ? "已开启：外链转脚注" : "已关闭：外链转脚注", {
      duration: 2000,
    });
  };

  return (
    <div className="md-toolbar">
      {tools.map((tool, index) => (
        <button
          key={index}
          className="md-toolbar-btn"
          onClick={() => onInsert(tool.prefix, tool.suffix, tool.placeholder)}
          data-tooltip={tool.label}
        >
          <tool.icon size={16} />
        </button>
      ))}

      {/* Mermaid 下拉菜单 */}
      <div className="md-toolbar-dropdown-container" ref={mermaidMenuRef}>
        <button
          className={`md-toolbar-btn ${showMermaidMenu ? "active" : ""}`}
          onClick={toggleMermaidMenu}
          data-tooltip="插入图表"
        >
          <Workflow size={16} />
        </button>

        {showMermaidMenu && (
          <div className="md-toolbar-dropdown-menu">
            {mermaidPrimaryTemplates.map((template, idx) => (
              <button
                key={idx}
                className="md-toolbar-dropdown-item"
                onClick={() => handleMermaidInsert(template.code)}
              >
                <template.icon size={14} className="mr-2" />
                <span>{template.label}</span>
              </button>
            ))}
            <div className="md-toolbar-dropdown-more" ref={mermaidMoreRef}>
              <button
                type="button"
                className={`md-toolbar-dropdown-item md-toolbar-dropdown-more-btn ${
                  showMermaidMore ? "active" : ""
                }`}
                onClick={() => setShowMermaidMore((prev) => !prev)}
                aria-expanded={showMermaidMore}
              >
                <span>查看更多</span>
                {mermaidSubmenuSide === "left" ? (
                  <ChevronLeft
                    size={12}
                    className="md-toolbar-dropdown-chevron"
                  />
                ) : (
                  <ChevronRight
                    size={12}
                    className="md-toolbar-dropdown-chevron"
                  />
                )}
              </button>
              {showMermaidMore && (
                <div
                  ref={mermaidSubmenuRef}
                  className={`md-toolbar-dropdown-submenu ${
                    mermaidSubmenuSide === "left" ? "is-left" : ""
                  }`}
                >
                  {mermaidMoreTemplates.map((template, idx) => (
                    <button
                      key={idx}
                      className="md-toolbar-dropdown-item"
                      onClick={() => handleMermaidInsert(template.code)}
                    >
                      <template.icon size={14} className="mr-2" />
                      <span>{template.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 图片上传按钮 */}
      <button
        className="md-toolbar-btn"
        onClick={handleImageClick}
        disabled={uploading}
        data-tooltip="上传图片"
      >
        {uploading ? (
          <Loader2 size={16} className="spinning" />
        ) : (
          <Image size={16} />
        )}
      </button>

      {/* 分隔符 */}
      <div className="md-toolbar-divider" />

      {/* 外链转脚注开关 */}
      <button
        className={`md-toolbar-btn md-toolbar-toggle ${linkToFootnote ? "active" : ""}`}
        onClick={toggleLinkToFootnote}
        data-tooltip={linkToFootnote ? "外链转脚注：开启" : "外链转脚注：关闭"}
      >
        <ListEnd size={16} />
      </button>

      {/* 隐藏的文件输入 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        style={{ display: "none" }}
      />
    </div>
  );
}
