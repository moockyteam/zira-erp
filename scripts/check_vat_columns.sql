
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'items' AND column_name LIKE '%va%';

SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'services' AND column_name LIKE '%va%';
