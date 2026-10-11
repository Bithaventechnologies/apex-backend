-- AlterTable
ALTER TABLE "deposits" ADD COLUMN     "gatewayId" INTEGER;

-- CreateTable
CREATE TABLE "deposit_gateways" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "qrCode" TEXT,
    "instructions" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deposit_gateways_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "deposit_gateways_currency_idx" ON "deposit_gateways"("currency");

-- CreateIndex
CREATE INDEX "deposit_gateways_isActive_idx" ON "deposit_gateways"("isActive");

-- AddForeignKey
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_gatewayId_fkey" FOREIGN KEY ("gatewayId") REFERENCES "deposit_gateways"("id") ON DELETE SET NULL ON UPDATE CASCADE;
