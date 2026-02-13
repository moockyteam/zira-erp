# Guide: Authentification & Profils Utilisateurs

Ce guide explique comment est gérée l'identité des utilisateurs et comment configurer la table des profils dans Supabase.

## 1. Vue d'ensemble

L'ERP utilise Supabase Auth pour l'authentification. Cependant, pour stocker des informations supplémentaires (nom complet, avatar, rôle) et pouvoir faire des jointures SQL, nous utilisons une table `public.profiles` qui étend `auth.users`.

## 2. Structure Technique

- **Sync Automatique** : Un trigger PostgreSQL est configuré pour créer automatiquement une entrée dans `public.profiles` dès qu'un nouvel utilisateur confirme son inscription.
- **Métadonnées** : Les informations saisies lors de l'inscription (ex: `full_name`) sont récupérées depuis les métadonnées de l'utilisateur (`raw_user_meta_data`).

## 3. Pré-requis Base de Données

Exécutez le script `scripts/setup_profiles_table.sql` pour :
1.  Créer la table `public.profiles`.
2.  Activer la sécurité (RLS) : un utilisateur ne peut modifier que son propre profil.
3.  Installer la fonction trigger `handle_new_user()`.
4.  Activer le trigger sur la table `auth.users`.

## 4. Intégration Code

- **Inscription** : Le composant `SignupForm` (`components/signup-form.tsx`) envoie le nom complet dans l'option `data` de `signUp`.
- **Récupération** : Vous pouvez récupérer le profil de l'utilisateur courant via :
  ```sql
  select * from public.profiles where id = auth.uid();
  ```

## 5. Pourquoi cette table est-elle nécessaire ?

- **Jointures** : Permet de lier des factures ou des actions à un nom d'utilisateur lisible plutôt qu'à un UUID.
- **Flexibilité** : Vous pouvez ajouter des colonnes comme `telephone`, `prefered_language`, ou `specialization` sans toucher au système d'auth de Supabase.
- **Sécurité** : La table `auth.users` est protégée par Supabase. En ayant une table `public`, vous contrôlez totalement qui peut voir quoi via les politiques RLS.
