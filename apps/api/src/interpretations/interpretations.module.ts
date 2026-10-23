import { Module } from '@nestjs/common'
import { InterpretationsController } from './interpretations.controller'
import { InterpretationsService } from './interpretations.service'
import { NutritionPlansController } from './nutrition-plans.controller'

@Module({
  controllers: [InterpretationsController, NutritionPlansController],
  providers: [InterpretationsService],
  exports: [InterpretationsService],
})
export class InterpretationsModule {}
