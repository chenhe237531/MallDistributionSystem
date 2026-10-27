import { BadRequestException, ValidationError } from '@nestjs/common'

/**
 * 校验错误统一中文文案：
 * - DTO 装饰器显式声明 message（中文）时原样返回
 * - 未声明 message 的约束按类型映射为中文兜底，杜绝 C 端出现
 *   「contactName must be longer than or equal to 1 characters」这类英文默认文案
 */
const CONSTRAINT_MESSAGES: Record<string, string> = {
  isDefined: '不能为空',
  isNotEmpty: '不能为空',
  isString: '格式不正确',
  isNumberString: '格式不正确',
  isNumber: '必须为数字',
  isInt: '必须为整数',
  isBoolean: '格式不正确',
  isArray: '格式不正确',
  arrayMinSize: '至少需要一项',
  arrayMaxSize: '数量超出限制',
  arrayUnique: '存在重复项',
  minLength: '长度过短',
  maxLength: '长度过长',
  min: '数值过小',
  max: '数值过大',
  matches: '格式不正确',
  isEnum: '取值不正确',
  isEmail: '邮箱格式不正确',
  isPhoneNumber: '手机号格式不正确',
  isDateString: '日期格式不正确',
  isISO8601: '日期格式不正确',
  isDate: '日期格式不正确',
  isObject: '格式不正确',
  nestedValidation: '内容不完整',
  validateNestedByEach: '内容不完整',
  validateNested: '内容不完整',
}

const containsCjk = (text: string): boolean => /[\u4e00-\u9fff]/.test(text)

export function toChineseValidationMessages(errors: ValidationError[]): string[] {
  const messages: string[] = []
  const walk = (error: ValidationError): void => {
    for (const [constraint, message] of Object.entries(error.constraints ?? {})) {
      messages.push(
        containsCjk(message) ? message : CONSTRAINT_MESSAGES[constraint] ?? '参数格式不正确',
      )
    }
    error.children?.forEach(walk)
  }
  errors.forEach(walk)
  return [...new Set(messages)]
}

export function chineseValidationExceptionFactory(errors: ValidationError[]): BadRequestException {
  return new BadRequestException(toChineseValidationMessages(errors))
}
