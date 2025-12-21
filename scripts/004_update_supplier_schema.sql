-- 1. Update supplier_categories table
-- Allow company_id to be NULL for system categories
ALTER TABLE supplier_categories 
ALTER COLUMN company_id DROP NOT NULL;

-- Add parent_id for hierarchy
ALTER TABLE supplier_categories 
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES supplier_categories(id);

-- 2. Update suppliers table
ALTER TABLE suppliers 
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES supplier_categories(id),
ADD COLUMN IF NOT EXISTS subcategory_id UUID REFERENCES supplier_categories(id);

-- 3. Insert System Categories (company_id is NULL)
DO $$
DECLARE
    -- Main Categories
    tech_id UUID;
    telecom_id UUID;
    gen_services_id UUID;
    production_id UUID;
    commerce_id UUID;
    transport_id UUID;
    prof_services_id UUID;
BEGIN
    -- 1. Technologies & IT
    INSERT INTO supplier_categories (name, company_id) VALUES ('Technologies & IT', NULL) RETURNING id INTO tech_id;
    INSERT INTO supplier_categories (name, company_id, parent_id) VALUES 
        ('Matériel Informatique & Hardware', NULL, tech_id),
        ('Logiciels & Licences (SaaS)', NULL, tech_id),
        ('Prestations de services IT', NULL, tech_id),
        ('Réseaux & Sécurité', NULL, tech_id);

    -- 2. Télécoms & Utilitaires
    INSERT INTO supplier_categories (name, company_id) VALUES ('Télécoms & Utilitaires', NULL) RETURNING id INTO telecom_id;
    INSERT INTO supplier_categories (name, company_id, parent_id) VALUES 
        ('Fournisseur d''Accès Internet (FAI)', NULL, telecom_id),
        ('Opérateur Téléphonique', NULL, telecom_id),
        ('Énergie & Eau (Régies)', NULL, telecom_id);

    -- 3. Services Généraux & Administratif
    INSERT INTO supplier_categories (name, company_id) VALUES ('Services Généraux & Administratif', NULL) RETURNING id INTO gen_services_id;
    INSERT INTO supplier_categories (name, company_id, parent_id) VALUES 
        ('Fournitures de Bureau & Papeterie', NULL, gen_services_id),
        ('Mobilier & Agencement', NULL, gen_services_id),
        ('Services de Nettoyage & Hygiène', NULL, gen_services_id),
        ('Sécurité & Gardiennage', NULL, gen_services_id),
        ('Loyers & Syndic', NULL, gen_services_id);

    -- 4. Production & Industrie
    INSERT INTO supplier_categories (name, company_id) VALUES ('Production & Industrie', NULL) RETURNING id INTO production_id;
    INSERT INTO supplier_categories (name, company_id, parent_id) VALUES 
        ('Matières Premières', NULL, production_id),
        ('Produits Semi-finis / Intermédiaires', NULL, production_id),
        ('Emballage & Conditionnement', NULL, production_id),
        ('Machines & Équipements Industriels', NULL, production_id),
        ('Pièces de Rechange (PDR)', NULL, production_id),
        ('Sous-traitance (Façonnage)', NULL, production_id);

    -- 5. Commerce & Distribution
    INSERT INTO supplier_categories (name, company_id) VALUES ('Commerce & Distribution', NULL) RETURNING id INTO commerce_id;
    INSERT INTO supplier_categories (name, company_id, parent_id) VALUES 
        ('Marchandises (Revente en l''état)', NULL, commerce_id),
        ('PLV & Marketing', NULL, commerce_id);

    -- 6. Transport & Logistique
    INSERT INTO supplier_categories (name, company_id) VALUES ('Transport & Logistique', NULL) RETURNING id INTO transport_id;
    INSERT INTO supplier_categories (name, company_id, parent_id) VALUES 
        ('Transporteurs & Messagerie', NULL, transport_id),
        ('Transitaires & Douane', NULL, transport_id),
        ('Fret International', NULL, transport_id),
        ('Carburant & Lubrifiants', NULL, transport_id),
        ('Entretien Parc Auto', NULL, transport_id);

    -- 7. Services Professionnels & Honoraires
    INSERT INTO supplier_categories (name, company_id) VALUES ('Services Professionnels & Honoraires', NULL) RETURNING id INTO prof_services_id;
    INSERT INTO supplier_categories (name, company_id, parent_id) VALUES 
        ('Juridique & Légal', NULL, prof_services_id),
        ('Comptabilité & Audit', NULL, prof_services_id),
        ('Banques & Assurances', NULL, prof_services_id),
        ('Consulting & Formation', NULL, prof_services_id),
        ('Hôtellerie & Restauration', NULL, prof_services_id);
END $$;

-- 4. Update Policies (RLS) to allow viewing system categories
-- Adjust this based on your actual policy names, this is a generic safe approach
DROP POLICY IF EXISTS "Users can view their own categories" ON supplier_categories;
CREATE POLICY "Users can view own and system categories" ON supplier_categories
    FOR SELECT USING (auth.uid() = (SELECT user_id FROM companies WHERE id = company_id) OR company_id IS NULL);
