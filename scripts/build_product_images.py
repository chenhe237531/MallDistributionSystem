#!/usr/bin/env python3
"""生成商家端商品图片资产（本地执行，源文件为企业归档资料）。

数据来源（客户资料，docs/归档 不入库）：
  - FMT产品介绍(2).pptx        —— 健康消费品 / 检测试剂盒实拍
  - FMT产品介绍20260611.pdf    —— FMT 标准版 / 升级版 / 菌泥 / 辅剂实拍（按内嵌图 xref 提取）
产物：apps/api/uploads/products/{skuCode}/01.jpg …（列表主图 1:1，详情图保留原比例）
无实拍图的 SKU 生成品牌占位图。

用法：
    /Users/a/.workbuddy/binaries/python/envs/default/bin/python scripts/build_product_images.py
    （需 Pillow；读取 PDF 图片时需 PyMuPDF，缺失时自动跳过 PDF 源）
"""

from __future__ import annotations

import io
import os
import zipfile
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = ROOT / "docs" / "归档"
OUTPUT = ROOT / "apps" / "api" / "uploads" / "products"

FMT_PPT = "FMT产品介绍(2).pptx"
FMT_PDF = "FMT产品介绍20260611.pdf"


@dataclass
class Source:
    kind: str  # ppt | pdf
    deck: str
    ref: str  # PPT: media 文件名；PDF: 内嵌图 xref


# SKU → 图片源列表，第一张为列表主图
PRODUCT_IMAGES: dict[str, list[Source]] = {
    # 标准版：三盒白装（PDF P4 实拍）
    "FMT-CAP-001": [Source("pdf", FMT_PDF, "323")],
    # 升级版：独立瓶装礼盒 + 胶囊板（PDF P4 实拍）
    "FMT-CAP-002": [Source("pdf", FMT_PDF, "85")],
    # 定制化活菌胶囊：定制礼盒两个角度
    "FMT-CAP-CUST-001": [
        Source("pdf", FMT_PDF, "98"),
        Source("ppt", FMT_PPT, "image9.png"),
    ],
    # 菌泥：琥珀色包装盒 + 单支 5ml 瓶
    "FMT-PASTE-001": [
        Source("pdf", FMT_PDF, "58"),
        Source("pdf", FMT_PDF, "96"),
    ],
    # 专用辅剂：院线瓶装
    "FMT-ADJ-001": [Source("pdf", FMT_PDF, "68")],
    "KIT-GUT-STD-001": [
        Source("ppt", FMT_PPT, "image16.png"),
        Source("ppt", FMT_PPT, "image17.png"),
    ],
    "KIT-GUT-EXP-001": [Source("ppt", FMT_PPT, "image17.png")],
    "INNO-HENG-001": [Source("ppt", FMT_PPT, "image13.png")],
    "INNO-CHANG-001": [Source("ppt", FMT_PPT, "image10.png")],
    "INNO-XIAN-001": [Source("ppt", FMT_PPT, "image12.png")],
}

# 无实拍图：生成品牌占位图（待企业提供实拍后替换）
PLACEHOLDERS: dict[str, tuple[str, str]] = {
    "DEMO-BASIC-001": ("基础健康检测盒", "演示商品 · 产品图待补充"),
    "DEMO-PLUS-001": ("进阶营养检测盒", "演示商品 · 产品图待补充"),
    "FMT-FLUID-001": ("益生菌元液", "产品图待补充 · 以实物为准"),
}

CANVAS = 750
FONT_CANDIDATES = [
    "/System/Library/Fonts/PingFang.ttc",
    "/System/Library/Fonts/Hiragino Sans GB.ttc",
    "/System/Library/Fonts/STHeiti Medium.ttc",
]


def load_font(size: int) -> ImageFont.FreeTypeFont:
    for path in FONT_CANDIDATES:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except OSError:
                continue
    return ImageFont.load_default()


def read_ppt_media(deck: str, name: str) -> Image.Image:
    with zipfile.ZipFile(ARCHIVE / deck) as zf:
        with zf.open(f"ppt/media/{name}") as fp:
            return Image.open(io.BytesIO(fp.read())).convert("RGB")


