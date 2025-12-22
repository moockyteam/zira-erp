-- Migration pour permettre la suppression d'articles utilisés (Hard Delete)
-- Cette commande modifie les contraintes de clé étrangère pour qu'elles mettent à NULL la référence item_id au lieu de bloquer la suppression.

-- 1. Invoice Lines
ALTER TABLE invoice_lines
DROP CONSTRAINT IF EXISTS invoice_lines_item_id_fkey;

ALTER TABLE invoice_lines
ADD CONSTRAINT invoice_lines_item_id_fkey
FOREIGN KEY (item_id)
REFERENCES items(id)
ON DELETE SET NULL;

-- 2. Quote Lines
ALTER TABLE quote_lines
DROP CONSTRAINT IF EXISTS quote_lines_item_id_fkey;

ALTER TABLE quote_lines
ADD CONSTRAINT quote_lines_item_id_fkey
FOREIGN KEY (item_id)
REFERENCES items(id)
ON DELETE SET NULL;

-- 3. Delivery Note Lines (if exists, best effort)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'delivery_note_lines') THEN
        ALTER TABLE delivery_note_lines DROP CONSTRAINT IF EXISTS delivery_note_lines_item_id_fkey;
        ALTER TABLE delivery_note_lines ADD CONSTRAINT delivery_note_lines_item_id_fkey FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE SET NULL;
    END IF;
END $$;
