---
wemdSource: "apps/web/src/store/editorStore.ts defaultMarkdown, baseline 964525d"
---

# 欢迎使用 WeMD

这是一个现代化的 Markdown 编辑器，专为**微信公众号**排版设计。

## 1. 基础语法
**这是加粗文本**

*这是斜体文本*

***这是加粗斜体文本***

~~这是删除线文本~~

==这是高亮文本==

这是一个 [链接](https://github.com/your-repo)

## 2. 特殊格式
### 上标和下标

水的化学式：H~2~O

爱因斯坦质能方程：E=mc^2^

### Emoji 表情
今天天气真好 :sunny: 

让我们一起学习 :books: 

加油 :rocket:

## 3. 列表展示
### 无序列表
- 列表项 1
- 列表项 2
  - 子列表项 2.1
  - 子列表项 2.2

### 有序列表
1. 第一步
2. 第二步
3. 第三步

## 4. 引用
> 这是一个一级引用
> 
> > 这是一个二级引用
> > 
> > > 这是一个三级引用
> 

> [!TIP]
> 这是一个技巧提示块

> [!NOTE]
> 这是一个备注提示块

> [!IMPORTANT]
> 这是一个重要信息提示块

> [!WARNING]
> 这是一个警告提示块

> [!CAUTION]
> 这是一个危险提示块

## 5. 代码展示
### 行内代码
我们在代码中通常使用 `console.log()` 来输出信息。

### 代码块
```javascript
// JavaScript 示例
function hello() {
  console.log('Hello, WeMD!');
  const a = 1;
  const b = 2;
  return a + b;
}
```

## 6. 数学公式
行内公式: $E=mc^2$

行间公式:
$$
\int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pi}
$$

## 7. 脚注与链接建议
这里演示脚注的使用：[WeChat Markdown](https://github.com/tenngoxars/WeMD "WeMD 是一款专为公众号设计的编辑器") 可以极大提升排版效率。

在 WeMD 中，只需为链接添加“标题”（双引号里的文字），系统就会自动将其转换为文末脚注，这是最符合微信公众号习惯的排法。

## 8. 表格
| 姓名 | 年龄 | 职业 |
| :--- | :---: | ---: |
| 张三 | 18 | 工程师 |
| 李四 | 20 | 设计师 |
| 王五 | 22 | 产品经理 |

## 8. 分割线
---

## 9. 图片
![WeMD：专为微信公众号设计的现代化 Markdown 编辑器](https://img.wemd.app/example.jpg)

**开始编辑吧!** 🚀
