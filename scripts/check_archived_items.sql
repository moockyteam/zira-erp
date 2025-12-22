-- Vérifier s'il reste des articles archivés
-- Le résultat doit être 0 si la suppression a fonctionné.

SELECT count(*) as nombre_articles_archives
FROM items
WHERE is_archived = true;
