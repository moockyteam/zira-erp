-- Global Collections / Account Statement RPCs
-- Note: This page relies on tables created in Invoices, Delivery Notes, and Payments.
-- This script provides the advanced RPCs used by the GlobalCollectionsManager.

-- 1. Get Customer Global Payments (Aggregated View)
/*
CREATE OR REPLACE FUNCTION get_customer_global_payments(p_customer_id UUID)
RETURNS TABLE (
    id UUID,
    amount NUMERIC,
    payment_date DATE,
    payment_method TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    allocations JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        gp.id,
        gp.amount,
        gp.payment_date,
        gp.payment_method,
        gp.notes,
        gp.created_at,
        jsonb_build_object(
            'invoices', (
                SELECT jsonb_agg(jsonb_build_object('invoice_number', inv.invoice_number, 'amount', ip.amount))
                FROM public.invoice_payments ip
                JOIN public.invoices inv ON ip.invoice_id = inv.id
                WHERE ip.global_payment_id = gp.id
            ),
            'bls', (
                SELECT jsonb_agg(jsonb_build_object('delivery_note_number', dn.delivery_note_number, 'amount', dnp.amount))
                FROM public.delivery_note_payments dnp
                JOIN public.delivery_notes dn ON dnp.delivery_note_id = dn.id
                WHERE dnp.global_payment_id = gp.id
            ),
            'credits', (
                SELECT COALESCE(SUM(amount), 0)
                FROM public.customer_credits cc
                WHERE cc.global_payment_id = gp.id
            )
        ) as allocations
    FROM public.global_payments gp
    WHERE gp.customer_id = p_customer_id
    ORDER BY gp.payment_date DESC, gp.created_at DESC;
END;
$$ LANGUAGE plpgsql;
*/

-- 2. Update Global Payment (With Re-allocation)
-- This is a complex function that deletes existing allocations and runs the FIFO again with the new amount.

-- 3. Delete Global Payment
-- Deletes the global payment record and all its associated invoice_payments, delivery_note_payments, and customer_credits.

-- 4. Initial Balance Setup
-- Ensure the customers table has initial_balance and balance_start_date
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='initial_balance') THEN
        ALTER TABLE public.customers ADD COLUMN initial_balance NUMERIC(15, 3) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='balance_start_date') THEN
        ALTER TABLE public.customers ADD COLUMN balance_start_date DATE;
    END IF;
END $$;
