/**
 * 课件资料的领域类型。
 *
 * 内容由 scripts/extract_training_materials.py 从「百依诺商家资料」目录解析生成
 * （course-materials.generated.ts），本文件只描述结构，便于接口层与前端共用。
 */

export type CourseMaterialSection = {
  /** 小节序号，从 1 开始，与目录展示顺序一致 */
  index: number
  /** 小节标题：PPT 页标题 / PDF 问答题干 / Word 标题，缺省回落到「第 N 页」 */
  title: string
  /** 源文件中的页码（PPT 为页码序号）；Word 无分页时为 null */
  page: number | null
  /** 已合并硬换行、去除水印与页码后的正文段落 */
  paragraphs: string[]
}

export type CourseMaterialDocument = {
  id: string
  title: string
  /** 源文件名，便于溯源核对 */
  sourceFile: string
  /** pptx / pdf / docx / mp4 */
  format: string
  /** slides 课件 · report 报告模板 · handout 手册 · form 表单 · video 视频 */
  kind: string
  /** 一句话导读（人工校订） */
  summary: string
  /** 归属课程 code，与 Course.code 对应 */
  courseCodes: string[]
  tags: string[]
  sizeBytes: number
  /** PPT 页数 / PDF 页数；视频为 0 */
  pageCount: number
  /** 解析后的正文字数（字符数） */
  charCount: number
  /** 图片型课件：整页渲染成图片，正文极少 */
  imageBased?: boolean
  pages?: Array<{ page: number; image: string; sizeBytes: number }>
  sections: CourseMaterialSection[]
  durationSeconds?: number
  /** 可播放地址（视频） */
  url?: string
  video?: {
    width: number
    height: number
    durationSeconds: number
    sizeBytes: number
  }
}
