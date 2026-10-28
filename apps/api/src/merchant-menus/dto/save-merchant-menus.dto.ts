import { IsArray, IsString } from 'class-validator'

/** 保存商家菜单权限：menus 为 shared 目录内 key 的数组；空数组 = 关闭全部可选菜单 */
export class SaveMerchantMenusDto {
  @IsArray({ message: '菜单权限必须是数组' })
  @IsString({ each: true, message: '菜单权限项必须是字符串' })
  menus!: string[]
}
