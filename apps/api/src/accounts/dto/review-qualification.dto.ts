import { IsIn } from 'class-validator'

export class ReviewQualificationDto {
  @IsIn(['approved', 'rejected'])
  status!: 'approved' | 'rejected'
}
