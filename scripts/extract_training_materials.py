#!/usr/bin/env python3
"""把「百依诺商家资料」目录里的课件解析为结构化课程资料。

支持格式：
- .pptx  —— 直接解析 OOXML（按段落合并 run，含表格单元格），零第三方依赖
- .pdf   —— 调用 poppler 的 pdftotext（-raw 保序），清洗水印/页码后按标题切节
- .docx  —— 直接解析 word/document.xml（标题样式 + 表格）
- .mp4   —— ffprobe 读取时长/分辨率，作为视频课件登记

输出：apps/api/src/training/data/course-materials.json（由接口层读取）
用法：python3 scripts/extract_training_materials.py [--source DIR] [--out FILE]
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import unicodedata
import zipfile
from dataclasses import dataclass, field
from pathlib import Path
from xml.etree import ElementTree as ET

DEFAULT_SOURCE = "/Users/nitai/Downloads/资料/百依诺商家资料"
REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OUT = REPO_ROOT / "apps/api/src/training/data/course-materials.json"
VIDEO_TARGET_DIR = REPO_ROOT / "apps/api/uploads/training"

A_NS = "http://schemas.openxmlformats.org/drawingml/2006/main"
P_NS = "http://schemas.openxmlformats.org/presentationml/2006/main"
W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"

# 水印：正文里混入的单字「百 / 英 / 诺」，单独成行
WATERMARK_LINE = re.compile(r"^[\s百英诺·|]+$")
PAGE_NUMBER_LINE = re.compile(r"^[\s\-—–_·]*\d{1,4}[\s\-—–_·]*$")
SENTENCE_END = ("。", "！", "？", "；", "：", "…", "”", "」", "】", ")", "）")
HEADING_PATTERNS = [
    re.compile(r"^第[一二三四五六七八九十百零\d]+[章节部分篇]"),
    re.compile(r"^[一二三四五六七八九十]+[、.．]"),
    re.compile(r"^\d+(\.\d+){0,2}[、.．]?\s*\S"),
    re.compile(r"^（[一二三四五六七八九十\d]+）"),
    re.compile(r"^\(?[0-9]{1,2}\)?[、.．)]\s*\S"),
]


# ---------------------------------------------------------------- 文档元数据

@dataclass
class DocSpec:
    """人工维护的课件元信息（标题/摘要/归属课程）。"""

    slug: str
    title: str
    file: str
    kind: str  # slides / report / handout / form / video
    summary: str
    course_codes: list[str]
    tags: list[str] = field(default_factory=list)


DOC_SPECS = [
    DocSpec(
        slug="fmt-product-pptx",
        title="FMT 产品及使用介绍（产品手册）",
        file="FMT产品介绍(2).pptx",
        kind="slides",
        summary="逐页拆解 FMT 产品矩阵：健康人源菌群胶囊（标准版/升级版）、菌泥、专用辅剂的适用场景、产品定位与核心优势，含活菌量、包埋工艺等关键卖点。",
        course_codes=["product_knowledge"],
        tags=["产品矩阵", "剂型", "卖点"],
    ),
    DocSpec(
        slug="fmt-product-pdf",
        title="FMT 产品介绍（标准版）",
        file="FMT产品介绍20260611.pdf",
        kind="slides",
        summary="PDF 版产品介绍，覆盖特殊膳食益生菌、益生元与膳食纤维等健康医疗产品线的用户画像、核心诉求与配方优势。",
        course_codes=["product_knowledge"],
        tags=["健康医疗", "益生菌", "特殊膳食"],
    ),
    DocSpec(
        slug="fmt-plus-tech-pptx",
        title="微生物 FMT Plus 创新科技转化",
        file="微生物FMT plus创新科技转化 -06.pptx",
        kind="slides",
        summary="公司技术底座与转化路径：同济医院成果转化背景、GMP 厂房与专利布局、FMT Plus 平台的技术壁垒与临床合作方式。",
        course_codes=["newbie_course", "product_knowledge"],
        tags=["公司介绍", "技术平台", "成果转化"],
    ),
    DocSpec(
        slug="fmt-project-pptx",
        title="菌群移植项目介绍（2026 版）",
        file="百英诺科技菌群移植项目介绍20260604.pptx",
        kind="slides",
        summary="项目落地全景：项目背景、肠菌移植技术原理、项目价值与应用场景，适合作为新商家入场的第一份通识材料。",
        course_codes=["newbie_course"],
        tags=["项目背景", "合作模式", "准入"],
    ),
    DocSpec(
        slug="fmt-marketing-pdf",
        title="菌群移植产品宣讲（2026）",
        file="菌群移植产品宣讲PPT-百英诺科技2026.pdf",
        kind="slides",
        summary="对外宣讲标准课件：公司介绍、产品线、临床应用、理论支撑与 FMT Plus 平台五大部分，可直接复用的标准讲稿结构。",
        course_codes=["product_knowledge", "compliance_course"],
        tags=["宣讲", "标准话术", "临床应用"],
    ),
    DocSpec(
        slug="fmt-faq-pdf",
        title="菌群移植产品百问百答",
        file="百英诺科技-菌群移植产品百问百答20260206.pdf",
        kind="handout",
        summary="按「菌群检测 / 菌群移植诊疗 / 报告与售后」分组的问答手册，逐题给出简答口径，是应对客户提问与合规表达的核心底稿。",
        course_codes=["product_knowledge", "compliance_course", "sampling_ops"],
        tags=["问答", "客户异议", "合规口径"],
    ),
    DocSpec(
        slug="fmt-cases-pptx",
        title="菌群移植各适应症案例汇总",
        file="菌群移植各适应症案例汇总.pptx",
        kind="slides",
        summary="按肿瘤、精神、代谢、肠道、抗衰抗炎五类适应症整理的案例集，含评分/指标前后对比，用于案例教学时的规范引用。",
        course_codes=["case_teaching"],
        tags=["案例", "适应症", "指标对比"],
    ),
    DocSpec(
        slug="report-16s-pdf",
        title="百英诺 16S 报告模板",
        file="百英诺16S报告模板.pdf",
        kind="report",
        summary="16S 检测报告的完整版式样例：样本信息、菌群多样性、门属水平构成与健康风险提示，逐页对应解读顺序。",
        course_codes=["interpretation_basics"],
        tags=["16S", "报告模板", "解读"],
    ),
    DocSpec(
        slug="report-metagenome-pdf",
        title="百英诺宏基因报告模板",
        file="百英诺宏基因报告模版.pdf",
        kind="report",
        summary="宏基因组报告模板（简版），含检测方法、菌群结构分析与主要风险条目，适合首次解读时对照使用。",
        course_codes=["interpretation_basics"],
        tags=["宏基因", "报告模板"],
    ),
    DocSpec(
        slug="report-metagenome-2026-pdf",
        title="百英诺宏基因检测报告模板（2026-08）",
        file="百英诺宏基因检测报告模板20260807.pdf",
        kind="report",
        summary="最新版宏基因检测报告模板，指标项与风险分级更细，作为对外解释报告时的唯一版本依据。",
        course_codes=["interpretation_basics"],
        tags=["宏基因", "新版模板", "风险分级"],
    ),
    DocSpec(
        slug="hospital-application-docx",
        title="新技术新业务申请表（湖北省肿瘤医院）",
        file="湖北省肿瘤 -2024.12新技术新业务申请表.docx",
        kind="form",
        summary="医院端开展菌群移植所需的新技术新业务申报材料样例，含项目简介、适应症、操作规范与风险预案，是机构准入环节的合规模板。",
        course_codes=["compliance_course", "newbie_course"],
        tags=["机构准入", "申报材料", "风险预案"],
    ),
    DocSpec(
        slug="sampling-guide-video",
        title="采样操作演示视频",
        file="54.mp4",
        kind="video",
        summary="采样全流程演示：取样前准备、取样部位与取量、采样管封存与信息标记，配合《采样与操作规范课》边看边练。",
        course_codes=["sampling_ops"],
        tags=["采样", "操作演示", "视频"],
    ),
]


# ---------------------------------------------------------------- 文本清洗

def normalize_text(value: str) -> str:
    # 只做 NFC，保留全角标点（NFKC 会把「，？：（）」压成半角，中文排版会失真）
    value = unicodedata.normalize("NFC", value)
    value = value.replace("\u200b", "").replace("\ufeff", "")
    value = value.replace("\xa0", " ")
    value = re.sub(r"[ \t]+", " ", value)
    # PDF 取词常在中文字标点后多出一个空格，中文排版下应当删掉（英文之间的空格保留）
    value = re.sub(r"(?<=[，。；：！？、）】」])\s+(?=[^\x00-\x7f])", "", value)
    value = re.sub(r"(?<=[^\x00-\x7f])\s+(?=[，。；：！？、（）【】」])", "", value)
    return value.strip()


def strip_dot_leader(line: str) -> str:
    """目录行的引导点与页码：『1.1 意义 .......... 5』→『1.1 意义』"""
    return re.sub(r"[.．·。]{3,}\s*\d{0,4}\s*$", "", line).strip()


def is_toc_page(lines: list[str]) -> bool:
    if not lines:
        return False
    dotted = sum(1 for line in lines if re.search(r"[.．·。]{4,}\s*\d{0,4}\s*$", line))
    return dotted >= 4 and dotted / len(lines) > 0.3


def is_noise(line: str) -> bool:
    if not line:
        return True
    if WATERMARK_LINE.match(line):
        return True
    if PAGE_NUMBER_LINE.match(line):
        return True
    # 目录引导符残留：'...... 5'
    if re.fullmatch(r"[.·。\s]{3,}\d{1,3}", line):
        return True
    return False


def is_heading(line: str) -> bool:
    if len(line) > 42:
        return False
    # 「A、中药：」「简答：」这类是列表标签/引导语，不是独立小节
    if line.endswith(("：", ":", "，", ",", "；", ";")):
        return False
    if line.endswith(("？", "?")) and len(line) <= 40:
        return True
    # 数字编号必须带分隔符（『3肠道…』是列表项，不当作小节）
    numbered = re.match(r"^(\d+(?:\.\d+){0,2})([、.．\s])(\S)", line)
    if numbered:
        return len(line) <= 30
    return any(pattern.match(line) for pattern in HEADING_PATTERNS[0:2] + HEADING_PATTERNS[3:4])


def join_wrapped_lines(lines: list[str]) -> list[str]:
    """PDF 硬换行合并：上一行未以句末标点收尾且足够长时与下一行拼接。"""
    out: list[str] = []
    buffer = ""
    for raw in lines:
        line = raw.strip()
        if not line:
            continue
        if not buffer:
            buffer = line
            continue
        prev_ends_sentence = buffer.endswith(SENTENCE_END)
        prev_is_short = len(buffer) <= 24
        line_starts_new = is_heading(line) or re.match(r"^[·•\-—*①-⑳]", line)
        if prev_ends_sentence or prev_is_short or line_starts_new:
            out.append(buffer)
            buffer = line
        else:
            buffer = buffer + line
    if buffer:
        out.append(buffer)
    return out


def dedupe(paragraphs: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for paragraph in paragraphs:
        key = paragraph.strip()
        if not key or key in seen:
            continue
        # 单字/双字碎片（水印残留）丢弃
        if len(key) < 2:
            continue
        seen.add(key)
        out.append(key)
    return out


# ---------------------------------------------------------------- PPTX

def _paragraph_text(paragraph: ET.Element) -> str:
    parts: list[str] = []
    for node in paragraph.iter():
        if node.tag == f"{{{A_NS}}}t" and node.text:
            parts.append(node.text)
        elif node.tag == f"{{{A_NS}}}br":
            parts.append("\n")
    return normalize_text("".join(parts))


def _is_title_shape(shape: ET.Element) -> bool:
    for placeholder in shape.iter(f"{{{P_NS}}}ph"):
        if placeholder.get("type") in {"title", "ctrTitle"}:
            return True
    return False


def parse_pptx(path: Path) -> tuple[list[dict], int]:
    with zipfile.ZipFile(path) as archive:
        names = archive.namelist()
        slide_names = sorted(
            (name for name in names if re.fullmatch(r"ppt/slides/slide\d+\.xml", name)),
            key=lambda name: int(re.search(r"(\d+)", name.rsplit("/", 1)[-1]).group(1)),
        )
        sections: list[dict] = []
        for index, name in enumerate(slide_names, start=1):
            root = ET.fromstring(archive.read(name))
            title = ""
            paragraphs: list[str] = []
            for shape in root.iter(f"{{{P_NS}}}sp"):
                texts = [
                    text
                    for text in (
                        _paragraph_text(paragraph)
                        for paragraph in shape.iter(f"{{{A_NS}}}p")
                    )
                    if text
                ]
                if not texts:
                    continue
                if not title and _is_title_shape(shape):
                    title = texts[0]
                    texts = texts[1:]
                paragraphs.extend(texts)
            for table in root.iter(f"{{{A_NS}}}tbl"):
                for row in table.iter(f"{{{A_NS}}}tr"):
                    cells: list[str] = []
                    for cell in row.iter(f"{{{A_NS}}}tc"):
                        cell_text = " ".join(
                            text
                            for text in (
                                _paragraph_text(paragraph)
                                for paragraph in cell.iter(f"{{{A_NS}}}p")
                            )
                            if text
                        )
                        cells.append(cell_text.strip())
                    row_text = "｜".join([cell for cell in cells if cell])
                    if row_text and len(row_text) > 1:
                        paragraphs.append(row_text)
            paragraphs = dedupe(
                line
                for text in paragraphs
                for line in text.split("\n")
                if normalize_text(line)
            )
            if not title and paragraphs:
                title = paragraphs[0]
                paragraphs = paragraphs[1:]
            if not title and not paragraphs:
                continue
            sections.append(
                {
                    "index": len(sections) + 1,
                    "title": title or f"第 {index} 页",
                    "page": index,
                    "paragraphs": paragraphs,
                }
            )
        return sections, len(slide_names)


# ---------------------------------------------------------------- DOCX

def _docx_paragraph_text(paragraph: ET.Element) -> str:
    parts: list[str] = []
    for node in paragraph.iter():
        if node.tag == f"{{{W_NS}}}t" and node.text:
            parts.append(node.text)
        elif node.tag in {f"{{{W_NS}}}br", f"{{{W_NS}}}cr"}:
            parts.append("\n")
        elif node.tag == f"{{{W_NS}}}tab":
            parts.append(" ")
    return normalize_text("".join(parts))


def _docx_heading_level(paragraph: ET.Element) -> int:
    style = paragraph.find(f"{{{W_NS}}}pPr/{{{W_NS}}}pStyle")
    if style is not None:
        value = (style.get(f"{{{W_NS}}}val") or "").lower()
        match = re.search(r"(?:heading|标题)\s*(\d)", value)
        if match:
            return int(match.group(1))
        if value in {"title", "subtitle"}:
            return 1
    return 0


def _docx_cell_blocks(cell: ET.Element) -> list[str]:
    """单元格内容按段落拆开；嵌套表格按「字段：值」展开。"""
    blocks: list[str] = []
    for child in list(cell):
        if child.tag == f"{{{W_NS}}}p":
            text = _docx_paragraph_text(child)
            if text:
                blocks.append(text)
        elif child.tag == f"{{{W_NS}}}tbl":
            for row in child.findall(f"{{{W_NS}}}tr"):
                cells = [
                    " ".join(_docx_cell_blocks(tc))
                    for tc in row.findall(f"{{{W_NS}}}tc")
                ]
                cells = [text for text in cells if text]
                if len(cells) >= 2 and len(cells[0]) <= 20:
                    blocks.append(f"{cells[0].rstrip('：:')}：{' '.join(cells[1:])}")
                elif cells:
                    blocks.append(" ".join(cells))
    return blocks


def _docx_is_heading(line: str, paragraph: ET.Element | None = None) -> bool:
    if paragraph is not None and 0 < _docx_heading_level(paragraph) <= 2:
        return True
    if len(line) > 40:
        return False
    if re.match(r"^[一二三四五六七八九十]+[、.．]", line):
        return True
    return bool(re.match(r"^第[一二三四五六七八九十百零\d]+[章节部分篇]", line))


def split_docx_block(text: str) -> list[tuple[str, bool]]:
    """拆开 Word 单元格里的长文本：以「一、二、三、」为小节，其余按句切成段落。"""
    marks = [match.start() for match in re.finditer(r"[一二三四五六七八九十]{1,3}、", text)]
    marks = [index for index in marks if index == 0 or text[index - 1] in " \n　"]
    segments: list[tuple[str, bool]] = []
    if marks:
        if marks[0] > 0:
            segments.append((text[: marks[0]].strip(), False))
        for order, start in enumerate(marks):
            end = marks[order + 1] if order + 1 < len(marks) else len(text)
            segments.append((text[start:end].strip(), True))
    else:
        segments.append((text, False))
    result: list[tuple[str, bool]] = []
    for segment, is_marker in segments:
        if not is_marker:
            result.extend((sentence, False) for sentence in split_sentences(segment))
            continue
        # 「二、开展新技术现有基础（开展…）」：括号内是说明，放进正文
        head, sep, tail = segment.partition("（")
        if not sep or len(head) < 6:
            head, _, tail = segment.partition(" ")
        if len(head) > 42:
            head, tail = segment[:42], segment[42:]
        result.append((head.strip(" ：:"), True))
        body = (sep + tail) if sep else tail
        result.extend((sentence, False) for sentence in split_sentences(body))
    return [(item, flag) for item, flag in result if item.strip()]


def split_sentences(text: str, limit: int = 180) -> list[str]:
    pieces = [piece.strip() for piece in re.split(r"(?<=[。；！？])", text)]
    out: list[str] = []
    for piece in pieces:
        if not piece:
            continue
        while len(piece) > limit:
            out.append(piece[:limit])
            piece = piece[limit:]
        if piece:
            out.append(piece)
    return out


def parse_docx(path: Path) -> tuple[list[dict], int]:
    with zipfile.ZipFile(path) as archive:
        root = ET.fromstring(archive.read("word/document.xml"))
    body = root.find(f"{{{W_NS}}}body")

    # 先把「段落 + 表格」压平成一维文本流，再按标题切节：
    # 申请表这类版式表格（一行一字段）会被还原成「字段：值」，避免整张表糊成一节。
    flow: list[tuple[str, bool]] = []  # (文本, 是否标题)
    for child in list(body) if body is not None else []:
        if child.tag == f"{{{W_NS}}}p":
            text = _docx_paragraph_text(child)
            if text and not is_noise(text):
                flow.append((text, _docx_is_heading(text, child)))
        elif child.tag == f"{{{W_NS}}}tbl":
            for row in child.findall(f"{{{W_NS}}}tr"):
                cells = [_docx_cell_blocks(tc) for tc in row.findall(f"{{{W_NS}}}tc")]
                cells = [blocks for blocks in cells if blocks]
                if len(cells) >= 2 and len(cells[0][0]) <= 20:
                    head = cells[0][0].rstrip("：:")
                    rest = [block for blocks in cells[1:] for block in blocks]
                    flow.append((f"{head}：{' '.join(rest)}", False))
                else:
                    for blocks in cells:
                        flow.extend((block, False) for block in blocks)

    sections: list[dict] = []
    current: dict | None = None
    for text, heading in flow:
        pieces = [(text, True)] if heading else split_docx_block(text)
        for piece, is_heading_piece in pieces:
            if is_heading_piece:
                current = {
                    "index": len(sections) + 1,
                    "title": piece[:60],
                    "page": None,
                    "paragraphs": [],
                }
                sections.append(current)
                continue
            if current is None:
                current = {"index": len(sections) + 1, "title": "正文", "page": None, "paragraphs": []}
                sections.append(current)
            if piece != current["title"]:
                current["paragraphs"].append(piece)
    for section in sections:
        section["paragraphs"] = dedupe(section["paragraphs"])
    return [section for section in sections if section["paragraphs"]], 1


# ---------------------------------------------------------------- PDF

def pdf_pages(path: Path, cache_dir: Path) -> list[str]:
    cache_dir.mkdir(parents=True, exist_ok=True)
    target = cache_dir / (path.stem + ".txt")
    subprocess.run(
        ["pdftotext", "-enc", "UTF-8", "-raw", str(path), str(target)],
        check=True,
        capture_output=True,
    )
    return target.read_text(encoding="utf-8", errors="ignore").split("\f")


def render_pdf_pages(path: Path, slug: str, limit: int = 20) -> list[dict]:
    """图片型 PDF（扫描件/纯图排版）→ 渲染成页面图片，保证内容不是空白。"""
    target_dir = VIDEO_TARGET_DIR / slug
    target_dir.mkdir(parents=True, exist_ok=True)
    for stale in target_dir.glob("page-*.jpg"):
        stale.unlink()
    prefix = target_dir / "page"
    subprocess.run(
        [
            "pdftoppm",
            "-jpeg",
            "-jpegopt",
            "quality=72",
            "-scale-to",
            "900",
            "-f",
            "1",
            "-l",
            str(limit),
            str(path),
            str(prefix),
        ],
        check=True,
        capture_output=True,
    )
    pages: list[dict] = []
    for image in sorted(target_dir.glob("page-*.jpg")):
        page_no = int(re.search(r"(\d+)", image.stem).group(1))
        pages.append(
            {
                "page": page_no,
                "image": f"/uploads/training/{slug}/{image.name}",
                "sizeBytes": image.stat().st_size,
            }
        )
    return pages


def parse_pdf(path: Path, cache_dir: Path, landscape: bool = False) -> tuple[list[dict], int]:
    """解析 PDF。

    landscape=True 视为幻灯片导出件：一页一节，避免多个文本框串行导致小节碎裂；
    竖版文档（手册/报告）按题号、编号标题切节。
    """
    pages = pdf_pages(path, cache_dir)
    sections: list[dict] = []
    current: dict | None = None

    def new_section(title: str, page: int) -> dict:
        nonlocal current
        current = {
            "index": len(sections) + 1,
            "title": title,
            "page": page,
            "paragraphs": [],
        }
        sections.append(current)
        return current

    for page_index, page_text in enumerate(pages, start=1):
        raw_lines = [normalize_text(line) for line in page_text.splitlines()]
        raw_lines = [line for line in raw_lines if line and not is_noise(line)]
        if not raw_lines or is_toc_page(raw_lines):
            continue
        lines = [strip_dot_leader(line) for line in raw_lines]
        lines = [line for line in lines if line]
        if landscape:
            head = lines[0] if len(lines[0]) <= 32 else f"第 {page_index} 页"
            new_section(head, page_index)
            body = lines[1:] if head == lines[0] else lines
            current["paragraphs"].extend(
                paragraph
                for paragraph in join_wrapped_lines(body)
                if len(paragraph) >= 2 and not is_noise(paragraph)
            )
            continue
        if current is None:
            # 首页首个短句常为标题
            head = lines[0] if len(lines[0]) <= 32 else f"第 {page_index} 页"
            new_section(head, page_index)
            if head == lines[0]:
                lines = lines[1:]
        for paragraph in join_wrapped_lines(lines):
            paragraph = normalize_text(paragraph)
            if len(paragraph) < 2 or is_noise(paragraph):
                continue
            if is_heading(paragraph):
                new_section(paragraph if len(paragraph) <= 42 else paragraph[:42], page_index)
                continue
            assert current is not None
            current["paragraphs"].append(paragraph)

    cleaned: list[dict] = []
    for section in sections:
        paragraphs = dedupe(section["paragraphs"])
        total = sum(len(paragraph) for paragraph in paragraphs)
        # 只剩页眉字段（姓名/性别之类）或封面日期的小节没有教学价值
        if total < 24:
            continue
        if total < 60 and re.fullmatch(r"[\d/.\-年月日\s]+", section["title"]):
            continue
        section["paragraphs"] = paragraphs
        section["index"] = len(cleaned) + 1
        cleaned.append(section)
    return cleaned, len([page for page in pages if page.strip()])


def pdf_page_count(path: Path) -> int:
    result = subprocess.run(
        ["pdfinfo", str(path)], check=False, capture_output=True, text=True
    )
    match = re.search(r"^Pages:\s+(\d+)", result.stdout, re.MULTILINE)
    return int(match.group(1)) if match else 0


def pdf_is_landscape(path: Path) -> bool:
    """幻灯片导出的 PDF 为横向页面：按页切节比按题号切节更贴合原版式。"""
    result = subprocess.run(["pdfinfo", str(path)], check=False, capture_output=True, text=True)
    match = re.search(r"^Page size:\s+([\d.]+) x ([\d.]+)", result.stdout, re.MULTILINE)
    if not match:
        return False
    width, height = float(match.group(1)), float(match.group(2))
    return width > height * 1.1


# ---------------------------------------------------------------- MP4

def probe_video(path: Path) -> dict:
    result = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=width,height:format=duration,size",
            "-of",
            "json",
            str(path),
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    payload = json.loads(result.stdout or "{}")
    stream = (payload.get("streams") or [{}])[0]
    fmt = payload.get("format") or {}
    return {
        "width": int(stream.get("width") or 0),
        "height": int(stream.get("height") or 0),
        "durationSeconds": round(float(fmt.get("duration") or 0), 1),
        "sizeBytes": int(fmt.get("size") or path.stat().st_size),
    }


def disambiguate_titles(sections: list[dict]) -> None:
    """同一份课件里重复的小节标题加序号，避免目录出现多个「产品展示」。"""
    seen: dict[str, int] = {}
    for section in sections:
        title = section["title"]
        seen[title] = seen.get(title, 0) + 1
        if seen[title] > 1:
            section["title"] = f"{title}（{seen[title]}）"


# ---------------------------------------------------------------- 汇总

def build(source: Path, out: Path) -> None:
    cache_dir = REPO_ROOT / ".tmp" / "parse"
    documents: list[dict] = []
    missing: list[str] = []

    for spec in DOC_SPECS:
        path = source / spec.file
        if not path.exists():
            missing.append(spec.file)
            continue
        suffix = path.suffix.lower()
        entry = {
            "id": spec.slug,
            "title": spec.title,
            "sourceFile": spec.file,
            "format": suffix.lstrip("."),
            "kind": spec.kind,
            "summary": spec.summary,
            "courseCodes": spec.course_codes,
            "tags": spec.tags,
            "sizeBytes": path.stat().st_size,
            "sections": [],
        }
        if suffix == ".pptx":
            sections, page_count = parse_pptx(path)
        elif suffix == ".pdf":
            sections, _ = parse_pdf(path, cache_dir, landscape=pdf_is_landscape(path))
            page_count = pdf_page_count(path) or len(sections)
            char_total = sum(len(paragraph) for section in sections for paragraph in section["paragraphs"])
            # 纯图片版式（导出型 PPT/扫描件）文字极少，渲染页面图保证课件可读
            if not char_total or char_total / max(page_count, 1) < 150:
                entry["imageBased"] = True
                entry["pages"] = render_pdf_pages(path, spec.slug)
        elif suffix == ".docx":
            sections, page_count = parse_docx(path)
        elif suffix == ".mp4":
            sections, page_count = [], 0
            video = probe_video(path)
            entry["video"] = video
            entry["durationSeconds"] = video["durationSeconds"]
            VIDEO_TARGET_DIR.mkdir(parents=True, exist_ok=True)
            shutil.copy2(path, VIDEO_TARGET_DIR / path.name)
            entry["url"] = f"/uploads/training/{path.name}"
        else:
            continue
        entry["sections"] = sections
        disambiguate_titles(sections)
        entry["pageCount"] = page_count
        entry["charCount"] = sum(
            len(paragraph) for section in sections for paragraph in section["paragraphs"]
        )
        documents.append(entry)
        print(
            f"  ✓ {spec.file} → {len(sections)} 节 / {entry['pageCount']} 页 / {entry['charCount']} 字"
            + ("（图片型，已渲染页面图）" if entry.get("imageBased") else ""),
            file=sys.stderr,
        )

    if missing:
        print(f"  ! 缺少文件：{', '.join(missing)}", file=sys.stderr)

    payload = {
        "sourceDir": str(source),
        "documents": documents,
    }
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    cache_dir.mkdir(parents=True, exist_ok=True)
    (cache_dir / "course-materials.json").write_text(
        json.dumps(documents, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(
        f"写入 {out}（{out.stat().st_size / 1024:.0f} KB，{len(documents)} 份资料）",
        file=sys.stderr,
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", default=DEFAULT_SOURCE)
    parser.add_argument("--out", default=str(DEFAULT_OUT))
    args = parser.parse_args()
    source = Path(args.source).expanduser()
    if not source.is_dir():
        raise SystemExit(f"源目录不存在：{source}")
    build(source, Path(args.out))


if __name__ == "__main__":
    main()
