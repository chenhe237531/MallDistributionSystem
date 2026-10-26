-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "guideVideoUrl" TEXT,
ADD COLUMN     "intro" TEXT;

-- CreateTable
CREATE TABLE "ProductRelated" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "relatedProductId" TEXT NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductRelated_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductCourse" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductCourse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductRelated_relatedProductId_idx" ON "ProductRelated"("relatedProductId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductRelated_productId_relatedProductId_key" ON "ProductRelated"("productId", "relatedProductId");

-- CreateIndex
CREATE INDEX "ProductCourse_courseId_idx" ON "ProductCourse"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductCourse_productId_courseId_key" ON "ProductCourse"("productId", "courseId");

-- AddForeignKey
ALTER TABLE "ProductRelated" ADD CONSTRAINT "ProductRelated_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductRelated" ADD CONSTRAINT "ProductRelated_relatedProductId_fkey" FOREIGN KEY ("relatedProductId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCourse" ADD CONSTRAINT "ProductCourse_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCourse" ADD CONSTRAINT "ProductCourse_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
