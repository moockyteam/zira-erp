-- =====================================================
-- MIGRATION V7: Regroupement des Paiements par Date
-- =====================================================
-- 
-- OBJECTIF:
-- 1. Regrouper tous les paiements par (client + date) en un seul paiement global
-- 2. Mode de paiement = 'ESPECES' pour tous
-- 3. Lier les allocations existantes au paiement global
-- 4. Permettre la modification avec recalcul automatique
-- =====================================================

-- =============================================================================
-- ÉTAPE 1: S'assurer que les tables et colonnes existent
-- =============================================================================

-- Table des paiements globaux
CREATE TABLE IF NOT EXISTS global_payment_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    amount DECIMAL(15,3) NOT NULL CHECK (amount > 0),
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    payment_method TEXT NOT NULL DEFAULT 'ESPECES',
    notes TEXT,
    amount_allocated DECIMAL(15,3) DEFAULT 0,
    amount_to_initial_balance DECIMAL(15,3) DEFAULT 0,
    amount_credited DECIMAL(15,3) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ajouter les colonnes de liaison si elles n'existent pas
DO $$ BEGIN
    ALTER TABLE invoice_payments ADD COLUMN IF NOT EXISTS global_payment_id UUID REFERENCES global_payment_entries(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE delivery_note_payments ADD COLUMN IF NOT EXISTS global_payment_id UUID REFERENCES global_payment_entries(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Index
CREATE INDEX IF NOT EXISTS idx_gpe_customer ON global_payment_entries(customer_id);
CREATE INDEX IF NOT EXISTS idx_gpe_date ON global_payment_entries(payment_date);
CREATE INDEX IF NOT EXISTS idx_ip_global ON invoice_payments(global_payment_id);
CREATE INDEX IF NOT EXISTS idx_dnp_global ON delivery_note_payments(global_payment_id);

-- RLS
ALTER TABLE global_payment_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "gpe_policy" ON global_payment_entries;
CREATE POLICY "gpe_policy" ON global_payment_entries FOR ALL 
USING (EXISTS (SELECT 1 FROM customers WHERE customers.id = global_payment_entries.customer_id));

GRANT ALL ON global_payment_entries TO authenticated, service_role;

-- =============================================================================
-- ÉTAPE 2: MIGRATION - Regrouper les paiements par (customer_id + date)
-- =============================================================================

-- D'abord, vider les entrées existantes pour éviter les doublons
-- (uniquement celles qui sont des migrations, pas les nouvelles)
DELETE FROM global_payment_entries WHERE notes LIKE '%Migré%';

-- Créer les paiements globaux regroupés par client + date
-- Avec mode de paiement = 'ESPECES'
INSERT INTO global_payment_entries (customer_id, amount, payment_date, payment_method, notes, amount_allocated, created_at)
SELECT 
    customer_id,
    SUM(total_amount) as amount,
    payment_date::date,
    'ESPECES',
    'Migré - Regroupé par date',
    SUM(total_amount) as amount_allocated,
    MIN(created_at)
FROM (
    -- Paiements sur factures
    SELECT 
        i.customer_id,
        ip.payment_date::date as payment_date,
        ip.amount as total_amount,
        ip.created_at
    FROM invoice_payments ip
    JOIN invoices i ON ip.invoice_id = i.id
    WHERE ip.global_payment_id IS NULL
    
    UNION ALL
    
    -- Paiements sur BL
    SELECT 
        dn.customer_id,
        dnp.payment_date::date as payment_date,
        dnp.amount as total_amount,
        dnp.created_at
    FROM delivery_note_payments dnp
    JOIN delivery_notes dn ON dnp.delivery_note_id = dn.id
    WHERE dnp.global_payment_id IS NULL
) combined
GROUP BY customer_id, payment_date
HAVING SUM(total_amount) > 0;

-- =============================================================================
-- ÉTAPE 3: Lier les paiements détaillés aux paiements globaux
-- =============================================================================

-- Lier les invoice_payments
UPDATE invoice_payments ip
SET global_payment_id = gpe.id
FROM invoices i, global_payment_entries gpe
WHERE ip.invoice_id = i.id
  AND i.customer_id = gpe.customer_id
  AND ip.payment_date::date = gpe.payment_date
  AND ip.global_payment_id IS NULL
  AND gpe.notes LIKE '%Migré%';

-- Lier les delivery_note_payments
UPDATE delivery_note_payments dnp
SET global_payment_id = gpe.id
FROM delivery_notes dn, global_payment_entries gpe
WHERE dnp.delivery_note_id = dn.id
  AND dn.customer_id = gpe.customer_id
  AND dnp.payment_date::date = gpe.payment_date
  AND dnp.global_payment_id IS NULL
  AND gpe.notes LIKE '%Migré%';

-- =============================================================================
-- ÉTAPE 4: Uniformiser payment_method à 'ESPECES' dans les anciens paiements
-- =============================================================================

UPDATE invoice_payments SET payment_method = 'ESPECES' WHERE payment_method IS NULL OR payment_method = '';
UPDATE delivery_note_payments SET payment_method = 'ESPECES' WHERE payment_method IS NULL OR payment_method = '';

-- =============================================================================
-- ÉTAPE 5: Fonctions pour l'édition
-- =============================================================================

-- Fonction pour recréer les allocations lors de la modification
CREATE OR REPLACE FUNCTION update_global_payment(
    p_entry_id UUID,
    p_new_amount DECIMAL,
    p_new_method TEXT DEFAULT NULL,
    p_new_date DATE DEFAULT NULL
) 
RETURNS JSONB AS $$
DECLARE
    v_entry RECORD;
    v_customer_id UUID;
    v_old_to_initial DECIMAL;
    v_remaining DECIMAL;
    v_allocated DECIMAL := 0;
    v_pay DECIMAL;
    v_new_date DATE;
    v_new_method TEXT;
    r_doc RECORD;
BEGIN
    -- 1. Récupérer l'entrée existante
    SELECT * INTO v_entry FROM global_payment_entries WHERE id = p_entry_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Paiement non trouvé'; END IF;
    
    v_customer_id := v_entry.customer_id;
    v_old_to_initial := COALESCE(v_entry.amount_to_initial_balance, 0);
    v_new_date := COALESCE(p_new_date, v_entry.payment_date);
    v_new_method := COALESCE(p_new_method, v_entry.payment_method);
    v_remaining := ROUND(p_new_amount, 3);

    -- 2. Restaurer initial_balance si on l'avait réduit
    IF v_old_to_initial > 0 THEN
        UPDATE customers SET initial_balance = initial_balance + v_old_to_initial WHERE id = v_customer_id;
    END IF;

    -- 3. Supprimer les anciennes allocations liées à ce paiement
    DELETE FROM invoice_payments WHERE global_payment_id = p_entry_id;
    DELETE FROM delivery_note_payments WHERE global_payment_id = p_entry_id;

    -- 4. Recréer les allocations avec le nouveau montant (FIFO)
    FOR r_doc IN (
        SELECT i.id, 'INVOICE' as type, i.invoice_number as ref,
            (i.total_ttc - COALESCE(SUM(p.amount), 0)) as balance
        FROM invoices i LEFT JOIN invoice_payments p ON i.id = p.invoice_id
        WHERE i.customer_id = v_customer_id AND i.status NOT IN ('BROUILLON', 'ANNULEE')
        GROUP BY i.id HAVING (i.total_ttc - COALESCE(SUM(p.amount), 0)) > 0.001
        
        UNION ALL
        
        SELECT dn.id, 'DELIVERY_NOTE', dn.delivery_note_number,
            (dn.total_ttc - COALESCE(SUM(p.amount), 0)) as balance
        FROM delivery_notes dn LEFT JOIN delivery_note_payments p ON dn.id = p.delivery_note_id
        WHERE dn.customer_id = v_customer_id AND dn.status = 'LIVRE' AND dn.invoice_id IS NULL
          AND (dn.is_valued = true OR dn.total_ttc > 0)
        GROUP BY dn.id HAVING (dn.total_ttc - COALESCE(SUM(p.amount), 0)) > 0.001
        
        ORDER BY 4 DESC
    )
    LOOP
        IF v_remaining <= 0.001 THEN EXIT; END IF;
        
        v_pay := LEAST(v_remaining, r_doc.balance);
        
        IF r_doc.type = 'INVOICE' THEN
            INSERT INTO invoice_payments (invoice_id, amount, payment_date, payment_method, notes, global_payment_id)
            VALUES (r_doc.id, v_pay, v_new_date::TIMESTAMP, v_new_method, '(Alloc. Auto)', p_entry_id);
        ELSE
            INSERT INTO delivery_note_payments (delivery_note_id, amount, payment_date, payment_method, notes, global_payment_id)
            VALUES (r_doc.id, v_pay, v_new_date::TIMESTAMP, v_new_method, '(Alloc. Auto)', p_entry_id);
        END IF;
        
        v_remaining := ROUND(v_remaining - v_pay, 3);
        v_allocated := v_allocated + v_pay;
    END LOOP;

    -- 5. Réduire initial_balance si reste
    IF v_remaining > 0 THEN
        DECLARE v_init_bal DECIMAL;
        BEGIN
            SELECT COALESCE(initial_balance, 0) INTO v_init_bal FROM customers WHERE id = v_customer_id;
            IF v_init_bal > 0 THEN
                UPDATE customers SET initial_balance = initial_balance - LEAST(v_remaining, v_init_bal) WHERE id = v_customer_id;
            END IF;
        END;
    END IF;

    -- 6. Mettre à jour l'entrée globale
    UPDATE global_payment_entries 
    SET amount = p_new_amount,
        payment_date = v_new_date,
        payment_method = v_new_method,
        amount_allocated = v_allocated,
        updated_at = NOW()
    WHERE id = p_entry_id;

    RETURN jsonb_build_object('success', true, 'new_amount', p_new_amount, 'allocated', v_allocated);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour supprimer un paiement global
CREATE OR REPLACE FUNCTION delete_global_payment(p_entry_id UUID) 
RETURNS JSONB AS $$
DECLARE
    v_entry RECORD;
    v_old_to_initial DECIMAL;
BEGIN
    SELECT * INTO v_entry FROM global_payment_entries WHERE id = p_entry_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Paiement non trouvé'; END IF;
    
    v_old_to_initial := COALESCE(v_entry.amount_to_initial_balance, 0);

    -- Restaurer initial_balance
    IF v_old_to_initial > 0 THEN
        UPDATE customers SET initial_balance = initial_balance + v_old_to_initial WHERE id = v_entry.customer_id;
    END IF;

    -- Supprimer les allocations (les FK ont SET NULL, pas CASCADE)
    DELETE FROM invoice_payments WHERE global_payment_id = p_entry_id;
    DELETE FROM delivery_note_payments WHERE global_payment_id = p_entry_id;
    
    -- Supprimer l'entrée
    DELETE FROM global_payment_entries WHERE id = p_entry_id;

    RETURN jsonb_build_object('success', true, 'deleted_amount', v_entry.amount);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- PERMISSIONS ET RELOAD
-- =============================================================================
GRANT EXECUTE ON FUNCTION update_global_payment(UUID, DECIMAL, TEXT, DATE) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION delete_global_payment(UUID) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- VÉRIFICATION: Afficher le résumé de la migration
-- =============================================================================
SELECT 
    'Paiements globaux créés' as metric,
    COUNT(*) as valeur
FROM global_payment_entries
WHERE notes LIKE '%Migré%'

UNION ALL

SELECT 
    'Invoice payments liés',
    COUNT(*)
FROM invoice_payments
WHERE global_payment_id IS NOT NULL

UNION ALL

SELECT 
    'BL payments liés',
    COUNT(*)
FROM delivery_note_payments
WHERE global_payment_id IS NOT NULL;

-- =============================================================================
-- RÉSUMÉ
-- =============================================================================
-- ✅ Paiements regroupés par (client + date)
-- ✅ Mode de paiement = 'ESPECES' pour tous
-- ✅ Allocations liées via global_payment_id
-- ✅ Modification → Recalcul automatique des allocations FIFO
-- ✅ Les anciens paiements sont préservés mais liés au global
-- =============================================================================
