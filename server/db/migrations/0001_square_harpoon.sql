-- Los flujos OAuth son efímeros (5 min): se descartan los pendientes para poder
-- agregar la columna NOT NULL sin valor por defecto.
DELETE FROM "oauth_flows";--> statement-breakpoint
ALTER TABLE "oauth_flows" ADD COLUMN "binding_hash" text NOT NULL;