def read_pdf_image(deck: str, xref: str) -> Image.Image:
    try:
        import pymupdf  # type: ignore
    except ImportError as error:  # pragma: no cover - 本地工具缺依赖时给出明确指引
        raise SystemExit("读取 PDF 图片需要 PyMuPDF：pip install pymupdf") from error
    doc = pymupdf.open(ARCHIVE / deck)
    info = doc.extract_image(int(xref))
    return Image.open(io.BytesIO(info["image"])).convert("RGB")


def read_source(source: Source) -> Image.Image:
    if source.kind == "ppt":
        return read_ppt_media(source.deck, source.ref)
    return read_pdf_image(source.deck, source.ref)


def square_cover(source: Image.Image, size: int = CANVAS) -> Image.Image:
    """等比缩放到画布内，白底居中，避免前端 aspectFill 裁切商品主体。"""
    canvas = Image.new("RGB", (size, size), "white")
    image = source.copy()
    image.thumbnail((int(size * 0.92), int(size * 0.92)), Image.LANCZOS)
    canvas.paste(image, ((size - image.width) // 2, (size - image.height) // 2))
    return canvas


def detail_image(source: Image.Image, max_width: int = 1200) -> Image.Image:
    image = source.copy()
    if image.width > max_width:
        height = round(image.height * max_width / image.width)
        image = image.resize((max_width, height), Image.LANCZOS)
    return image


def gradient_background(size: int) -> Image.Image:
    top, bottom = (76, 62, 217), (143, 133, 255)
    image = Image.new("RGB", (size, size))
    draw = ImageDraw.Draw(image)
    for y in range(size):
        ratio = y / max(size - 1, 1)
        color = tuple(round(top[i] + (bottom[i] - top[i]) * ratio) for i in range(3))
        draw.line([(0, y), (size, y)], fill=color)
    return image


def placeholder(name: str, note: str) -> Image.Image:
    size = CANVAS
    image = gradient_background(size)
    draw = ImageDraw.Draw(image)
    margin = 46
    draw.rounded_rectangle(
        [margin, margin, size - margin, size - margin],
        radius=36,
        fill="white",
    )
    title_font = load_font(52)
    note_font = load_font(26)
    brand_font = load_font(24)

    draw.text((size / 2, size / 2 - 70), "百英诺", font=brand_font, fill=(110, 92, 255), anchor="mm")
    # 商品名按 6 字换行
    lines = [name[i : i + 6] for i in range(0, len(name), 6)] or [name]
    line_height = 66
    start_y = size / 2 - 6 - (len(lines) - 1) * line_height / 2
    for index, line in enumerate(lines):
        draw.text((size / 2, start_y + index * line_height), line, font=title_font, fill=(31, 35, 41), anchor="mm")
    draw.text((size / 2, size / 2 + 96), note, font=note_font, fill=(143, 149, 158), anchor="mm")
    return image


def main() -> None:
    if not ARCHIVE.exists():
        raise SystemExit(f"归档资料不存在：{ARCHIVE}（客户资料，仅本地保留）")

    for sku, sources in PRODUCT_IMAGES.items():
        target = OUTPUT / sku
        target.mkdir(parents=True, exist_ok=True)
        # 清理旧图，避免主图数量变化后残留 02.jpg
        for stale in target.glob("*.jpg"):
            stale.unlink()
        for index, source in enumerate(sources, start=1):
            image = read_source(source)
            processed = square_cover(image) if index == 1 else detail_image(image)
            path = target / f"{index:02d}.jpg"
            processed.save(path, "JPEG", quality=88, optimize=True)
            print(f"{sku}: {path.relative_to(ROOT)} ({processed.width}x{processed.height})")

    for sku, (name, note) in PLACEHOLDERS.items():
        target = OUTPUT / sku
        target.mkdir(parents=True, exist_ok=True)
        path = target / "01.jpg"
        placeholder(name, note).save(path, "JPEG", quality=88, optimize=True)
        print(f"{sku}: {path.relative_to(ROOT)} (placeholder)")

    print("完成：图片资产已生成，seed 中使用 /uploads/products/{sku}/01.jpg")


if __name__ == "__main__":
    main()
