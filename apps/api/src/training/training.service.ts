import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import {
  Prisma,
  Role as PrismaRole,
  TrainingStatus as PrismaTrainingStatus,
} from '@prisma/client'
import { Role } from '@mall/shared'
import { AuditService } from '../audit/audit.service'
import { NotificationsService } from '../notifications/notifications.service'
import { asRoleArray, asStringArray } from '../prisma/array-values'
import { PrismaService } from '../prisma/prisma.service'
import {
  CreateChapterDto,
  CreateCourseDto,
  CreateQuestionDto,
  ExamSubmissionDto,
} from './dto/training.dto'
import { TrainingMaterialsService } from './training-materials.service'
import type { AuthUser } from '../auth/auth-user.type'

const PASS_SCORE = 60
const MAX_ATTEMPTS = 3

@Injectable()
export class TrainingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly materialsService: TrainingMaterialsService,
  ) {}

  async createCourse(dto: CreateCourseDto) {
    const existing = await this.prisma.course.findUnique({ where: { code: dto.code } })
    if (existing) {
      throw new ConflictException('课程编码已存在')
    }
    return this.prisma.course.create({
      data: {
        code: dto.code,
        name: dto.name,
        category: dto.category,
        audience: dto.audience as unknown as PrismaRole[],
        required: dto.required ?? false,
        validityMonths: dto.validityMonths ?? 12,
      },
    })
  }

  async addChapter(courseId: string, dto: CreateChapterDto) {
    await this.getCourseRaw(courseId)
    return this.prisma.courseChapter.create({
      data: {
        courseId,
        title: dto.title,
        content: dto.content,
        order: dto.order ?? 0,
      },
    })
  }

  async addQuestion(courseId: string, dto: CreateQuestionDto) {
    await this.getCourseRaw(courseId)
    return this.prisma.examQuestion.create({
      data: {
        courseId,
        type: dto.type,
        prompt: dto.prompt,
        options: dto.options as unknown as Prisma.InputJsonValue,
        answer: dto.answer as unknown as Prisma.InputJsonValue,
        score: dto.score ?? 10,
      },
    })
  }

  async listCourses(actor: AuthUser) {
    const isPlatform = actor.roles.includes(Role.PLATFORM)
    const courses = await this.prisma.course.findMany({
      include: {
        chapters: { orderBy: { order: 'asc' } },
        questions: true,
      },
      orderBy: { createdAt: 'desc' },
    })
    const visible = isPlatform
      ? courses
      : courses.filter((course) =>
          asRoleArray(course.audience).some((role) => actor.roles.includes(role)),
        )
    return visible.map((course) => this.toCourseView(course, isPlatform))
  }

  async getCourse(id: string, actor: AuthUser) {
    const course = await this.prisma.course.findUnique({
      where: { id },
      include: {
        chapters: { orderBy: { order: 'asc' } },
        questions: true,
      },
    })
    if (!course) {
      throw new NotFoundException('课程不存在')
    }
    const isPlatform = actor.roles.includes(Role.PLATFORM)
    if (!isPlatform && !asRoleArray(course.audience).some((role) => actor.roles.includes(role))) {
      throw new ForbiddenException('无权查看该课程')
    }
    // 详情页一次拿全：课程结构 + 本人学习记录 + 目录解析出的配套课件
    const record = await this.prisma.learningRecord.findUnique({
      where: { userId_courseId: { userId: actor.sub, courseId: course.id } },
    })
    return {
      ...this.toCourseView(course, isPlatform),
      record,
      materials: this.materialsService.summariesForCourse(course.code),
    }
  }

  /** 课件全文：必须能看到它归属的至少一门课程 */
  async getMaterial(materialId: string, actor: AuthUser) {
    const courseCodes = this.materialsService.courseCodesOf(materialId)
    if (courseCodes.length === 0) {
      throw new NotFoundException('课件不存在')
    }
    const courses = await this.prisma.course.findMany({
      where: { code: { in: courseCodes } },
      select: { audience: true },
    })
    const isPlatform = actor.roles.includes(Role.PLATFORM)
    const visible =
      isPlatform ||
      courses.some((course) =>
        asRoleArray(course.audience).some((role) => actor.roles.includes(role)),
      )
    if (!visible) {
      throw new ForbiddenException('无权查看该课件')
    }
    return this.materialsService.reader(materialId)
  }

  async enroll(userId: string, roles: Role[], courseId: string) {
    const course = await this.getCourseRaw(courseId)
    if (!asRoleArray(course.audience).some((role) => roles.includes(role))) {
      throw new ForbiddenException('该课程不面向当前角色')
    }
    return this.prisma.learningRecord.upsert({
      where: { userId_courseId: { userId, courseId } },
      update: {},
      create: { userId, courseId, status: PrismaTrainingStatus.not_started },
    })
  }

  async myRecords(userId: string, roles: Role[]) {
    const courses = await this.prisma.course.findMany()
    const matched = courses.filter((course) =>
      asRoleArray(course.audience).some((role) => roles.includes(role)),
    )
    for (const course of matched) {
      await this.prisma.learningRecord.upsert({
        where: { userId_courseId: { userId, courseId: course.id } },
        update: {},
        create: { userId, courseId: course.id, status: PrismaTrainingStatus.not_started },
      })
    }
    await this.prisma.learningRecord.updateMany({
      where: {
        userId,
        status: PrismaTrainingStatus.passed,
        expiresAt: { not: null, lt: new Date() },
      },
      data: { status: PrismaTrainingStatus.expired },
    })
    return this.prisma.learningRecord.findMany({
      where: { userId },
      include: {
        course: { include: { chapters: { orderBy: { order: 'asc' } } } },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async completeChapter(recordId: string, chapterId: string, actor: AuthUser) {
    const record = await this.prisma.learningRecord.findUnique({
      where: { id: recordId },
      include: { course: { include: { chapters: true } } },
    })
    if (!record) {
      throw new NotFoundException('学习记录不存在')
    }
    if (record.userId !== actor.sub) {
      throw new ForbiddenException('只能完成自己的学习记录')
    }
    const chapter = record.course.chapters.find((item) => item.id === chapterId)
    if (!chapter) {
      throw new BadRequestException('章节不属于该课程')
    }
    const completedChapterIds = asStringArray(record.completedChapterIds)
    if (completedChapterIds.includes(chapterId)) {
      return record
    }

    const nextChapterIds = [...completedChapterIds, chapterId]
    const progress = Math.round((nextChapterIds.length / record.course.chapters.length) * 100)
    const allCompleted = nextChapterIds.length === record.course.chapters.length
    return this.prisma.learningRecord.update({
      where: { id: recordId },
      data: {
        completedChapterIds: nextChapterIds,
        progress,
        status: allCompleted
          ? PrismaTrainingStatus.pending_exam
          : PrismaTrainingStatus.learning,
      },
    })
  }

  async submitExam(recordId: string, dto: ExamSubmissionDto, actor: AuthUser) {
    const record = await this.prisma.learningRecord.findUnique({
      where: { id: recordId },
      include: { course: { include: { questions: true } } },
    })
    if (!record) {
      throw new NotFoundException('学习记录不存在')
    }
    if (record.userId !== actor.sub) {
      throw new ForbiddenException('只能参加自己的考试')
    }
    if (record.status === PrismaTrainingStatus.passed && record.expiresAt && record.expiresAt > new Date()) {
      throw new BadRequestException('该课程已通过且在有效期内')
    }
    if (record.attemptCount >= MAX_ATTEMPTS) {
      throw new BadRequestException('补考次数已达上限（2 次）')
    }
    if (record.status !== PrismaTrainingStatus.pending_exam && record.status !== PrismaTrainingStatus.expired) {
      throw new BadRequestException('请先完成全部章节')
    }

    const anomaly = (dto.screenSwitches ?? 0) > 3 || dto.suspiciousInterval === true
    if (anomaly) {
      await this.prisma.examAttempt.create({
        data: {
          userId: actor.sub,
          courseId: record.courseId,
          answers: dto.answers as Prisma.InputJsonValue,
          score: 0,
          passed: false,
          anomaly: true,
          anomalyNote: '切屏超 3 次或答题间隔异常，成绩作废',
        },
      })
      await this.prisma.learningRecord.update({
        where: { id: recordId },
        data: { lastExamAt: new Date() },
      })
      await this.auditService.record({
        actor,
        action: 'training.exam_anomaly',
        resourceType: 'training',
        resourceId: recordId,
        detail: {
          courseId: record.courseId,
          screenSwitches: dto.screenSwitches ?? 0,
          suspiciousInterval: dto.suspiciousInterval ?? false,
        },
      })
      return {
        anomaly: true,
        passed: false,
        score: 0,
        message: '考试异常，成绩作废，请转人工复核后重考',
      }
    }

    let earned = 0
    let total = 0
    for (const question of record.course.questions) {
      total += question.score
      if (isAnswerCorrect(question.answer, dto.answers[question.id], question.type)) {
        earned += question.score
      }
    }
    const score = total > 0 ? Math.round((earned / total) * 100) : 0
    const passed = score >= PASS_SCORE
    const attemptCount = record.attemptCount + 1
    const now = new Date()
    const expiresAt = passed
      ? new Date(now.getTime() + record.course.validityMonths * 30 * 24 * 60 * 60 * 1000)
      : record.expiresAt

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.examAttempt.create({
        data: {
          userId: actor.sub,
          courseId: record.courseId,
          answers: dto.answers as Prisma.InputJsonValue,
          score,
          passed,
        },
      })
      return tx.learningRecord.update({
        where: { id: recordId },
        data: {
          status: passed ? PrismaTrainingStatus.passed : PrismaTrainingStatus.pending_exam,
          examScore: score,
          attemptCount,
          passedAt: passed ? now : record.passedAt,
          expiresAt,
          lastExamAt: now,
        },
      })
    })
    if (passed) {
      await this.notificationsService.emit({
        type: 'training_passed',
        recipientId: actor.sub,
        recipientRole: actor.role,
        subjectType: 'course',
        subjectId: record.courseId,
        title: '课程考试已通过',
        body: `课程「${record.course.name}」考试通过，成绩 ${score} 分，有效期至 ${expiresAt ? expiresAt.toLocaleDateString('zh-CN') : '—'}。`,
        templateCode: 'training_passed',
        dedupeKey: `training_passed:${recordId}`,
        payload: { courseId: record.courseId, score, expiresAt },
      })
    }
    await this.auditService.record({
      actor,
      action: passed ? 'training.exam_passed' : 'training.exam_failed',
      resourceType: 'training',
      resourceId: recordId,
      detail: {
        courseId: record.courseId,
        courseCode: record.course.code,
        score,
        attemptCount,
        expiresAt,
      },
    })
    return updated
  }

  async merchantTeam(actor: AuthUser) {
    let userIds: string[] = []
    if (actor.roles.includes(Role.PLATFORM)) {
      const users = await this.prisma.user.findMany({
        select: { id: true, roles: true },
      })
      userIds = users
        .filter((user) => asRoleArray(user.roles).includes(Role.SALES))
        .map((user) => user.id)
    } else if (actor.roles.includes(Role.MERCHANT)) {
      const merchant = await this.prisma.user.findUnique({ where: { id: actor.sub } })
      if (!merchant?.organizationId) {
        throw new BadRequestException('商家未绑定组织')
      }
      const users = await this.prisma.user.findMany({
        where: { organizationId: merchant.organizationId },
        select: { id: true, roles: true },
      })
      userIds = users
        .filter((user) => asRoleArray(user.roles).includes(Role.SALES))
        .map((user) => user.id)
    } else {
      throw new ForbiddenException('只有商家或平台可以查看团队学习情况')
    }

    const records = await this.prisma.learningRecord.findMany({
      where: { userId: { in: userIds } },
      include: {
        user: { select: { id: true, name: true, phone: true, roles: true } },
        course: { select: { id: true, name: true, required: true, validityMonths: true } },
      },
      orderBy: { updatedAt: 'desc' },
    })
    const passed = records.filter((record) => record.status === PrismaTrainingStatus.passed).length
    const now = Date.now()
    const expiring = records.filter(
      (record) =>
        record.expiresAt &&
        record.expiresAt.getTime() > now &&
        record.expiresAt.getTime() - now < 30 * 24 * 60 * 60 * 1000,
    )
    return {
      records,
      completionRate: records.length ? Math.round((passed / records.length) * 100) : 0,
      failed: records.filter((record) => record.status === PrismaTrainingStatus.pending_exam),
      expiring,
    }
  }

  private async getCourseRaw(id: string) {
    const course = await this.prisma.course.findUnique({ where: { id } })
    if (!course) {
      throw new NotFoundException('课程不存在')
    }
    return course
  }

  private toCourseView(
    course: {
      id: string
      code: string
      name: string
      category: string
      audience: unknown
      required: boolean
      validityMonths: number
      chapters: unknown[]
      questions: Array<{
        id: string
        type: string
        prompt: string
        options: unknown
        answer: unknown
        score: number
      }>
    },
    includeAnswers: boolean,
  ) {
    return {
      ...course,
      questions: course.questions.map((question) => ({
        id: question.id,
        type: question.type,
        prompt: question.prompt,
        options: question.options,
        score: question.score,
        ...(includeAnswers ? { answer: question.answer } : {}),
      })),
    }
  }
}

function isAnswerCorrect(
  expected: unknown,
  submitted: string | string[] | undefined,
  type: string,
): boolean {
  if (submitted === undefined) {
    return false
  }
  if (type === 'multiple') {
    const expectedList = Array.isArray(expected) ? expected.map(String).sort() : [String(expected)]
    const submittedList = Array.isArray(submitted) ? submitted.map(String).sort() : [String(submitted)]
    return (
      expectedList.length === submittedList.length &&
      expectedList.every((value, index) => value === submittedList[index])
    )
  }
  return String(expected) === String(submitted)
}
