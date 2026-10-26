-- 盒码表按渠道查询（风控统计、渠道明细）缺少索引，BoxCode 是系统最大表，补 channelId 索引
CREATE INDEX "BoxCode_channelId_idx" ON "BoxCode"("channelId");
