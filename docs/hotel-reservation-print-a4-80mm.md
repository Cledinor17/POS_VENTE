# NovaGest · Fiche de réservation universelle (A4 et 80 mm)

## Portée
Cette évolution ajoute une **fiche de réservation / booking details** aux réservations hôtelières existantes, inspirée du document de référence `docs/hotel-reservation-reference-destine-b-hotel.md`.

Elle ne remplace **pas** la facture détaillée A4, ne touche à aucune réservation, à aucun paiement et ne demande aucune migration.

## Deux formats
- **A4 portrait (210 × 297 mm)** : fiche hôtelière structurée, deux colonnes pour les coordonnées et les informations de séjour, encadré de synthèse, conditions de l'hôtel et deux zones de signatures. Impression classique ou « Enregistrer en PDF » via le navigateur.
- **Ticket thermique 80 mm** : une seule colonne, police de taille lisible, largeur de rouleau 80 mm, petites marges, séparateurs économes en encre. Hauteur calculée depuis le contenu afin de limiter les avances papier excessives. Le pilote d'impression peut imposer ses propres limites : sélectionner une imprimante et un format de papier **80 mm** dans le dialogue d'impression, supprimer les en-têtes/pieds de page du navigateur.

Ouvrir **Hôtel > Réservations**, puis choisir `Format fiche : A4 / Ticket 80 mm` ; l'icône d'impression imprime dans le format sélectionné. La modale « Voir la réservation » propose directement « Fiche A4 », « Ticket 80 mm » et conserve « Facture détaillée A4 ».

## Informations disponibles sur les fiches
- Entête dynamique : identité de **l'hôtel du business**, adresse, téléphone, e-mail, logo de ses paramètres.
- Référence, date d'émission et **statut réel** (en attente, confirmée, client arrivé, etc.).
- Nom et contact du client, code client s'il existe.
- Chambre, numéro, catégorie réelle de la chambre ; dates prévues, nombre de nuits/personnes ; heures réelles d'arrivée et départ si elles sont enregistrées.
- Devise USD/HTG, prix, suppléments ; uniquement si le folio est disponible : versements réels, méthodes, total et solde.
- Informations et conditions depuis le champ existant `invoice_footer`, ou consigne neutre de confirmation auprès de l'hôtel en l'absence de paramètre.
- Signatures du client et de l'hôtel ; ce sont des **espaces pour signature manuscrite**, pas des signatures électroniques.

## Règles de confidentialité et de paiement
- La fiche de réservation n'est **pas** un reçu de paiement. En cas d'échec du chargement du folio, elle imprime « Détail des versements indisponible » et ne simule aucun paiement.
- Aucun numéro de pièce d'identité, photo de document, note interne, tension artérielle ou information sur le diabète n'est imprimé.
- Les règles de remboursement, l'heure de départ (10 h 30 sur l'exemple), le petit déjeuner et le type de paiement sont propres à chaque établissement. **Aucune valeur universelle n'est imposée**. Les mentions légales sont celles configurées dans le business.
- Les noms, textes, logo et conditions issus de l'API sont échappés/filtrés avant d'être placés dans le document HTML.

## Vérification avant production
1. Vérifier `npm test`, ESLint ciblé et `npm run build` sur le commit à déployer.
2. Imprimer une réservation de test en A4 : vérifier police, marge, retour à la ligne, logo, informations et signatures.
3. Avec le pilote réel du ticket thermique, sélectionner **80 mm** et vérifier que les colonnes ne débordent pas, que les pages n'ont pas d'excès de blanc et que la coupe ne masque pas les signatures.
4. Tester une réservation sans folio, avec un acompte et avec deux paiements en devises différentes.
5. Vérifier un business différent : nom/logo/conditions doivent changer.
6. Le diaporama et les photos de la page Accueil ne font partie d'aucun fichier modifié ici.

**Sans accès à l'imprimante du magasin ou de l'hôtel, le dernier réglage du pilote 80 mm doit être testé sur place.**
