import { Controller, Get, Query, Res } from '@nestjs/common'
import type { Response } from 'express'
import { Role } from '@mall/shared'
import { CurrentUser } from '../auth/current-user.decorator'
import { Roles } from '../auth/roles.decorator'
import type { AuthUser } from '../auth/auth-user.type'
import { AuditQueryDto } from './dto/audit-query.dto'
import { AuditService } from './audit.service'

@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  search(@CurrentUser() user: AuthUser, @Query() query: AuditQueryDto) {
    return this.auditService.search(user, query)
  }

  @Get('export')
  @Roles(Role.MERCHANT, Role.SUPPLIER, Role.LAB, Role.PARTNER, Role.SALES)
  async export(
    @CurrentUser() user: AuthUser,
    @Query() query: AuditQueryDto,
    @Query('format') format: string | undefined,
    @Res() response: Response,
  ) {
    const result = await this.auditService.exportPackage(
      user,
      query,
      format === 'pdf' ? 'pdf' : 'excel',
    )
    response.setHeader('Content-Type', result.contentType)
    response.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`)
    response.send(result.buffer)
  }
}
