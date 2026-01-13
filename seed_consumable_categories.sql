-- Script to seed consumable and general expense categories
-- Fixed: Helper function defined BEFORE usage.

-- 1. Helper function definition
CREATE OR REPLACE FUNCTION insert_subcategory_if_not_exists(
    p_company_id UUID,
    p_parent_id UUID,
    p_name TEXT
) RETURNS VOID AS $$
BEGIN
    INSERT INTO supplier_categories (name, company_id, parent_id, applicable_item_types)
    SELECT p_name, p_company_id, p_parent_id, NULL
    WHERE NOT EXISTS (
        SELECT 1 FROM supplier_categories 
        WHERE parent_id = p_parent_id AND name = p_name
    );
END;
$$ LANGUAGE plpgsql;

-- 2. Main execution block
DO $$
DECLARE
    v_company_id UUID;
    v_packaging_id UUID := '1a5a7b51-b258-4f03-84fa-41ec0662042f';
    v_energy_id UUID := '4b7376f3-f10e-4912-a532-b6c5d81ca4a1';
    v_vehicle_id UUID := 'c257d087-bb1b-4781-86c2-251f166edbf7';
    v_it_id UUID := '9cdda6b1-17e9-4fb7-bcc1-eb1b350095a1';
    -- Generated UUIDs for new categories (we use gen_random_uuid in insert if needed, or specific variable if we want to reuse)
    -- But since we are Upserting by ID, we need fixed IDs for the NEW ones if we want to be consistent, or just let them generate if not exists.
    -- For this script to be re-runnable, let's look them up or use specific new UUIDs if we wanted hardcoded ones, but user didn't provide specific ones for Office/Hygiene.
    -- We will try to find them by name or insert.
    v_office_id UUID;
    v_hygiene_id UUID;
BEGIN
    -- Get a company ID
    SELECT id INTO v_company_id FROM companies LIMIT 1;
    
    IF v_company_id IS NULL THEN
        RAISE NOTICE 'No company found, skipping seeding.';
        RETURN;
    END IF;

    -- --- PARENT CATEGORIES ---

    -- 1. Emballage (Fixed ID)
    INSERT INTO supplier_categories (id, name, company_id, parent_id, applicable_item_types)
    VALUES (v_packaging_id, 'Emballage & Conditionnement', v_company_id, NULL, NULL)
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

    -- 2. Énergie (Fixed ID)
    INSERT INTO supplier_categories (id, name, company_id, parent_id, applicable_item_types)
    VALUES (v_energy_id, 'Énergie & Eau (Régies)', v_company_id, NULL, NULL)
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

    -- 3. Entretien Parc Auto (Fixed ID)
    INSERT INTO supplier_categories (id, name, company_id, parent_id, applicable_item_types)
    VALUES (v_vehicle_id, 'Entretien Parc Auto', v_company_id, NULL, NULL)
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

    -- 4. Matériel Informatique (Fixed ID)
    INSERT INTO supplier_categories (id, name, company_id, parent_id, applicable_item_types)
    VALUES (v_it_id, 'Matériel Informatique & Hardware', v_company_id, NULL, NULL)
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

    -- 5. Fournitures de Bureau (Lookup or Insert)
    SELECT id INTO v_office_id FROM supplier_categories WHERE name = 'Fournitures de Bureau' AND parent_id IS NULL AND company_id = v_company_id LIMIT 1;
    IF v_office_id IS NULL THEN
        v_office_id := gen_random_uuid();
        INSERT INTO supplier_categories (id, name, company_id, parent_id, applicable_item_types)
        VALUES (v_office_id, 'Fournitures de Bureau', v_company_id, NULL, NULL);
    END IF;

    -- 6. Hygiène & Sécurité (Lookup or Insert)
    SELECT id INTO v_hygiene_id FROM supplier_categories WHERE name = 'Hygiène, Entretien & Sécurité' AND parent_id IS NULL AND company_id = v_company_id LIMIT 1;
    IF v_hygiene_id IS NULL THEN
        v_hygiene_id := gen_random_uuid();
        INSERT INTO supplier_categories (id, name, company_id, parent_id, applicable_item_types)
        VALUES (v_hygiene_id, 'Hygiène, Entretien & Sécurité', v_company_id, NULL, NULL);
    END IF;


    -- --- SUBCATEGORIES ---

    -- Subcats for Emballage
    PERFORM insert_subcategory_if_not_exists(v_company_id, v_packaging_id, 'Cartons & Caisses');
    PERFORM insert_subcategory_if_not_exists(v_company_id, v_packaging_id, 'Films, Adhésifs & Calage');
    PERFORM insert_subcategory_if_not_exists(v_company_id, v_packaging_id, 'Étiquetage & Marquage');
    PERFORM insert_subcategory_if_not_exists(v_company_id, v_packaging_id, 'Palettes & Conteneurs');

    -- Subcats for Energie
    PERFORM insert_subcategory_if_not_exists(v_company_id, v_energy_id, 'Électricité');
    PERFORM insert_subcategory_if_not_exists(v_company_id, v_energy_id, 'Eau & Assainissement');
    PERFORM insert_subcategory_if_not_exists(v_company_id, v_energy_id, 'Gaz & Combustibles');
    PERFORM insert_subcategory_if_not_exists(v_company_id, v_energy_id, 'Carburant GNR');

    -- Subcats for Parc Auto
    PERFORM insert_subcategory_if_not_exists(v_company_id, v_vehicle_id, 'Carburant');
    PERFORM insert_subcategory_if_not_exists(v_company_id, v_vehicle_id, 'Pièces Mécaniques');
    PERFORM insert_subcategory_if_not_exists(v_company_id, v_vehicle_id, 'Pneumatiques');
    PERFORM insert_subcategory_if_not_exists(v_company_id, v_vehicle_id, 'Lubrifiants & Entretien');

    -- Subcats for IT
    PERFORM insert_subcategory_if_not_exists(v_company_id, v_it_id, 'Ordinateurs & Postes de travail');
    PERFORM insert_subcategory_if_not_exists(v_company_id, v_it_id, 'Périphériques & Accessoires');
    PERFORM insert_subcategory_if_not_exists(v_company_id, v_it_id, 'Réseau, Câblage & Serveurs');
    PERFORM insert_subcategory_if_not_exists(v_company_id, v_it_id, 'Composants & Pièces');

    -- Subcats for Office
    PERFORM insert_subcategory_if_not_exists(v_company_id, v_office_id, 'Papeterie');
    PERFORM insert_subcategory_if_not_exists(v_company_id, v_office_id, 'Consommables Impression (Encre/Toner)');
    PERFORM insert_subcategory_if_not_exists(v_company_id, v_office_id, 'Petit Mobilier');

    -- Subcats for Hygiene
    PERFORM insert_subcategory_if_not_exists(v_company_id, v_hygiene_id, 'Produits d''entretien');
    PERFORM insert_subcategory_if_not_exists(v_company_id, v_hygiene_id, 'EPI (Equipements Protection)');
    PERFORM insert_subcategory_if_not_exists(v_company_id, v_hygiene_id, 'Premiers Secours');

END $$;
