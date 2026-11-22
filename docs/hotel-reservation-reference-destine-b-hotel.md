# Référence métier – réservation et reçu d'hébergement (DESTINE B. HOTEL)

**Source :** photo d'un reçu vierge « DESTINE B. HOTEL » fournie par l'utilisateur le 21 novembre 2026. Il s'agit d'un **exemple documentaire à étudier**, et non d'une réservation réelle, ni d'une politique à imposer à tous les hôtels NovaGest.

## 1. En-tête observé sur le document

- Enseigne : **DESTINE B. HOTEL** (la ligne de validation en bas écrit « DESTIN B. HOTEL », graphie légèrement différente).
- Adresse imprimée : **Route village SOS en face J&M, Quartier Morin, Cap-Haïtien**.
- Téléphones imprimés : **(509) 3229-5023 / 5548-2020 / 3389-6429 / 3811-6868**.
- Courriel imprimé : **info.destinehotel@gmail.com**.
- Titre : **Reçu**, avec date.
- Le document comporte un petit logo en haut à gauche. L'enseigne et le logo doivent rester **dynamiques**, selon les paramètres du business courant, et ne jamais être codés en dur sur tous les reçus.

## 2. Champs et libellés présents dans le reçu photographié

| Groupe | Champs vus dans le reçu |
| --- | --- |
| Référence et horaires | Date du reçu ; « Entrée à » ; « Sortie à 10 h 30 AM » |
| Identité | « Reçu de Mr/Mme » ; « Identifié au numéro » ; téléphone du client (2 lignes/numéros possibles) |
| Séjour | nombre de nuits d'hébergement ; date de début « En date du » ; date de fin « Au » ; heure de fin 10 h 30 AM ; chambre ; type « Simple » ou « Double » |
| Prix | « La somme de » ; « Au prix total (chiffre) » ; devise à cocher USD ou HTG ; « Balance » |
| Mode de versement | espèces (« Cash »), chèque (« par chèque »), carte (« sur Carte ») |
| Services | « Petit déjeuner : Oui / Non / Non, cause l'heure » |
| Signatures | signature du client ; signature de l'hôtel |
| Mentions | approbation de la transaction ; « NB. Les versements sont non remboursables » ; formule de remerciement |
| Champs sensibles présents sur le papier | « Tension artérielle » et « Diabétique » |

**Important :** le fait qu'un champ figure sur cet exemple ne signifie pas qu'il doive être obligatoire dans le logiciel, ni public, ni reproduit sur toutes les factures.

## 3. Rapprochement avec le module de réservation NovaGest existant (constaté sur `main`)

Code principal : `app/[business]/hotel/reservations/page.tsx` (frontend), `app/Http/Controllers/Api/HotelReservationController.php` (API).

Déjà géré dans le code :
- chambre, client lié ou nom/téléphone d'invité, check-in/check-out, nombre de voyageurs, prix total, devise USD/HTG, statut ;
- nombre de nuits calculé à partir des dates ;
- code de réservation, contrôle des chevauchements, états du séjour ;
- folio : montants hébergement, suppléments, paiements/acomptes, solde restant ;
- impression d'une facture d'hébergement, avec coordonnées/logo du business, historique des paiements et des signatures de document déjà prévues dans la maquette.

Points à étudier pour coller davantage au reçu **sans dupliquer les fonctionnalités existantes** :
1. Horaire d'arrivée prévu et **horaire de départ personnalisé** au niveau de chaque hôtel ; 10 h 30 est la valeur imprimée sur cet exemple, **pas** une valeur universelle.
2. Afficher clairement le **type de chambre** provenant de la chambre choisie, sans recopier une catégorie indépendante incohérente.
3. Choix **petit déjeuner** : compris / non compris / non pris en raison de l'heure, si cette prestation est activée par le business ; ne pas le rendre globalement obligatoire.
4. Mettre le récapitulatif du **mode de paiement** (espèces, carte, chèque si disponible) en correspondance avec les moyens de paiement effectivement comptabilisés ; ne pas créer un « versement » simplement parce qu'une case est cochée sur un reçu.
5. Inclure le **solde** et les **acomptes** uniquement depuis les écritures réellement enregistrées dans le folio.
6. Offrir une **version imprimable personnalisable** inspirée de cette disposition, avec date d'édition, références, chambre, séjour, montant en chiffres et en lettres, conditions et zone de signatures.
7. Numéro de pièce d'identité : l'associer si nécessaire aux données d'identification du client, avec accès limité, masquage à l'impression par défaut et durée de conservation justifiée.
8. Mention « versements non remboursables » : **paramètre par hôtel**, non règle générale ; vérifier qu'elle correspond aux conditions acceptées par le client et au cadre juridique applicable avant impression.
9. **Tension artérielle / diabétique** : ce sont des **données de santé sensibles**. Ne pas ajouter ces champs par défaut aux réservations, ni aux factures, ni au reporting. Si un besoin opérationnel justifié est démontré, prévoir un parcours distinct avec consentement, restrictions d'accès, sécurisation et durée de rétention appropriée.
10. Pour les signatures, distinguer zone papier d'impression et **signature électronique** (qui demanderait une fonctionnalité et une politique dédiées).

## 4. Principes de développement à respecter

- **Multi-tenant :** toutes les valeurs d'enseigne, conditions, logos, heures et options proviennent du business actif.
- **Aucun changement automatique** dans les contrats, procédures de remboursement, prix et dates existants.
- **Pas de suppression ou réécriture** des commandes, réservations, paiements, folios ni dossiers clients.
- Les champs de réservation et les champs de reçu sont deux concepts différents : le premier décrit un séjour, le second atteste des montants **réellement reçus**.
- Ne jamais stocker une photo de pièce d'identité ou des données médicales dans un texte de facture public.
- Le design de l'accueil, ses quatre photos de background et son slideshow ne sont pas concernés par cette référence.

## 5. Utilisation prévue

Lors de la prochaine évolution du formulaire « Réservations », du folio hôtelier ou du modèle de reçu, consulter **ce document** comme source métier fournie par l'utilisateur. Reprendre les champs utiles, signaler ceux qui existent déjà et valider les paramètres propres à chaque hôtel avant de changer les règles de production.

**Statut :** référence enregistrée ; aucune modification de base de données, contrôleur, formulaire ni mise en production dans ce commit.
