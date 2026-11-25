-- Frais de livraison figés par sous-commande, annulation des commandes non
-- payées, anti force-brute (code e-mail + mot de passe). Idempotent.

-- PaymentStatus : nouvelle valeur "annulee".
-- (ADD VALUE ne peut pas être utilisée dans la même transaction que sa
-- création : aucune requête de cette migration ne s'en sert.)
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'annulee';

ALTER TABLE "store_orders" ADD COLUMN IF NOT EXISTS "shipping_fee" DECIMAL(10,2) NOT NULL DEFAULT 0;

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verification_attempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "failed_login_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "locked_until" TIMESTAMP(3);

-- Sert la recherche des commandes à expirer.
CREATE INDEX IF NOT EXISTS "orders_payment_status_created_at_idx" ON "orders"("payment_status", "created_at");
