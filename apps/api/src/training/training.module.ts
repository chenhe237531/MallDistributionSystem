import { Module } from '@nestjs/common'
import { TrainingController } from './training.controller'
import { TrainingMaterialsService } from './training-materials.service'
import { TrainingService } from './training.service'

@Module({
  controllers: [TrainingController],
  providers: [TrainingService, TrainingMaterialsService],
  exports: [TrainingService, TrainingMaterialsService],
})
export class TrainingModule {}
