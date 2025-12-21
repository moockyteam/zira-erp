-- Migration: Create Services Module

-- 1. Create Service Categories Table
CREATE TABLE IF NOT EXISTS service_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id), -- If NULL, it's a system category
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    parent_id UUID REFERENCES service_categories(id)
);

-- 2. Create Services Table
CREATE TYPE billing_type AS ENUM ('fixed', 'hourly', 'daily', 'subscription');
CREATE TYPE service_status AS ENUM ('active', 'archived');

CREATE TABLE IF NOT EXISTS services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id),
    category_id UUID REFERENCES service_categories(id),
    
    -- Identification
    name TEXT NOT NULL,
    sku TEXT, -- Code/Référence
    short_description TEXT,
    detailed_description TEXT,
    image_url TEXT,
    
    -- Pricing (Tarification)
    billing_type billing_type DEFAULT 'fixed',
    price NUMERIC DEFAULT 0,
    currency TEXT DEFAULT 'EUR', -- Or TND based on locale, keeping flexible
    vat_rate NUMERIC DEFAULT 20.0,
    unit TEXT, -- e.g., 'Hour', 'Day', 'Month', 'Project'
    
    -- Profitability (Rentabilité)
    cost_price NUMERIC DEFAULT 0, -- Coût de revient
    estimated_duration NUMERIC, -- In hours
    
    -- Configuration (Avancé)
    status service_status DEFAULT 'active',
    resource_requirements TEXT,
    is_bundle BOOLEAN DEFAULT FALSE,
    bundle_configuration JSONB DEFAULT '{}', -- Stores components of the bundle
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. RLS Policies

-- Enable RLS
ALTER TABLE service_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;

-- Policies for service_categories
CREATE POLICY "Users can view own and system service categories" ON service_categories
    FOR SELECT USING (auth.uid() = (SELECT user_id FROM companies WHERE id = company_id) OR company_id IS NULL);

CREATE POLICY "Users can manage their own service categories" ON service_categories
    FOR ALL USING (auth.uid() = (SELECT user_id FROM companies WHERE id = company_id));

-- Policies for services
CREATE POLICY "Users can manage their own services" ON services
    FOR ALL USING (auth.uid() = (SELECT user_id FROM companies WHERE id = company_id));

-- 4. Insert some Default System Categories for Services
INSERT INTO service_categories (name, company_id) VALUES 
    ('Conseil & Audit', NULL),
    ('Développement & IT', NULL),
    ('Maintenance & Support', NULL),
    ('Formation & Coaching', NULL),
    ('Design & Création', NULL),
    ('Juridique & Administratif', NULL);
