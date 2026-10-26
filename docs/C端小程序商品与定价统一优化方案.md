# C 端小程序商品与定价统一优化方案（v1.0）

> 目标：C 端小程序（`apps/mini-c`）在售商品与商家端（`apps/mini-b`）同源一致，全部带图、带完整详情；C 端售价默认按商家采购价 2 倍生成，最终以商家自定义设置为准。
>
> 关联文档：`docs/商家小程序整体优化产品开发方案.md`（v1.1 商品数据基座与商家端体验）、`docs/归档资料整理与内容转化方案.md`（商品文案与合规口径）。

---

## 1. 背景与现状问题

商家端一期已完成商品图片、分类、详情页与 13 个商品库建设，但 C 端商城仍停留在「纯文字商品卡 + 一段 intro」阶段，与本轮要求存在 4 个差距：

| # | 现状问题 | 影响 |
|---|----------|------|
| 1 | `GET /sales-orders/storefront` 只返回商品名、SKU、价格、库存、intro | C 端无图、无规格、无详情，商品与商家端不一致 |
| 2 | C 端商品卡用「商品名前两字」渐变块占位，详情页用文字色块代替主图 | 无法建立商品认知，转化率低 |
| 3 | 商品详情页只有 1 段介绍 + 3 个元信息 | 已落库的检测项目 / 采样方式 / 储存条件 / 保质期等字段无处展示 |
| 4 | 上架价直接沿用 `Product.retailPriceCents`（平台建议零售价），无统一加价规则，商家无定价入口 | 商家无法按采购价自主定价，C 端价格口径不统一 |

---

## 2. 优化目标

1. **商品一致**：C 端列表 / 详情与商家端读取同一 `Product` 记录，图片、规格、介绍、搭配推荐逐字段一致。
2. **全部带图**：13 个在售商品 100% 有主图；无图或加载失败时使用品牌占位兜底，不破版。
3. **详情完整**：C 端详情页包含轮播图、价格与标签、规格参数、图文介绍、采样视频、搭配推荐、服务保障、合规声明、购买底栏 9 个区块。
4. **定价规则统一**：默认 C 端售价 = 采购价 × 2（默认毛利率 50%）；商家可在商家端「商品定价」页自定义，C 端最终以商家设置为准。
5. **布局统一**：首页与详情页统一卡片结构、图片比例、间距与字号层级，与商家端保持同一套设计语言。

---

## 3. 定价模型

### 3.1 规则定义

| 项 | 规则 |
|----|------|
| 默认售价 | `retailPriceCents = supplyPriceCents × 2`（`DEFAULT_RETAIL_MARKUP = 2`） |
| 自定义售价 | 商家在「商品定价」页修改，写入 `MerchantProduct.retailPriceCents` |
| 价格下限 | 不得低于采购价 `supplyPriceCents`，避免亏本销售 |
| 默认/自定义标记 | `MerchantProduct.priceCustomized`：`false` = 默认 2 倍规则；`true` = 商家自定义 |
| 恢复默认 | 清除自定义标记，按当时采购价重新计算 2 倍售价 |
| C 端展示 | 一律读取 `MerchantProduct.retailPriceCents`，不使用 `Product.retailPriceCents` |

> 说明：`Product.retailPriceCents` 仍作为平台审核时的建议零售价保留，仅作运营参考，不参与 C 端成交价计算。

### 3.2 计算与展示链路

```
供应商供货价 Product.supplyPriceCents
        │
        ├─ 商家上架（未定价）→ defaultRetailPriceCents() = 采购价 × 2 → MerchantProduct.retailPriceCents
        │
        └─ 商家定价页改价 → MerchantProduct.retailPriceCents（priceCustomized = true）
                                   │
                                   ▼
              GET /sales-orders/storefront[/:listingId]
                                   │
                                   ▼
                     C 端列表价 / 详情价 / 下单冻结价
```

### 3.3 价格示例（当前种子数据）

| SKU | 商品 | 采购价 | 默认 C 端价 | 默认毛利 |
|-----|------|--------|-------------|----------|
| INNO-XIAN-001 | 英诺纤膳食纤维 | ¥99.00 | ¥198.00 | 50.0% |
| KIT-GUT-STD-001 | 肠道菌群基因组检测·标准版 | ¥899.00 | ¥1798.00 | 50.0% |
| FMT-CAP-001 | FMT 健康人源肠道菌群胶囊 | ¥2,999.00 | ¥5998.00 | 50.0% |
| FMT-CAP-CUST-001 | 定制化活菌胶囊 | ¥5,999.00 | ¥11998.00 | 50.0% |

### 3.4 数据字段

```prisma
model MerchantProduct {
  retailPriceCents Int
  /// true = 商家自定义改价；false = 使用默认 2 倍规则（可恢复）
  priceCustomized  Boolean @default(false)
  // ...
}
```

迁移：`apps/api/prisma/migrations/20261026092616_merchant_price_customized/`

共享计算函数（三端唯一来源）：`packages/shared/src/product.ts`

