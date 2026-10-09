-- Marchand : notifications par e-mail (commandes payées, stock bas)
-- Ajoute le drapeau d'opt-out (par défaut : activé).
ALTER TABLE "users" ADD COLUMN "email_notifications" BOOLEAN NOT NULL DEFAULT true;
