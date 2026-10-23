import { Body, Controller, Get, Param, Post } from '@nestjs/common'
import { Role } from '@mall/shared'
import { CurrentUser } from '../auth/current-user.decorator'
import { Roles } from '../auth/roles.decorator'
import type { AuthUser } from '../auth/auth-user.type'
import {
  CreateChapterDto,
  CreateCourseDto,
  CreateQuestionDto,
  ExamSubmissionDto,
} from './dto/training.dto'
import { TrainingService } from './training.service'

@Controller('training')
export class TrainingController {
  constructor(private readonly trainingService: TrainingService) {}

  @Get('courses')
  courses(@CurrentUser() user: AuthUser) {
    return this.trainingService.listCourses(user)
  }

  @Post('courses')
  @Roles(Role.PLATFORM)
  createCourse(@Body() dto: CreateCourseDto) {
    return this.trainingService.createCourse(dto)
  }

  @Get('courses/:id')
  course(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.trainingService.getCourse(id, user)
  }

  @Post('courses/:id/chapters')
  @Roles(Role.PLATFORM)
  addChapter(@Param('id') id: string, @Body() dto: CreateChapterDto) {
    return this.trainingService.addChapter(id, dto)
  }

  @Post('courses/:id/questions')
  @Roles(Role.PLATFORM)
  addQuestion(@Param('id') id: string, @Body() dto: CreateQuestionDto) {
    return this.trainingService.addQuestion(id, dto)
  }

  @Post('courses/:id/enroll')
  enroll(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.trainingService.enroll(user.sub, user.roles, id)
  }

  @Get('me')
  mine(@CurrentUser() user: AuthUser) {
    return this.trainingService.myRecords(user.sub, user.roles)
  }

  @Post('records/:id/chapters/:chapterId/complete')
  completeChapter(
    @Param('id') id: string,
    @Param('chapterId') chapterId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.trainingService.completeChapter(id, chapterId, user)
  }

  @Post('records/:id/exam')
  exam(
    @Param('id') id: string,
    @Body() dto: ExamSubmissionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.trainingService.submitExam(id, dto, user)
  }

  @Get('merchant/sales')
  @Roles(Role.MERCHANT, Role.PLATFORM)
  merchantSales(@CurrentUser() user: AuthUser) {
    return this.trainingService.merchantTeam(user)
  }
}
