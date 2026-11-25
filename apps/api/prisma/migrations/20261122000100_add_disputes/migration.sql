-- Litiges détaillés : motif, description, échanges client / marchand / admin. Ajout seulement.
CREATE TABLE "disputes" (
    "id" SERIAL NOT NULL,
    "store_order_id" INTEGER NOT NULL,
    "opened_by_id" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ouvert',
    "admin_note" TEXT,
    "resolved_by_id" INTEGER,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "disputes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "dispute_messages" (
    "id" SERIAL NOT NULL,
    "dispute_id" INTEGER NOT NULL,
    "author_id" INTEGER NOT NULL,
    "author_role" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "attachment_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dispute_messages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "disputes_store_order_id_key" ON "disputes"("store_order_id");
CREATE INDEX "dispute_messages_dispute_id_created_at_idx" ON "dispute_messages"("dispute_id", "created_at");

ALTER TABLE "disputes" ADD CONSTRAINT "disputes_store_order_id_fkey" FOREIGN KEY ("store_order_id") REFERENCES "store_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_opened_by_id_fkey" FOREIGN KEY ("opened_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "dispute_messages" ADD CONSTRAINT "dispute_messages_dispute_id_fkey" FOREIGN KEY ("dispute_id") REFERENCES "disputes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "dispute_messages" ADD CONSTRAINT "dispute_messages_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Même politique de sécurité que les autres tables : RLS actif, aucun accès public.
ALTER TABLE "public"."disputes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."dispute_messages" ENABLE ROW LEVEL SECURITY;

-- Les sous-commandes déjà en litige reçoivent une fiche de litige (motif « autre »).
INSERT INTO "disputes" ("store_order_id", "opened_by_id", "reason", "description")
SELECT so."id", o."client_id", 'autre', 'Litige ouvert avant la mise en place du formulaire détaillé.'
FROM "store_orders" so JOIN "orders" o ON o."id" = so."order_id"
WHERE so."status" = 'litige'
ON CONFLICT ("store_order_id") DO NOTHING;
