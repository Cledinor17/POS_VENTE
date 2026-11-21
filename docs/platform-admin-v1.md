# NovaGest — Super Admin, contrôle des entreprises

## Périmètre
Cette extension ajoute une administration globale **séparée** des rôles `owner` et `admin` propres aux entreprises. Aucun accès POS, aucune usurpation de compte et aucun transfert de propriété ne sont accordés automatiquement à l'administrateur de plateforme.

Interface : `/platform/dashboard` (connexion normale puis redirection de l'administrateur).

API protégée par `auth:sanctum`, `platformAdmin` et limitation de débit :
- `GET /api/platform/summary` : volumes et statuts globaux, sans données financières.
- `GET /api/platform/businesses?search=&status=&page=` : annuaire paginé, propriétaires et compteurs.
- `GET /api/platform/businesses/{id}` : détails administratifs.
- `PATCH /api/platform/businesses/{id}` : champs administratifs autorisés uniquement ; pas de `slug`, `status`, mot de passe, propriétaire ni écritures comptables.
- `POST /api/platform/businesses/{id}/suspend` et `/reactivate` : motif obligatoire, état et horodatage, erreur 409 en cas de doublon.
- `GET /api/platform/businesses/{id}/events` : historique serveur des modifications.

La suspension place `businesses.status = suspended`. Les requêtes `/api/app/{business}/…` de membres pourtant authentifiés reçoivent HTTP **423**. Cela bloque la vente, la modification du stock, les exports, les rapports et la restauration ; les données ne sont pas effacées. Les ventes enregistrées hors ligne avant la suspension ne peuvent plus se synchroniser tant que le business reste suspendu : **les réconcilier lors de la réactivation**, sans ignorer l'erreur.

Les contrôles de plateforme s'exécutent hors du contexte `SetBusiness` afin de ne pas contourner les règles d'isolation des données du POS.

## Mise en production VPS — après sauvegarde de l'API et de la base
1. Vérifier que le backend et le frontend sont compatibles ; ne pas déployer une seule moitié en production.
2. Sauvegarder intégralement la base MariaDB et conserver un point de restauration, ainsi que la version actuelle du code.
3. Déployer le backend et exécuter `php artisan migrate --force` depuis son répertoire, puis `php artisan config:cache`. La migration conserve tous les tenants actifs ; elle ajoute `suspended_at`, `suspended_by`, `suspension_reason` et la table `platform_business_events`.
4. Déployer le frontend Next.js avec sa variable `NEXT_PUBLIC_API_BASE_URL`, puis lancer `npm ci`, `npm run build` et le redémarrage contrôlé du processus PM2.
5. Sur le VPS, attribuer le privilège à **un compte existant avec email vérifié** : `php artisan platform:admin adresse@domaine.tld`. La révocation s'effectue avec `--revoke`. N'ajoutez jamais ce privilège depuis une inscription publique ni via le rôle `owner`.
6. Tester avec un business de démonstration : login Super Admin, liste, modification administrative, suspension, HTTP 423 sur POS, audit, réactivation et réouverture du POS. Contrôler le comportement de la file de ventes hors ligne.
7. Prévoir un accès « break-glass » au VPS pour récupérer une entreprise suspendue accidentellement. Ne pas faire de rollback destructif de la migration après avoir collecté des événements réels.

### Conditions techniques
- L'utilisateur qui exécute PHP-FPM doit pouvoir écrire dans `storage/framework/business-locks`. La suspension utilise le même verrou exclusif que la sauvegarde/restauration pour éviter des modifications concurrentes sur **un VPS unique**. Pour plusieurs nœuds, migrer vers un verrou distribué avant de les utiliser.
- Le frontend local/PWA n'est pas une autorité de sécurité. Un poste hors ligne peut conserver des tickets en attente ; le serveur valide leur autorisation au retour du réseau.
- Ne pas exposer les routes plateforme par une configuration Nginx publique sans le middleware Sanctum. Activer HTTPS et une MFA administrateur avant une ouverture commerciale à grande échelle.
- Le diaporama de photos sur Accueil et ses images `public/images/landing` sont inchangés.
