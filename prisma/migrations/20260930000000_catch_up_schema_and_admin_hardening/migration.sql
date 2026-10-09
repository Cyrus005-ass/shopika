-- Migration de rattrapage + durcissement admin.
--
-- Pourquoi : les migrations précédentes s'arrêtent à `token_version`, alors
-- que schema.prisma contient bien plus (notifications, favoris, support,
-- paiements, abonnements, profil utilisateur, etc.) — probablement appliqués
-- via `prisma db push`. Sur une base neuve, `prisma migrate deploy` produisait
-- donc une base incomplète. Cette migration est IDEMPOTENTE (IF NOT EXISTS /
-- blocs DO) : elle s'applique sans erreur aussi bien sur une base déjà
-- alignée (prod actuelle) que sur une base créée uniquement par les anciennes
-- migrations.

-- ===================================================================
-- 1. Enums
-- ===================================================================
DO $$ BEGIN
  CREATE TYPE "SubscriptionStatus" AS ENUM ('en_attente_paiement', 'active', 'suspendu');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "PaymentStatus" AS ENUM ('en_attente', 'payee', 'echouee', 'remboursee');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "PayoutStatus" AS ENUM ('en_attente', 'en_cours', 'effectue', 'echoue');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "SupportStatus" AS ENUM ('ouvert', 'traite');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Valeur ajoutée à PayoutStatus : verrou "versement en cours" (anti double versement).
ALTER TYPE "PayoutStatus" ADD VALUE IF NOT EXISTS 'en_cours';

-- ===================================================================
-- 2. users
-- ===================================================================
ALTER TABLE "users" ALTER COLUMN "phone" DROP NOT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "first_name" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_name" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "address" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "country" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verification_code" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verification_expires" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verification_sent_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "two_factor_on" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "token_version" INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "users"("email");

-- ===================================================================
-- 3. stores
-- ===================================================================
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "country" TEXT;
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "rating" DOUBLE PRECISION;
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "shipping_fee" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "payout_phone" TEXT;
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "payout_country" TEXT;
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "subscription_status" "SubscriptionStatus" NOT NULL DEFAULT 'en_attente_paiement';
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "subscription_expires_at" TIMESTAMP(3);
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "creation_fee_paid" BOOLEAN NOT NULL DEFAULT false;
-- Nouveau : modération admin
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "is_suspended" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "suspended_reason" TEXT;
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "suspended_at" TIMESTAMP(3);

-- ===================================================================
-- 4. orders / store_orders
-- ===================================================================
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "delivery_city" TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "delivery_country" TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "delivery_phone" TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "payment_status" "PaymentStatus" NOT NULL DEFAULT 'en_attente';
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "payment_method" TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "fedapay_transaction_id" TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "paid_at" TIMESTAMP(3);

ALTER TABLE "store_orders" ADD COLUMN IF NOT EXISTS "payout_status" "PayoutStatus" NOT NULL DEFAULT 'en_attente';
ALTER TABLE "store_orders" ADD COLUMN IF NOT EXISTS "fedapay_payout_id" TEXT;
ALTER TABLE "store_orders" ADD COLUMN IF NOT EXISTS "paid_out_at" TIMESTAMP(3);
-- Nouveau : anti force-brute du code de livraison + remboursement client
ALTER TABLE "store_orders" ADD COLUMN IF NOT EXISTS "delivery_code_attempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "store_orders" ADD COLUMN IF NOT EXISTS "refund_status" "PayoutStatus" NOT NULL DEFAULT 'en_attente';
ALTER TABLE "store_orders" ADD COLUMN IF NOT EXISTS "fedapay_refund_id" TEXT;
ALTER TABLE "store_orders" ADD COLUMN IF NOT EXISTS "refunded_at" TIMESTAMP(3);

-- L'historique financier d'une boutique ne doit jamais disparaître avec elle :
-- store_orders.store_id passe (ou reste) en RESTRICT, que la base vienne des
-- migrations (déjà RESTRICT) ou d'un `db push` (CASCADE).
ALTER TABLE "store_orders" DROP CONSTRAINT IF EXISTS "store_orders_store_id_fkey";
ALTER TABLE "store_orders" ADD CONSTRAINT "store_orders_store_id_fkey"
  FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ===================================================================
-- 5. notifications, support_messages, favorites
-- ===================================================================
CREATE TABLE IF NOT EXISTS "notifications" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "support_messages" (
    "id" SERIAL NOT NULL,
    "merchant_id" INTEGER NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "SupportStatus" NOT NULL DEFAULT 'ouvert',
    "admin_reply" TEXT,
    "replied_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "support_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "favorites" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "favorites_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "favorites_user_id_product_id_key" ON "favorites"("user_id", "product_id");

-- ===================================================================
-- 6. Nouvelles tables : paiements d'abonnement + journal d'audit admin
-- ===================================================================
CREATE TABLE IF NOT EXISTS "subscription_payments" (
    "id" SERIAL NOT NULL,
    "store_id" INTEGER NOT NULL,
    "fedapay_transaction_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "subscription_payments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "subscription_payments_fedapay_transaction_id_key"
  ON "subscription_payments"("fedapay_transaction_id");

CREATE TABLE IF NOT EXISTS "admin_audit_logs" (
    "id" SERIAL NOT NULL,
    "admin_id" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" INTEGER,
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "admin_audit_logs_created_at_idx" ON "admin_audit_logs"("created_at");

-- ===================================================================
-- 7. Clés étrangères des tables ci-dessus (ajoutées seulement si absentes)
-- ===================================================================
DO $$ BEGIN
  ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_merchant_id_fkey"
    FOREIGN KEY ("merchant_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "favorites" ADD CONSTRAINT "favorites_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_store_id_fkey"
    FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_admin_id_fkey"
    FOREIGN KEY ("admin_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
