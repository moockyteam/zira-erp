-- Vérifier les triggers sur la table PARENTE delivery_notes
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE event_object_table = 'delivery_notes';
