-- Trigger pour gérer intelligemment les mises à jour de stock lors de la modification des factures
-- Ce trigger agit APRES insertion, suppression ou mise à jour sur invoice_lines.

CREATE OR REPLACE FUNCTION handle_invoice_line_changes()
RETURNS TRIGGER 
SECURITY DEFINER
AS $$
DECLARE
    v_invoice_status TEXT;
    v_invoice_id UUID;
    v_company_id UUID;
    v_diff NUMERIC;
BEGIN
    -- Déterminer l'ID de la facture concernée
    IF (TG_OP = 'DELETE') THEN
        v_invoice_id := OLD.invoice_id;
    ELSE
        v_invoice_id := NEW.invoice_id;
    END IF;

    -- Récupérer le statut de la facture et le company_id
    SELECT status, company_id INTO v_invoice_status, v_company_id
    FROM invoices 
    WHERE id = v_invoice_id;

    -- Si la facture n'est pas "active" (c'est-à-dire brouillon ou annulée), on ne touche pas au stock
    -- Car le stock n'est censé être affecté que pour les factures envoyées/payées.
    IF v_invoice_status IS NULL OR v_invoice_status NOT IN ('ENVOYE', 'PAYEE', 'PARTIELLEMENT_PAYEE') THEN
        RETURN NULL;
    END IF;

    -- Cas 1: SUPPRESSION d'une ligne (DELETE)
    IF (TG_OP = 'DELETE') THEN
        -- On remet l'article en stock (Annulation de la vente pour cette ligne)
        INSERT INTO stock_movements (item_id, quantity, movement_type, notes, company_id, created_at)
        VALUES (OLD.item_id, OLD.quantity, 'ENTREE', 'Suppression ligne facture ' || v_invoice_id, v_company_id, NOW());
        RETURN OLD;
    
    -- Cas 2: INSERTION d'une nouvelle ligne (INSERT)
    ELSIF (TG_OP = 'INSERT') THEN
        -- On sort l'article du stock (Nouvelle vente)
        INSERT INTO stock_movements (item_id, quantity, movement_type, notes, company_id, created_at)
        VALUES (NEW.item_id, NEW.quantity, 'SORTIE', 'Ajout ligne facture ' || v_invoice_id, v_company_id, NOW());
        RETURN NEW;

    -- Cas 3: MISE A JOUR d'une ligne (UPDATE)
    ELSIF (TG_OP = 'UPDATE') THEN
        -- Si l'article change complètement
        IF OLD.item_id <> NEW.item_id THEN
            -- Rembourser l'ancien
            INSERT INTO stock_movements (item_id, quantity, movement_type, notes, company_id, created_at)
            VALUES (OLD.item_id, OLD.quantity, 'ENTREE', 'Modif (Ancien) facture ' || v_invoice_id, v_company_id, NOW());
            -- Déduire le nouveau
            INSERT INTO stock_movements (item_id, quantity, movement_type, notes, company_id, created_at)
            VALUES (NEW.item_id, NEW.quantity, 'SORTIE', 'Modif (Nouveau) facture ' || v_invoice_id, v_company_id, NOW());
        
        -- Si c'est juste la quantité qui change
        ELSIF OLD.quantity <> NEW.quantity THEN
            v_diff := NEW.quantity - OLD.quantity;
            
            IF v_diff > 0 THEN
                -- La quantité a augmenté (e.g. 5 -> 8), on doit sortir la différence (3)
                INSERT INTO stock_movements (item_id, quantity, movement_type, notes, company_id, created_at)
                VALUES (NEW.item_id, v_diff, 'SORTIE', 'Ajustement (+qte) facture ' || v_invoice_id, v_company_id, NOW());
            ELSE
                -- La quantité a diminué (e.g. 5 -> 3), on doit rentrer la différence positive (2)
                INSERT INTO stock_movements (item_id, quantity, movement_type, notes, company_id, created_at)
                VALUES (NEW.item_id, ABS(v_diff), 'ENTREE', 'Ajustement (-qte) facture ' || v_invoice_id, v_company_id, NOW());
            END IF;
        END IF;
        
        RETURN NEW;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Application du trigger
DROP TRIGGER IF EXISTS trigger_handle_invoice_line_changes ON invoice_lines;

CREATE TRIGGER trigger_handle_invoice_line_changes
AFTER INSERT OR UPDATE OR DELETE ON invoice_lines
FOR EACH ROW
EXECUTE FUNCTION handle_invoice_line_changes();
