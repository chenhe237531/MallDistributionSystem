import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common'
import type { Response } from 'express'
import { Role } from '@mall/shared'
import { CurrentUser } from '../auth/current-user.decorator'
import { Roles } from '../auth/roles.decorator'
import type { AuthUser } from '../auth/auth-user.type'
import {
  CreateMaterialTemplateDto,
  GenerateMaterialDto,
  SetTemplateStatusDto,
} from './dto/material.dto'
import { MaterialsService } from './materials.service'

@Controller('materials')
export class MaterialsController {
  constructor(private readonly materialsService: MaterialsService) {}

  @Post('templates')
  @Roles(Role.PLATFORM)
  createTemplate(@Body() dto: CreateMaterialTemplateDto, @CurrentUser() user: AuthUser) {
    return this.materialsService.createTemplate(dto, user)
  }

  @Get('templates')
  templates(@CurrentUser() user: AuthUser, @Query('includeInactive') includeInactive?: string) {
    return this.materialsService.listTemplates(user, includeInactive === 'true')
  }

  @Patch('templates/:id/status')
  @Roles(Role.PLATFORM)
  setStatus(@Param('id') id: string, @Body() dto: SetTemplateStatusDto) {
    return this.materialsService.setTemplateStatus(id, dto.active)
  }

  @Post('generate')
  @Roles(Role.MERCHANT)
  generate(@CurrentUser() user: AuthUser, @Body() dto: GenerateMaterialDto) {
    return this.materialsService.generate(user, dto)
  }

  @Get('me')
  @Roles(Role.MERCHANT)
  mine(@CurrentUser() user: AuthUser) {
    return this.materialsService.listMine(user.sub)
  }

  @Get(':id/download')
  async download(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Res() response: Response,
  ) {
    const material = await this.materialsService.getOne(id, user)
    response.setHeader('Content-Type', 'text/plain; charset=utf-8')
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="material-${material.id}.txt"`,
    )
    response.send(material.content)
  }

  @Get(':id')
  getOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.materialsService.getOne(id, user)
  }
}