```ts
DEFAULT_RETAIL_MARKUP = 2
defaultRetailPriceCents(supplyPriceCents)
grossMarginBps(supplyPriceCents, retailPriceCents)
```

---

## 4. C 端与商家端商品一致性

### 4.1 字段映射

| C 端字段 | 数据来源 | 商家端对应 |
|----------|----------|------------|
| `productName` / `skuCode` | `Product.name` / `skuCode` | 商品卡名称 / SKU |
| `images` | `Product.images`（有序，[0] 为主图） | 列表缩略图、详情轮播 |
| `category` / `categoryLabel` | `Product.category` + `PRODUCT_CATEGORIES` | 采购页一级分类 |
| `intro` | `Product.intro` | 详情页图文介绍 |
| `testItems` / `sampleType` / `samplingMethod` / `storageCondition` / `shelfLifeDays` | `Product` 同名字段 | 详情页规格参数表 |
| `guideVideoUrl` | `Product.guideVideoUrl` | 详情页采样视频 |
| `retailPriceCents` | `MerchantProduct.retailPriceCents` | 定价页 C 端售价 |
| `related` | `ProductRelated` + 关联商品最低上架价 | 详情页搭配推荐 |
| `available` | 未过期且有余量批次之和 | 商品卡库存 |

### 4.2 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/sales-orders/storefront?channelCode=` | 列表：返回图片、分类、规格、介绍、搭配推荐（带图）、商家定价 |
| GET | `/api/sales-orders/storefront/:listingId` | 详情：与列表同一 `STOREFRONT_INCLUDE` 与 `mapStorefrontListing`，字段不漂移 |
| PATCH | `/api/products/merchant/listings/:id` | 商家改价 `{ retailPriceCents }`，或恢复默认 `{ resetToDefault: true }` |
| GET | `/api/products/merchant/mine` | 定价页数据源：上架记录 + 商品采购价 / 图片 / 规格 |

### 4.3 图片策略

- 数据库存相对路径 `/uploads/products/{sku}/01.jpg`，C 端 `resolveAsset()` 补全源站域名。
- 新增 `GoodsImage` 组件：`aspectFill`、懒加载、无图/失败时品牌渐变 + 商品首字兜底，与商家端 `GoodsThumb` 同策略。
- 详情页首图进轮播，其余图片作为图文详情；视频地址同样经 `resolveAsset()` 处理。

---

## 5. 页面与交互

### 5.1 首页（`pages/index`）

结构调整为 6 段，替换原「品牌卡 + 文字占位 + 单列文字卡」：

1. **品牌头部**：logo + 品牌名 + 中文主张 + 3 个资质标签（同济共建菌库 / 3 万+ 微生物全景 / AI 报告解读）+ 登录态。
2. **使用说明轮播**：保留原 2 张 banner 与 CTA。
3. **服务入口**：绑定样本 / 检测进度 / 技术介绍 / 联系客服 4 宫格。
4. **分类筛选**：自适应换行 chip（全部 + 当前有商品的分类），分类键与商家端采购页一致（`PRODUCT_CATEGORIES`）。
5. **商品列表**：单列大卡（104×104 主图 + 名称 + 分类/视频/样本类型标签 + 2 行介绍 + 价格 + 立即购买），缺货角标。
6. **服务保障 + 合规声明**：正品保障 / 冷链配送 / 报告解读。

### 5.2 商品详情（`pages/product`）

按商家端详情页同构重排为 9 个区块：

| # | 区块 | 说明 |
|---|------|------|
| 1 | 轮播图 | 340px，多图指示点，首图主图 |
| 2 | 价格与标签 | 大号价格 + 服务说明 + 商品名 + 分类/视频标签 + SKU |
| 3 | 规格参数 | 检测项目 / 样本类型 / 采样方式 / 储存条件 / 保质期 / 库存 |
| 4 | 商品介绍 | intro + 详情图（主图之后的图片） |
| 5 | 采样指导视频 | 有 `guideVideoUrl` 时展示 |
| 6 | 搭配推荐 | 横滑卡片，带图带价，可跳转对应商品 |
| 7 | 服务保障 | 正品保障 / 冷链配送 / 报告解读 |
| 8 | 合规声明 | 按品类下发（检测报告 / 移植产品 / 普通食品） |
| 9 | 购买底栏 | 固定安全区上方，价格 + 立即购买 |

详情页改为调用 `/sales-orders/storefront/:listingId` 单条查询，不再拉取全量列表后前端查找。

> **Taro H5 视频容器注意**：`<Video>` 渲染出的 `.taro-video-container` 默认 `position: absolute; width/height: 100%`，若直接放在普通卡片中会以视口为参照覆盖整页。C 端详情、绑定样本页与商家端商品详情均已改为「定高定位容器 + 视频铺满」结构（`.pd-video-wrap` / `.guide-video-wrap` / `.detail-video-wrap`）。

### 5.3 商家定价页（`pages/pricing`）

