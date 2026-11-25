-- Date d'expédition d'une sous-commande (confirmation automatique après N jours). Ajout seulement.
ALTER TABLE "store_orders" ADD COLUMN "shipped_at" TIMESTAMP(3);
-- Les colis déjà expédiés repartent avec un délai complet plutôt que d'être confirmés d'un coup.
UPDATE "store_orders" SET "shipped_at" = NOW() WHERE "status" = 'expediee' AND "shipped_at" IS NULL;
