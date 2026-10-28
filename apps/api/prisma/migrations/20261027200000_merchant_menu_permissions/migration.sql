-- 商家菜单权限：后台为已入驻商家配置商家端可见菜单；无记录默认全量
-- CreateTable
CREATE TABLE "MerchantMenuPermission" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "menus" TEXT[],
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MerchantMenuPermission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MerchantMenuPermission_merchantId_key" ON "MerchantMenuPermission"("merchantId");

-- AddForeignKey
ALTER TABLE "MerchantMenuPermission" ADD CONSTRAINT "MerchantMenuPermission_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
