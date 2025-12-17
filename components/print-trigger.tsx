// Créez ce nouveau fichier : components/print-trigger.tsx

"use client" // Ce composant doit s'exécuter côté client

import { useEffect } from 'react';

export function PrintTrigger() {
  // useEffect avec un tableau de dépendances vide [] ne s'exécute qu'une seule fois,
  // une fois que le composant est "monté" dans le navigateur.
  useEffect(() => {
    // On utilise un petit délai (timeout) de 0 millisecondes.
    // C'est une astuce pour s'assurer que le navigateur a fini de dessiner
    // la page avant de déclencher l'impression.
    const timer = setTimeout(() => {
      window.print();
    }, 0);

    // Nettoyage au cas où le composant serait démonté avant l'impression
    return () => clearTimeout(timer);
  }, []); // Le tableau vide garantit que cela ne s'exécute qu'une fois.

  // Ce composant ne rend rien de visible sur la page.
  return null;
}
