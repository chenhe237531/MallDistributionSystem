import { Body, Controller, Get, Param, Post } from '@nestjs/common'
import { Role } from '@mall/shared'
import { CurrentUser } from '../auth/current-user.decorator'
import { Roles } from '../auth/roles.decorator'
import type { AuthUser } from '../auth/auth-user.type'
import { CreateNutritionPlanDto } from './dto/interpretation.dto'
import { InterpretationsService } from './interpretations.service'

@Controller('nutrition-plans')
export class NutritionPlansController {
  constructor(private readonly interpretationsService: InterpretationsService) {}

  @Post()
  @Roles(Role.NUTRITIONIST, Role.PLATFORM)
  create(@Body() dto: CreateNutritionPlanDto, @CurrentUser() user: AuthUser) {
    return this.interpretationsService.createNutritionPlan(dto, user)
  }

  @Get('me')
  @Roles(Role.CUSTOMER)
  mine(@CurrentUser() user: AuthUser) {
    return this.interpretationsService.myNutritionPlans(user.sub)
  }

  @Get('report/:reportId')
  byReport(@Param('reportId') reportId: string, @CurrentUser() user: AuthUser) {
    return this.interpretationsService.nutritionPlansByReport(reportId, user)
  }

  @Post(':id/publish')
  @Roles(Role.NUTRITIONIST, Role.PLATFORM)
  publish(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.interpretationsService.publishNutritionPlan(id, user)
  }

  @Get(':id')
  getOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.interpretationsService.nutritionPlan(id, user)
  }
}
