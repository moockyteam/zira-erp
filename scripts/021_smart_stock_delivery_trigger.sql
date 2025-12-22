-- Trigger pour gérer intelligemment les mises à jour de stock lors de la modification des BL
-- Ce trigger agit APRES insertion, suppression ou mise à jour sur delivery_note_lines.

CREATE OR REPLACE FUNCTION handle_delivery_note_line_changes()
RETURNS TRIGGER 
SECURITY DEFINER
AS $$
DECLARE
    v_dn_status TEXT;
    v_dn_id UUID;
    v_company_id UUID;
    v_diff NUMERIC;
BEGIN
    -- Déterminer l'ID du BL concerné
    IF (TG_OP = 'DELETE') THEN
        v_dn_id := OLD.delivery_note_id;
    ELSE
        v_dn_id := NEW.delivery_note_id;
    END IF;

    -- Récupérer le statut du BL et le company_id
    SELECT status, company_id INTO v_dn_status, v_company_id
    FROM delivery_notes 
    WHERE id = v_dn_id;

    -- Si le BL n'est pas "LIVRE", on ne touche pas au stock
    IF v_dn_status IS NULL OR v_dn_status <> 'LIVRE' THEN
        RETURN NULL;
    END IF;

    -- Cas 1: SUPPRESSION d'une ligne (DELETE)
    IF (TG_OP = 'DELETE') THEN
        INSERT INTO stock_movements (item_id, quantity, movement_type, notes, company_id, created_at)
        VALUES (OLD.item_id, OLD.quantity, 'ENTREE', 'Suppression ligne BL ' || v_dn_id, v_company_id, NOW());
        RETURN OLD;
    
    -- Cas 2: INSERTION d'une nouvelle ligne (INSERT)
    ELSIF (TG_OP = 'INSERT') THEN
        INSERT INTO stock_movements (item_id, quantity, movement_type, notes, company_id, created_at)
        VALUES (NEW.item_id, NEW.quantity, 'SORTIE', 'Ajout ligne BL ' || v_dn_id, v_company_id, NOW());
        RETURN NEW;

    -- Cas 3: MISE A JOUR d'une ligne (UPDATE)
    ELSIF (TG_OP = 'UPDATE') THEN
        -- Si l'article change complètement
        IF OLD.item_id <> NEW.item_id THEN
            INSERT INTO stock_movements (item_id, quantity, movement_type, notes, company_id, created_at)
            VALUES (OLD.item_id, OLD.quantity, 'ENTREE', 'Modif (Ancien) BL ' || v_dn_id, v_company_id, NOW());
            INSERT INTO stock_movements (item_id, quantity, movement_type, notes, company_id, created_at)
            VALUES (NEW.item_id, NEW.quantity, 'SORTIE', 'Modif (Nouveau) BL ' || v_dn_id, v_company_id, NOW());
        
        -- Si c'est juste la quantité qui change
        ELSIF OLD.quantity <> NEW.quantity THEN
            v_diff := NEW.quantity - OLD.quantity;
            
            IF v_diff > 0 THEN
                INSERT INTO stock_movements (item_id, quantity, movement_type, notes, company_id, created_at)
                VALUES (NEW.item_id, v_diff, 'SORTIE', 'Ajustement (+qte) BL ' || v_dn_id, v_company_id, NOW());
            ELSE
                INSERT INTO stock_movements (item_id, quantity, movement_type, notes, company_id, created_at)
                VALUES (NEW.item_id, ABS(v_diff), 'ENTREE', 'Ajustement (-qte) BL ' || v_dn_id, v_company_id, NOW());
            END IF;
        END IF;
        
        RETURN NEW;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Application du trigger
DROP TRIGGER IF EXISTS trigger_handle_dn_line_changes ON delivery_note_lines;

CREATE TRIGGER trigger_handle_dn_line_changes
AFTER INSERT OR UPDATE OR DELETE ON delivery_note_lines
FOR EACH ROW
EXECUTE FUNCTION handle_delivery_note_line_changes();
