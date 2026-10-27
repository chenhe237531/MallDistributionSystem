import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type {
  CourseMaterialDocument,
  CourseMaterialSection,
} from './data/materials.types'

export type CourseMaterialSummary = Omit<CourseMaterialDocument, 'sections' | 'pages'> & {
  /** 小节数，列表页用于提示「共 N 节」 */
  sectionCount: number
  /** 前若干个小节标题，作为目录预览 */
  outline: Array<{ index: number; title: string }>
  /** 图片型课件的首页预览图 */
  cover?: string
}

type MaterialsFile = {
  sourceDir: string
  documents: CourseMaterialDocument[]
}

/**
 * 课件资料目录（内容来自「百依诺商家资料」，由 scripts/extract_training_materials.py 解析）。
 *
 * 解析结果以 JSON 落盘、随构建产物一起发布：启动时读一次并缓存，进程内只读，
 * 因此课件新增只需重跑脚本 + 重启服务，不需要改数据库。
 */
@Injectable()
export class TrainingMaterialsService {
  private readonly logger = new Logger(TrainingMaterialsService.name)
  private readonly documents: CourseMaterialDocument[]
  private readonly byId: Map<string, CourseMaterialDocument>

  constructor() {
    const file = this.loadFile()
    this.documents = file?.documents ?? []
    this.byId = new Map(this.documents.map((document) => [document.id, document]))
    if (this.documents.length === 0) {
      this.logger.warn('课件资料未解析，请先执行 pnpm materials:extract')
    } else {
      this.logger.log(
        `已加载 ${this.documents.length} 份课件资料（源目录：${file?.sourceDir ?? '未知'}）`,
      )
    }
  }

  /** 兼容 dev(src) 与 dist 两种运行方式 */
  private loadFile(): MaterialsFile | null {
    const candidates = [
      join(__dirname, 'data', 'course-materials.json'),
      // nest build 在未配置 assets 时会把 JSON 落到 dist/training/data
      join(__dirname, '..', '..', 'training', 'data', 'course-materials.json'),
      join(process.cwd(), 'src', 'training', 'data', 'course-materials.json'),
      join(process.cwd(), 'dist', 'training', 'data', 'course-materials.json'),
    ]
    const path = candidates.find((candidate) => existsSync(candidate))
    if (!path) {
      return null
    }
    return JSON.parse(readFileSync(path, 'utf8')) as MaterialsFile
  }

  /** 课程下的课件清单（不含正文，避免详情页首屏过大） */
  summariesForCourse(courseCode: string): CourseMaterialSummary[] {
    return this.documents
      .filter((document) => document.courseCodes.includes(courseCode))
      .map(({ sections, pages, ...rest }) => this.toSummary(rest, sections, pages?.[0]?.image))
  }

  /** 课程 code 集合：用于鉴权（课件归属哪几门课） */
  courseCodesOf(materialId: string): string[] {
    return this.byId.get(materialId)?.courseCodes ?? []
  }

  /** 单份课件全文（含小节正文） */
  get(materialId: string): CourseMaterialDocument {
    const document = this.byId.get(materialId)
    if (!document) {
      throw new NotFoundException('课件不存在')
    }
    return document
  }

  /** 阅读页用：正文按小节返回，附带总字数便于前端提示 */
  reader(materialId: string) {
    const document = this.get(materialId)
    return {
      id: document.id,
      title: document.title,
      sourceFile: document.sourceFile,
      format: document.format,
      kind: document.kind,
      summary: document.summary,
      tags: document.tags,
      pageCount: document.pageCount,
      charCount: document.charCount,
      durationSeconds: document.durationSeconds,
      url: document.url,
      imageBased: document.imageBased ?? false,
      pages: document.pages ?? [],
      sections: document.sections,
    }
  }

  private toSummary(
    rest: Omit<CourseMaterialDocument, 'sections' | 'pages'>,
    sections: CourseMaterialSection[],
    cover?: string,
  ): CourseMaterialSummary {
    return {
      ...rest,
      sectionCount: sections.length,
      outline: sections.slice(0, 5).map((section) => ({
        index: section.index,
        title: section.title,
      })),
      ...(cover ? { cover } : {}),
    }
  }
}
