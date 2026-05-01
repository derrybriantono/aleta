CREATE UNIQUE INDEX "idx_accounts_provider_account" ON "accounts" USING btree ("provider_id","account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "letter_origin_references_label_unique" ON "letter_origin_references" USING btree ("label");--> statement-breakpoint
CREATE INDEX "idx_letters_search_document_fts" ON "letters" USING gin (to_tsvector('simple', "search_document"));--> statement-breakpoint
CREATE UNIQUE INDEX "idx_sessions_token" ON "sessions" USING btree ("token");