import { IsIn, IsOptional } from 'class-validator'

export class InitiateContractDto {
  @IsOptional()
  @IsIn(['esignbao', 'tencent'])
  provider?: 'esignbao' | 'tencent'
}
