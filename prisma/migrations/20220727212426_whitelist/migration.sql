-- CreateTable
CREATE TABLE "ips" (
    "value" TEXT NOT NULL PRIMARY KEY,
    "countryCode" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "isp" TEXT NOT NULL,
    "whitelist" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "players" (
    "nick" TEXT NOT NULL PRIMARY KEY
);

-- CreateTable
CREATE TABLE "_IpToPlayer" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_IpToPlayer_A_fkey" FOREIGN KEY ("A") REFERENCES "ips" ("value") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_IpToPlayer_B_fkey" FOREIGN KEY ("B") REFERENCES "players" ("nick") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "_IpToPlayer_AB_unique" ON "_IpToPlayer"("A", "B");

-- CreateIndex
CREATE INDEX "_IpToPlayer_B_index" ON "_IpToPlayer"("B");
