DO $$
DECLARE
    r_company RECORD;
    parent_cat_id UUID;
    sub_cat_id UUID;
BEGIN
    -- This script iterates through all companies that have items and standardizes their category structure.
    -- It ensures "Commerce & Distribution" > "Marchandise" exists for EACH company separately.

    FOR r_company IN SELECT DISTINCT company_id FROM items WHERE company_id IS NOT NULL
    LOOP
        RAISE NOTICE 'Processing Company: %', r_company.company_id;

        -- 1. Get or Create Parent Category "Commerce & Distribution" for THIS company
        SELECT id INTO parent_cat_id FROM supplier_categories 
        WHERE name = 'Commerce & Distribution' 
          AND company_id = r_company.company_id 
          AND parent_id IS NULL 
        LIMIT 1;

        IF parent_cat_id IS NULL THEN
            INSERT INTO supplier_categories (name, company_id, parent_id) 
            VALUES ('Commerce & Distribution', r_company.company_id, NULL) 
            RETURNING id INTO parent_cat_id;
            RAISE NOTICE '  -> Created Parent: Commerce & Distribution';
        ELSE
             RAISE NOTICE '  -> Found Parent: Commerce & Distribution';
        END IF;

        -- 2. Get or Create Subcategory "Marchandise" linked to the Parent
        SELECT id INTO sub_cat_id FROM supplier_categories 
        WHERE name = 'Marchandise' 
          AND company_id = r_company.company_id 
          AND parent_id = parent_cat_id 
        LIMIT 1;

        IF sub_cat_id IS NULL THEN
            INSERT INTO supplier_categories (name, company_id, parent_id) 
            VALUES ('Marchandise', r_company.company_id, parent_cat_id) 
            RETURNING id INTO sub_cat_id;
            RAISE NOTICE '  -> Created Subcategory: Marchandise';
        ELSE
            RAISE NOTICE '  -> Found Subcategory: Marchandise';
        END IF;

        -- 3. Update ALL Items for this company to use this Category and Subcategory
        UPDATE items 
        SET 
            category_id = parent_cat_id,
            subcategory_id = sub_cat_id
        WHERE 
            company_id = r_company.company_id 
            AND (category_id IS DISTINCT FROM parent_cat_id OR subcategory_id IS DISTINCT FROM sub_cat_id);
            
        RAISE NOTICE '  -> Updated items to standard category.';

    END LOOP;
END $$;
