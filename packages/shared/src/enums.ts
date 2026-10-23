export enum Role {
  PLATFORM = 'platform',
  SUPPLIER = 'supplier',
  LAB = 'lab',
  MERCHANT = 'merchant',
  PARTNER = 'partner',
  SALES = 'sales',
  NUTRITIONIST = 'nutritionist',
  CUSTOMER = 'customer',
}

export const ROLE_LABELS: Record<Role, string> = {
  [Role.PLATFORM]: '平台运营',
  [Role.SUPPLIER]: '供应商',
  [Role.LAB]: '实验室',
  [Role.MERCHANT]: '商家',
  [Role.PARTNER]: '合伙人',
  [Role.SALES]: '销售',
  [Role.NUTRITIONIST]: '营养师',
  [Role.CUSTOMER]: 'C 端用户',
}

export enum AccountStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  REJECTED = 'rejected',
}

export enum ChannelType {
  PLATFORM = 'platform',
  MERCHANT = 'merchant',
  PARTNER = 'partner',
}

export enum PermissionScope {
  SELF = 'self',
  OWN_CUSTOMERS = 'own_customers',
  OWN_STORE = 'own_store',
  OWN_CHANNEL = 'own_channel',
  AUTHORIZED = 'authorized',
  ALL = 'all',
}

export enum ProcurementStatus {
  DEDUCTED = 'deducted',
  PENDING_SHIPMENT = 'pending_shipment',
  SHIPPED = 'shipped',
  RECEIVED = 'received',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  AFTER_SALE = 'after_sale',
  REFUNDED = 'refunded',
}

export enum SalesOrderStatus {
  PENDING_PAYMENT = 'pending_payment',
  PAID = 'paid',
  PENDING_SHIPMENT = 'pending_shipment',
  SHIPPED = 'shipped',
  PENDING_SAMPLING = 'pending_sampling',
  TESTING = 'testing',
  REPORT_READY = 'report_ready',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  REFUNDING = 'refunding',
  REFUNDED = 'refunded',
  AFTER_SALE = 'after_sale',
}

export enum SampleStatus {
  GENERATED = 'generated',
  ACTIVATED = 'activated',
  PENDING_MAIL = 'pending_mail',
  IN_TRANSIT = 'in_transit',
  RECEIVED_BY_LAB = 'received_by_lab',
  TESTING = 'testing',
  REPORT_GENERATED = 'report_generated',
  PUBLISHED = 'published',
  ABNORMAL = 'abnormal',
  VOIDED = 'voided',
}

export enum ReportStatus {
  DRAFT = 'draft',
  PENDING_REVIEW = 'pending_review',
  PUBLISHED = 'published',
  CORRECTED = 'corrected',
  ARCHIVED = 'archived',
}

export enum CommissionStatus {
  ESTIMATED = 'estimated',
  PENDING_RECONCILIATION = 'pending_reconciliation',
  RECONCILING = 'reconciling',
  RECONCILED = 'reconciled',
  SETTLED = 'settled',
  INVALID = 'invalid',
  DISPUTED = 'disputed',
}

export enum StatementStatus {
  PENDING = 'pending',
  RECONCILING = 'reconciling',
  RECONCILED = 'reconciled',
  SETTLED = 'settled',
  DISPUTED = 'disputed',
}
