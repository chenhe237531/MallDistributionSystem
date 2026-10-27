# 课程详情与课件解析

商家端「我的学习」的课程条目可点击进入课程详情页，详情页的课程内容来自商家资料目录的解析产物，
不是数据库里的静态文案。

## 数据链路

```
/Users/nitai/Downloads/资料/百依诺商家资料 (pptx / pdf / docx / mp4)
        │  pnpm materials:extract
        ▼
scripts/extract_training_materials.py
        │  解析：标题 / 小节 / 段落 / 页数 / 时长
        ▼
apps/api/src/training/data/course-materials.json   （随 nest build 复制到 dist）
        │  TrainingMaterialsService（进程内只读缓存）
        ▼
GET /api/training/courses/:id        → 课程结构 + 学习记录 + 配套课件清单
GET /api/training/materials/:id      → 单份课件正文（按小节）
GET /uploads/training/...            → 视频与图片型课件的页面图
        ▼
apps/mini-b/src/pages/training-detail/index.tsx   课程详情
apps/mini-b/src/pages/training-material/index.tsx 课件阅读
```

## 解析要点

| 格式 | 处理方式 |
| --- | --- |
| `.pptx` | 直读 OOXML（zip + XML），按 `<a:p>` 合并 run（避免「FMT / 产品 / 介绍」被拆成碎片），标题取 title 占位符，表格按行以「｜」拼接 |
| `.pdf` | `pdftotext -raw` 保序提取；剔除「百/英/诺」单字水印、纯页码、目录页（连续引导点）；按句末标点合并硬换行；按题号（`1.1`、`一、`）切节 |
| `.pdf`（横向页） | 幻灯片导出件按「一页一节」还原，避免多文本框串行导致小节碎裂 |
| `.pdf`（图片型） | 文字密度 < 150 字/页判定为图片版式，`pdftoppm` 渲染 900px 页面图，阅读页按页展示并可放大 |
| `.docx` | 版式表格压平成「字段：值」文本流，按 `一、二、三、` 与标题样式切节 |
| `.mp4` | `ffprobe` 读取时长/分辨率，复制到 `apps/api/uploads/training/` 由静态目录提供播放 |

## 课程映射

| 课件 | 归属课程 |
| --- | --- |
| FMT 产品及使用介绍（PPT） | 产品知识课 |
| FMT 产品介绍（PDF，图片版式） | 产品知识课 |
| 微生物 FMT Plus 创新科技转化 | 新人课、产品知识课 |
| 菌群移植项目介绍（2026） | 新人课 |
| 菌群移植产品宣讲（2026） | 产品知识课、合规课 |
| 菌群移植产品百问百答 | 产品知识课、合规课、采样与操作规范课 |
| 各适应症案例汇总 | 适应症案例教学 |
| 16S / 宏基因 / 宏基因 2026 报告模板 | 解读基础课 |
| 新技术新业务申请表（湖北省肿瘤医院） | 合规课、新人课 |
| 采样操作演示视频（54.mp4） | 采样与操作规范课 |

映射关系维护在脚本的 `DOC_SPECS` 中（`course_codes` 字段），新增资料时补一条即可。

## 重新生成

```bash
pnpm materials:extract          # 默认读取 /Users/nitai/Downloads/资料/百依诺商家资料
pnpm materials:extract --source /path/to/dir
```

产物 `course-materials.json` 入库，`apps/api/uploads/training/` 下的视频与页面图属于客户原始资料，
已加入 `.gitignore`，需在本地执行一次解析脚本。
