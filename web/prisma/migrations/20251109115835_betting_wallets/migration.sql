-- AlterTable
ALTER TABLE "users" ADD COLUMN     "walletAddress" TEXT,
ADD COLUMN     "walletType" TEXT;

-- CreateTable
CREATE TABLE "bets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "team1" TEXT NOT NULL,
    "team2" TEXT NOT NULL,
    "marketDescription" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "betAmount" DOUBLE PRECISION NOT NULL,
    "odds" DOUBLE PRECISION NOT NULL,
    "predictedOutcome" TEXT NOT NULL,
    "actualOutcome" TEXT,
    "profitLoss" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "walletAddress" TEXT NOT NULL,
    "aiSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settledAt" TIMESTAMP(3),

    CONSTRAINT "bets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bets_userId_idx" ON "bets"("userId");

-- CreateIndex
CREATE INDEX "bets_status_idx" ON "bets"("status");

-- AddForeignKey
ALTER TABLE "bets" ADD CONSTRAINT "bets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
