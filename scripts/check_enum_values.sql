-- Vérifier les valeurs de l'enum movement_type
SELECT e.enumlabel
FROM pg_enum e
JOIN pg_type t ON e.enumtypid = t.oid
WHERE t.typname = 'movement_type';

-- Alternative: Verifier les contraintes de check si ce n'est pas un enum
SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_name LIKE '%movement_type%';
