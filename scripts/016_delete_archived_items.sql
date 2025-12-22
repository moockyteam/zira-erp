-- Supprimer les articles qui sont archivés (soft delete)
-- Attention : Cette opération est irréversible et supprimera définitivement les articles marqués comme archivés.

DELETE FROM items
WHERE is_archived = true;
