-- Create customer_items table for special pricing and subscriptions
CREATE TABLE IF NOT EXISTS customer_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    item_id UUID REFERENCES items(id) ON DELETE CASCADE,
    service_id UUID REFERENCES services(id) ON DELETE CASCADE,
    special_price DECIMAL(10, 3), -- Special price for this customer
    subscription_start_date DATE,
    subscription_renewal_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraint to ensure either product (item) or service is selected, but not both
    CONSTRAINT check_item_reference CHECK (
        (item_id IS NOT NULL AND service_id IS NULL) OR 
        (item_id IS NULL AND service_id IS NOT NULL)
    ),
    
    -- Constraint to ensure unique item per customer to avoid ambiguity
    CONSTRAINT unique_customer_item UNIQUE (customer_id, item_id),
    CONSTRAINT unique_customer_service UNIQUE (customer_id, service_id)
);

-- RLS Policies
ALTER TABLE customer_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view customer items for their companies" ON customer_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM customers 
            WHERE customers.id = customer_items.customer_id 
            AND EXISTS (
                SELECT 1 FROM companies 
                WHERE companies.id = customers.company_id 
                AND companies.user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can insert customer items for their companies" ON customer_items
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM customers 
            WHERE customers.id = customer_items.customer_id 
            AND EXISTS (
                SELECT 1 FROM companies 
                WHERE companies.id = customers.company_id 
                AND companies.user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can update customer items for their companies" ON customer_items
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM customers 
            WHERE customers.id = customer_items.customer_id 
            AND EXISTS (
                SELECT 1 FROM companies 
                WHERE companies.id = customers.company_id 
                AND companies.user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can delete customer items for their companies" ON customer_items
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM customers 
            WHERE customers.id = customer_items.customer_id 
            AND EXISTS (
                SELECT 1 FROM companies 
                WHERE companies.id = customers.company_id 
                AND companies.user_id = auth.uid()
            )
        )
    );