- **头部**：规则说明 + 3 项统计（在售商品 / 自定义定价 / 平均毛利）。
- **商品列表**：缩略图 + 名称 + SKU/样本类型 + 「采购价 → C 端售价」+ 毛利 + 默认/自定义标签 + 改价 / 恢复默认。
- **改价弹层**：展示采购价与默认售价，金额输入 + 2 / 2.2 / 2.5 / 3 倍快捷定价，实时校验不低于采购价。
- **入口**：我的页「经营工具 · 商品定价」、采购页「可采商品」顶部提示条。
- 保存后调用 `PATCH /products/merchant/listings/:id`，刷新列表；C 端下次请求即返回新价格。

---

## 6. 数据迁移与兼容

1. **迁移**：`prisma migrate dev --name merchant_price_customized`，`priceCustomized` 默认 `false`，历史数据无需手工处理。
2. **种子**：演示商家 13 个商品统一按采购价 × 2 生成；重复执行 seed 时，已自定义（`priceCustomized = true`）的记录保留商家价格。
3. **上架默认价**：`CreateListingDto.retailPriceCents` 改为可选；不传则按 2 倍生成，传入则视为自定义价。
4. **历史价格**：原 `updateListing` 的「不得低于平台建议价」限制调整为「不得低于采购价」，允许商家做促销定价。
5. **下单快照**：订单仍冻结下单时的 `unitPriceCents` 与供货价，后续改价不影响历史订单与佣金结算。

---

## 7. 验收标准与实测结果

| # | 验收项 | 结果 | 说明 |
|---|--------|------|------|
| A1 | 商品一致 | ✅ | 13 个商品均来自同一 `Product`，C 端列表/详情字段与商家端一致 |
| A2 | 全部带图 | ✅ | 13/13 有 `images` 且 `intro` 非空；`GoodsImage` 兜底无图/加载失败 |
| A3 | 详情完整 | ✅ | 9 区块齐全；详情接口返回规格、介绍、视频、搭配推荐 |
| A4 | 默认 2 倍 | ✅ | 数据库核对 13/13 `retailPriceCents = supplyPriceCents × 2` |
| A5 | 商家自定义 | ✅ | 改价后 C 端即时返回新价，`priceSource = merchant` |
| A6 | 恢复默认 | ✅ | `resetToDefault` 恢复 2 倍价并清除自定义标记 |
| A7 | 价格下限 | ✅ | 低于采购价返回 400「售价不能低于采购价」 |
| A8 | 编译与测试 | ✅ | API / mini-b / mini-c `tsc` 通过；H5 与 weapp 均编译成功；相关 e2e 11/11 通过 |
| A9 | 视觉走查 | ✅ | 390×844 无头浏览器截图核对：首页分类筛选与商品卡、详情页 9 区块、定价页与改价弹层均正常；修复视频容器覆盖整页问题 |

接口实测（本机）：

```
GET  /api/sales-orders/storefront            → 13 条，均含 images / categoryLabel / intro
GET  /api/sales-orders/storefront/:id        → 规格 6 项、图片、搭配推荐
PATCH 改价 22800                             → C 端 22800，priceSource = merchant
PATCH resetToDefault                         → C 端 19800，priceSource = default
PATCH 5000（低于采购价 9900）                 → 400
```

---

## 8. 待确认事项

1. **促销价与划线价**：当前 C 端只展示一个成交价，未展示「原价/划线价」。如需大促氛围，建议增加 `compareAtPriceCents`，由商家维护并做合规校验。
2. **批量调价**：定价页当前逐品改价；如需按分类批量上浮/下调，需新增批量接口与操作日志。
3. **改价权限**：目前商家主账号可改价；是否限制销售角色、是否需要平台审核（尤其大幅低于建议价）待业务确认。
4. **价格变更通知**：改价后是否通知已加购/已咨询客户，涉及消息中心模板与频控。
5. **供货价变动联动**：`priceCustomized = false` 的商品目前仅在读取时使用历史售价，未做「供货价变动自动重算」。如需强联动，应在供货价更新时批量重算默认价商品。
6. **测试数据隔离**：e2e 测试与演示库共用同一数据库，运行测试会产生临时商品/订单，建议后续拆分 `DATABASE_URL` 测试库。

---

## 9. 变更文件索引

| 层 | 文件 |
|----|------|
| 数据 | `apps/api/prisma/schema.prisma`、`prisma/migrations/20261026092616_merchant_price_customized/`、`prisma/seed.ts` |
| 共享 | `packages/shared/src/product.ts`（默认加价、毛利计算） |
| 接口 | `apps/api/src/products/{products.service.ts,dto/create-listing.dto.ts,dto/update-listing.dto.ts}`、`apps/api/src/sales/{sales-orders.controller.ts,sales-orders.service.ts}` |
| C 端 | `apps/mini-c/src/pages/index/index.tsx`、`pages/product/index.tsx`、`components/{GoodsImage,SpecList}.tsx`、`lib/{api.ts,storefront.ts}`、`app.scss` |
| 商家端 | `apps/mini-b/src/pages/pricing/*`、`pages/profile/index.tsx`、`pages/procurement/index.tsx`、`app.config.ts`、`app.scss` |
| 测试 | `apps/api/test/products.e2e-spec.ts`、`apps/api/test/sales-orders.e2e-spec.ts` |
