import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ScheduleModule } from '@nestjs/schedule'
import { AccountsModule } from './accounts/accounts.module'
import { AlertsModule } from './alerts/alerts.module'
import { AuditModule } from './audit/audit.module'
import { AuthModule } from './auth/auth.module'
import { BoxCodesModule } from './box-codes/box-codes.module'
import { ChannelsModule } from './channels/channels.module'
import { CommissionsModule } from './commissions/commissions.module'
import { ContractsModule } from './contracts/contracts.module'
import { CustomersModule } from './customers/customers.module'
import { HealthController } from './health/health.controller'
import { MaterialsModule } from './materials/materials.module'
import { NotificationsModule } from './notifications/notifications.module'
import { PrepaidModule } from './prepaid/prepaid.module'
import { PrismaModule } from './prisma/prisma.module'
import { ProcurementModule } from './procurement/procurement.module'
import { ProductsModule } from './products/products.module'
import { RemindersModule } from './reminders/reminders.module'
import { ReportsModule } from './reports/reports.module'
import { SalesOrdersModule } from './sales/sales-orders.module'
import { SalesWorkbenchModule } from './sales-workbench/sales-workbench.module'
import { SamplesModule } from './samples/samples.module'
import { StatementsModule } from './statements/statements.module'
import { TrainingModule } from './training/training.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuditModule,
    NotificationsModule,
    AuthModule,
    AccountsModule,
    AlertsModule,
    BoxCodesModule,
    CommissionsModule,
    ContractsModule,
    ProductsModule,
    PrepaidModule,
    ProcurementModule,
    SalesOrdersModule,
    SalesWorkbenchModule,
    SamplesModule,
    ReportsModule,
    StatementsModule,
    TrainingModule,
    MaterialsModule,
    CustomersModule,
    ChannelsModule,
    RemindersModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
