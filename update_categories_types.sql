-- Add applicable_item_types column to supplier_categories
ALTER TABLE supplier_categories 
ADD COLUMN IF NOT EXISTS applicable_item_types item_type_enum[];

-- Helper function to simpler update
DO $$
BEGIN
    -- 1. COMMERCE & DISTRIBUTION (Products)
    UPDATE supplier_categories 
    SET applicable_item_types = ARRAY['product'::item_type_enum]
    WHERE name IN ('Commerce & Distribution', 'Marchandise', 'Marchandises (Revente en l''état)', 'PLV & Marketing');

    -- 2. PRODUCTION & INDUSTRIE (Raw Materials & Semi-Finished)
    -- Parent can be both
    UPDATE supplier_categories 
    SET applicable_item_types = ARRAY['raw_material'::item_type_enum, 'semi_finished'::item_type_enum]
    WHERE name = 'Production & Industrie';

    -- Children
    UPDATE supplier_categories 
    SET applicable_item_types = ARRAY['raw_material'::item_type_enum]
    WHERE name IN ('Matières Premières', 'Emballage & Conditionnement', 'Pièces de Rechange (PDR)');

    UPDATE supplier_categories 
    SET applicable_item_types = ARRAY['semi_finished'::item_type_enum]
    WHERE name IN ('Produits Semi-finis / Intermédiaires', 'Sous-traitance (Façonnage)');

    UPDATE supplier_categories 
    SET applicable_item_types = ARRAY['asset'::item_type_enum]
    WHERE name IN ('Machines & Équipements Industriels');

    -- 3. ASSETS (Immobilisations) & CONSOMMABLES
    UPDATE supplier_categories 
    SET applicable_item_types = ARRAY['asset'::item_type_enum]
    WHERE name IN ('Mobilier & Agencement', 'Matériel Informatique', 'Matériel Informatique & Hardware', 'Équipement de Bureau', 'Véhicules', 'Entretien Parc Auto');

    UPDATE supplier_categories 
    SET applicable_item_types = ARRAY['consumable'::item_type_enum]
    WHERE name IN ('Fournitures de Bureau & Papeterie', 'Carburant & Lubrifiants', 'Services de Nettoyage & Hygiène', 'Consommables divers');

    -- 4. SERVICES (Hide from Stock by leaving NULL or explicitly setting empty if needed, but NULL is safer for now as "Generic")
    -- We'll leave them NULL for now, and in the UI we will show categories that match the type OR are NULL if we want fallback,
    -- BUT the requirement is to show "only good categories". 
    -- So we will filter strictly: applicable_item_types @> ARRAY[current_type]
    -- Categories with NULL will be hidden from the specific item type views, which is correct for Services.

END $$;
