-- Remediation script to force visibility and top-level status for requested categories
-- Previously, ON CONFLICT did not update parent_id or applicable_item_types, so they remained hidden or nested.

DO $$
DECLARE
    v_packaging_id UUID := '1a5a7b51-b258-4f03-84fa-41ec0662042f';
    v_energy_id UUID := '4b7376f3-f10e-4912-a532-b6c5d81ca4a1';
    v_vehicle_id UUID := 'c257d087-bb1b-4781-86c2-251f166edbf7';
    v_it_id UUID := '9cdda6b1-17e9-4fb7-bcc1-eb1b350095a1';
BEGIN
    -- 1. Emballage & Conditionnement
    -- Move to Top Level (parent_id = NULL) and show for all types (applicable_item_types = NULL)
    UPDATE supplier_categories 
    SET parent_id = NULL, applicable_item_types = NULL, name = 'Emballage & Conditionnement'
    WHERE id = v_packaging_id;

    -- 2. Énergie & Eau (Régies)
    UPDATE supplier_categories 
    SET parent_id = NULL, applicable_item_types = NULL, name = 'Énergie & Eau (Régies)'
    WHERE id = v_energy_id;

    -- 3. Entretien Parc Auto
    UPDATE supplier_categories 
    SET parent_id = NULL, applicable_item_types = NULL, name = 'Entretien Parc Auto'
    WHERE id = v_vehicle_id;

    -- 4. Matériel Informatique & Hardware
    UPDATE supplier_categories 
    SET parent_id = NULL, applicable_item_types = NULL, name = 'Matériel Informatique & Hardware'
    WHERE id = v_it_id;

    -- 5. Ensure "Fournitures de Bureau" is visible (it seemed okay in log, but ensuring)
    UPDATE supplier_categories 
    SET applicable_item_types = NULL 
    WHERE name = 'Fournitures de Bureau' AND parent_id IS NULL;

    -- 6. Ensure "Hygiène, Entretien & Sécurité" is visible
    UPDATE supplier_categories 
    SET applicable_item_types = NULL 
    WHERE name = 'Hygiène, Entretien & Sécurité' AND parent_id IS NULL;

END $$;
