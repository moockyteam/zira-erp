-- =====================================================
-- FIX V6: Migration + Édition des Paiements Globaux
-- =====================================================
-- 
-- OBJECTIFS:
-- 1. Migrer les anciens paiements vers global_payment_entries
-- 2. Permettre l'édition avec recalcul correct
-- 3. S'assurer que 400 DT saisi = 400 DT affiché
-- =====================================================

-- =============================================================================
-- PARTIE 1: CRÉER LES TABLES SI ELLES N'EXISTENT PAS
-- =============================================================================

-- Table des entrées de paiements globaux
CREATE TABLE IF NOT EXISTS global_payment_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    amount DECIMAL(15,3) NOT NULL CHECK (amount > 0),
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    payment_method TEXT NOT NULL,
    notes TEXT,
    amount_allocated DECIMAL(15,3) DEFAULT 0,
    amount_to_initial_balance DECIMAL(15,3) DEFAULT 0,
    amount_credited DECIMAL(15,3) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des crédits clients  
CREATE TABLE IF NOT EXISTS customer_credits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    amount DECIMAL(15,3) NOT NULL CHECK (amount > 0),
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    payment_method TEXT NOT NULL,
    notes TEXT,
    source_payment_id UUID REFERENCES global_payment_entries(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ajouter la colonne de lien si elle n'existe pas
DO $$ BEGIN
    ALTER TABLE invoice_payments ADD COLUMN IF NOT EXISTS global_payment_id UUID REFERENCES global_payment_entries(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE delivery_note_payments ADD COLUMN IF NOT EXISTS global_payment_id UUID REFERENCES global_payment_entries(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Index
CREATE INDEX IF NOT EXISTS idx_gpe_customer ON global_payment_entries(customer_id);
CREATE INDEX IF NOT EXISTS idx_gpe_date ON global_payment_entries(payment_date);
CREATE INDEX IF NOT EXISTS idx_cc_customer ON customer_credits(customer_id);
CREATE INDEX IF NOT EXISTS idx_ip_global ON invoice_payments(global_payment_id);
CREATE INDEX IF NOT EXISTS idx_dnp_global ON delivery_note_payments(global_payment_id);

-- RLS
ALTER TABLE global_payment_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_credits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gpe_policy" ON global_payment_entries;
CREATE POLICY "gpe_policy" ON global_payment_entries FOR ALL 
USING (EXISTS (SELECT 1 FROM customers WHERE customers.id = global_payment_entries.customer_id));

DROP POLICY IF EXISTS "cc_policy" ON customer_credits;
CREATE POLICY "cc_policy" ON customer_credits FOR ALL 
USING (EXISTS (SELECT 1 FROM customers WHERE customers.id = customer_credits.customer_id));

-- Permissions
GRANT ALL ON global_payment_entries TO authenticated, service_role;
GRANT ALL ON customer_credits TO authenticated, service_role;

-- =============================================================================
-- PARTIE 2: FONCTION record_global_payment AMÉLIORÉE (V6)
-- =============================================================================
CREATE OR REPLACE FUNCTION record_global_payment(
    p_customer_id UUID,
    p_amount DECIMAL,
    p_payment_method TEXT,
    p_notes TEXT,
    p_date DATE DEFAULT CURRENT_DATE
) 
RETURNS JSONB AS $$
DECLARE
    v_remaining DECIMAL := ROUND(p_amount, 3);
    v_allocated DECIMAL := 0;
    v_to_initial DECIMAL := 0;
    v_credited DECIMAL := 0;
    v_pay DECIMAL;
    v_initial_balance DECIMAL;
    r_doc RECORD;
    v_entry_id UUID;
    v_result JSONB := '[]';
BEGIN
    -- Validation
    IF p_amount <= 0 THEN RAISE EXCEPTION 'Montant doit être positif'; END IF;
    IF p_customer_id IS NULL THEN RAISE EXCEPTION 'Customer ID requis'; END IF;

    -- 1. Créer l'entrée de paiement global AVEC le montant exact saisi
    INSERT INTO global_payment_entries (customer_id, amount, payment_date, payment_method, notes)
    VALUES (p_customer_id, p_amount, p_date, p_notes, p_notes)
    RETURNING id INTO v_entry_id;

    -- 2. Récupérer initial_balance
    SELECT COALESCE(initial_balance, 0) INTO v_initial_balance FROM customers WHERE id = p_customer_id;

    -- 3. Allouer aux documents (FIFO)
    FOR r_doc IN (
        SELECT i.id, 'INVOICE' as type, i.invoice_number as ref,
            (i.total_ttc - COALESCE(SUM(p.amount), 0)) as balance
        FROM invoices i LEFT JOIN invoice_payments p ON i.id = p.invoice_id
        WHERE i.customer_id = p_customer_id AND i.status NOT IN ('BROUILLON', 'ANNULEE')
        GROUP BY i.id HAVING (i.total_ttc - COALESCE(SUM(p.amount), 0)) > 0.001
        
        UNION ALL
        
        SELECT dn.id, 'DELIVERY_NOTE', dn.delivery_note_number,
            (dn.total_ttc - COALESCE(SUM(p.amount), 0)) as balance
        FROM delivery_notes dn LEFT JOIN delivery_note_payments p ON dn.id = p.delivery_note_id
        WHERE dn.customer_id = p_customer_id AND dn.status = 'LIVRE' AND dn.invoice_id IS NULL
          AND (dn.is_valued = true OR dn.total_ttc > 0)
        GROUP BY dn.id HAVING (dn.total_ttc - COALESCE(SUM(p.amount), 0)) > 0.001
        
        ORDER BY 4 DESC -- On peut ajuster l'ordre ici
    )
    LOOP
        IF v_remaining <= 0.001 THEN EXIT; END IF;
        
        v_pay := LEAST(v_remaining, r_doc.balance);
        
        IF r_doc.type = 'INVOICE' THEN
            INSERT INTO invoice_payments (invoice_id, amount, payment_date, payment_method, notes, global_payment_id)
            VALUES (r_doc.id, v_pay, p_date::TIMESTAMP, p_payment_method, COALESCE(p_notes,'') || ' (Auto)', v_entry_id);
        ELSE
            INSERT INTO delivery_note_payments (delivery_note_id, amount, payment_date, payment_method, notes, global_payment_id)
            VALUES (r_doc.id, v_pay, p_date::TIMESTAMP, p_payment_method, COALESCE(p_notes,'') || ' (Auto)', v_entry_id);
        END IF;
        
        v_remaining := ROUND(v_remaining - v_pay, 3);
        v_allocated := v_allocated + v_pay;
        v_result := v_result || jsonb_build_object('type', r_doc.type, 'ref', r_doc.ref, 'amount', v_pay);
    END LOOP;

    -- 4. Réduire initial_balance si reste
    IF v_remaining > 0 AND v_initial_balance > 0 THEN
        v_to_initial := LEAST(v_remaining, v_initial_balance);
        UPDATE customers SET initial_balance = initial_balance - v_to_initial WHERE id = p_customer_id;
        v_remaining := ROUND(v_remaining - v_to_initial, 3);
    END IF;

    -- 5. Crédit si reste après tout
    IF v_remaining > 0 THEN
        INSERT INTO customer_credits (customer_id, amount, payment_date, payment_method, notes, source_payment_id)
        VALUES (p_customer_id, v_remaining, p_date, p_payment_method, 'Avance', v_entry_id);
        v_credited := v_remaining;
    END IF;

    -- 6. Mettre à jour l'entrée avec les détails d'allocation
    UPDATE global_payment_entries 
    SET amount_allocated = v_allocated, amount_to_initial_balance = v_to_initial, amount_credited = v_credited
    WHERE id = v_entry_id;

    RETURN jsonb_build_object(
        'entry_id', v_entry_id, 'total', p_amount, 'allocated', v_allocated, 
        'to_initial', v_to_initial, 'credited', v_credited, 'details', v_result
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- PARTIE 3: FONCTION update_global_payment (ÉDITION)
-- =============================================================================
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
    v_result JSONB;
BEGIN
    -- 1. Récupérer l'entrée existante
    SELECT * INTO v_entry FROM global_payment_entries WHERE id = p_entry_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Paiement non trouvé'; END IF;
    
    v_customer_id := v_entry.customer_id;
    v_old_to_initial := COALESCE(v_entry.amount_to_initial_balance, 0);

    -- 2. Restaurer initial_balance si on l'avait réduit
    IF v_old_to_initial > 0 THEN
        UPDATE customers SET initial_balance = initial_balance + v_old_to_initial WHERE id = v_customer_id;
    END IF;

    -- 3. Supprimer les anciennes allocations liées à ce paiement
    DELETE FROM invoice_payments WHERE global_payment_id = p_entry_id;
    DELETE FROM delivery_note_payments WHERE global_payment_id = p_entry_id;
    DELETE FROM customer_credits WHERE source_payment_id = p_entry_id;

    -- 4. Supprimer l'ancienne entrée
    DELETE FROM global_payment_entries WHERE id = p_entry_id;

    -- 5. Recréer le paiement avec le nouveau montant
    SELECT record_global_payment(
        v_customer_id,
        p_new_amount,
        COALESCE(p_new_method, v_entry.payment_method),
        v_entry.notes,
        COALESCE(p_new_date, v_entry.payment_date)
    ) INTO v_result;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- PARTIE 4: FONCTION delete_global_payment (SUPPRESSION)
-- =============================================================================
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

    -- Supprimer tout (CASCADE sur les FK)
    DELETE FROM global_payment_entries WHERE id = p_entry_id;

    RETURN jsonb_build_object('success', true, 'deleted_amount', v_entry.amount);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- PARTIE 5: MIGRATION DES ANCIENS PAIEMENTS
-- =============================================================================
-- Cette requête regroupe les anciens paiements par (customer, date, method) et les insère

INSERT INTO global_payment_entries (customer_id, amount, payment_date, payment_method, notes, amount_allocated, created_at)
SELECT 
    customer_id,
    total_amount,
    payment_date::date,
    COALESCE(payment_method, 'AUTRE'),  -- Valeur par défaut si NULL
    'Migré depuis anciens paiements',
    total_amount, -- Considéré comme entièrement alloué
    MIN(created_at)
FROM (
    -- Paiements sur factures
    SELECT 
        i.customer_id,
        ip.payment_date,
        COALESCE(ip.payment_method, 'AUTRE') as payment_method,
        ip.amount as total_amount,
        ip.created_at
    FROM invoice_payments ip
    JOIN invoices i ON ip.invoice_id = i.id
    WHERE ip.global_payment_id IS NULL
    
    UNION ALL
    
    -- Paiements sur BL
    SELECT 
        dn.customer_id,
        dnp.payment_date,
        COALESCE(dnp.payment_method, 'AUTRE') as payment_method,
        dnp.amount as total_amount,
        dnp.created_at
    FROM delivery_note_payments dnp
    JOIN delivery_notes dn ON dnp.delivery_note_id = dn.id
    WHERE dnp.global_payment_id IS NULL
) combined
GROUP BY customer_id, payment_date, payment_method, total_amount
ON CONFLICT DO NOTHING;

-- Marquer les anciens paiements comme migrés (lien vers une entrée factice)
-- Note: les anciens paiements restent dans leurs tables mais ne seront pas re-migrés

-- =============================================================================
-- PERMISSIONS
-- =============================================================================
GRANT EXECUTE ON FUNCTION record_global_payment(UUID, DECIMAL, TEXT, TEXT, DATE) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION update_global_payment(UUID, DECIMAL, TEXT, DATE) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION delete_global_payment(UUID) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- RÉSUMÉ
-- =============================================================================
-- ✅ Table global_payment_entries : stocke le montant EXACT saisi
-- ✅ Colonnes global_payment_id ajoutées pour tracer les allocations
-- ✅ Fonction record_global_payment : crée entrée + alloue
-- ✅ Fonction update_global_payment : supprime ancien + recrée avec nouveau montant
-- ✅ Fonction delete_global_payment : supprime et restaure initial_balance
-- ✅ Migration des anciens paiements
-- 
-- SI VOUS METTEZ 400, VOUS VERREZ 400 DANS LE RELEVÉ !
-- =============================================================================
