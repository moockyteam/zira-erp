    -- Script to Cancel/Delete Global Payments (cleanup test data)

    -- 1. Delete from Invoice Payments
    -- Matches payments created by the auto-allocation logic
    DELETE FROM invoice_payments 
    WHERE notes LIKE '%(Alloc. Auto)%';

    -- 2. Delete from Delivery Note Payments
    -- Matches payments created by the auto-allocation logic
    DELETE FROM delivery_note_payments 
    WHERE notes LIKE '%(Alloc. Auto)%';

    -- Note: The existing triggers on these tables will automatically fire 
    -- and recalculate the customer balances (restoring the debt).
