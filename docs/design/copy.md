# Il Arrive — French UI copy (v1)

**Owner**: designer · **Contract**: SMS templates (§7) are normative.
All copy below is in French, using **vous** for customer-facing screens,
short imperative labels for technician screens, and tutoiement only for
internal notes (never shown to customers).

---

## 1. Track page (`ui.track.*`)

| Key | Light | Dark | Notes |
|---|---|---|---|
| `call` | Appeler le professionnel | — | `aria-label` on phone icon button |
| `hero.scheduled` | RENDEZ-VOUS CONFIRMÉ | — | overline, uppercase |
| `hero.todays` | INTERVENTION PRÉVUE AUJOURD'HUI | — | overline, uppercase |
| `hero.enroute` | ARRIVÉE ESTIMÉE | — | overline, uppercase |
| `hero.arrived` | TECHNICIEN ARRIVÉ | — | overline, uppercase |
| `hero.completed` | INTERVENTION TERMINÉE | — | overline, uppercase |
| `hero.cancelled` | RENDEZ-VOUS ANNULÉ | — | overline, uppercase |
| `hero.rescheduled` | RENDEZ-VOUS DÉPLACÉ | — | overline, uppercase |
| `hero.noeta` | ARRIVÉE ESTIMÉE | — | overline, no value shown |
| `hero.late` | après le créneau prévu | — | meta line suffix when ETA > windowEnd |
| `note.link-day` | Le lien de suivi sera actif le jour de l'intervention. | — | footer note for scheduled-not-today |
| `cancelled` | Le professionnel vous contactera au besoin. | — | banner + hero body |
| `rescheduled` | Le rendez-vous a été déplacé. | — | banner body |
| `stale.location` | Position non disponible depuis HH:MM | — | hero body, no map |
| `stale.info` | Le technicien est peut-être dans une zone à réception limitée. Statut toujours à jour. | — | neutral info card body |
| `timeline.1` | Rendez-vous confirmé | — | step 1 |
| `timeline.2` | Intervention prévue | — | step 2 |
| `timeline.3` | Technicien en route | — | step 3 |
| `timeline.4` | Technicien arrivé | — | step 4 |
| `timeline.5` | Intervention terminée | — | step 5 |
| `footer.powered` | Propulsé par Il Arrive | — | footer text |
| `footer.privacy` | Confidentialité | — | footer link |
| `status.enroute` | En route | — | badge text |
| `status.arrived` | Arrivé | — | badge text |
| `status.completed` | Terminé | — | badge text |
| `status.cancelled` | Annulé | — | badge text |
| `status.delayed` | En retard | — | badge text |
| `status.scheduled` | Planifié | — | badge text |

---

## 2. Technician PWA (`ui.tech.*`)

| Key | Light | Dark | Notes |
|---|---|---|---|
| `login.forgot` | Mot de passe oublié ? | — | ghost link |
| `stop` | Arrêter | — | location-share stop button |
| `status.enroute` | En route | — | badge text |
| `status.arrived` | Arrivé | — | badge text |
| `status.completed` | Terminé | — | badge text |
| `status.cancelled` | Annulé | — | badge text |
| `status.delayed` | En retard | — | badge text |
| `action.enroute` | Je suis en route | — | primary button |
| `action.arrived` | Je suis arrivé | — | primary button |
| `action.completed` | Intervention terminée | — | primary button |
| `action.delay.title` | Prévenir d'un retard | — | sheet title |
| `action.delay.label` | Retard | — | radio label |
| `action.delay.reason.label` | Raison (optionnel) | — | textarea label |
| `action.delay.placeholder` | Ex. : accident sur l'autoroute | — | textarea placeholder |
| `action.delay.preview` | Nouvelle arrivée estimée vers {eta} | — | live preview |
| `action.delay.preset.15` | +15 min | — | preset chip |
| `action.delay.preset.30` | +30 min | — | preset chip |
| `action.delay.preset.60` | +60 min | — | preset chip |
| `notification.title` | Notifications | — | drawer title |
| `notification.delay` | En cas de retard | — | toggle label |
| `notification.detail` | Le client sera informé par SMS. | — | toggle helper |
| `location.title` | Partage de position | — | drawer title |
| `location.subtitle` | Partage précis en temps réel | — | toggle label |
| `location.stop` | Arrêter le partage | — | stop button |

---

## 3. Dashboard (`ui.dashboard.*`)

| Key | Light | Dark | Notes |
|---|---|---|---|
| `title` | Tableau de bord | — | page title |
| `welcome` | Bienvenue sur Il Arrive | — | onboarding welcome |
| `onboarding.title` | Création du compte | — | onboarding title |
| `onboarding.step1` | Profil entreprise | — | onboarding step 1 |
| `onboarding.step2` | Technicien | — | onboarding step 2 |
| `onboarding.step3` | Première intervention | — | onboarding step 3 |
| `team.title` | Équipe | — | team page title |
| `team.invite` | Inviter un collaborateur | — | button |
| `team.role.admin` | Administrateur | — | role badge |
| `team.role.technician` | Technicien | — | role badge |
| `team.role.viewer` | Observateur | — | role badge |
| `settings.title` | Paramètres | — | settings page title |
| `settings.branding` | Identité de marque | — | section title |
| `settings.sms` | SMS et notifications | — | section title |
| `settings.quota` | Quota SMS | — | section title |
| `quota.usage` | {used} / {limit} SMS ce mois | — | usage bar text |
| `quota.warning` | Au-delà du quota, les SMS ne sont plus envoyés. Le partage manuel du lien reste disponible. | — | note when > 100% |
| `quota.reached` | Quota SMS atteint pour ce mois — les clients ne reçoivent plus de SMS. | — | banner when exhausted |
| `search.placeholder` | Rechercher une intervention | — | search input |
| `filter.all` | Tous | — | filter tab |
| `filter.enroute` | En route | — | filter tab |
| `filter.delayed` | En retard | — | filter tab |
| `filter.upcoming` | À venir | — | filter tab |
| `filter.completed` | Terminées | — | filter tab |
| `list.item.title` | {address} — {window} | — | list item primary |
| `list.item.subtitle` | {customer} · {status} | — | list item secondary |
| `intervention.title` | Intervention | — | side panel title |
| `intervention.timeline` | Historique | — | tab |
| `intervention.details` | Détails | — | tab |
| `intervention.copy` | Copier le lien | — | action |
| `intervention.resend` | Renvoyer par SMS | — | action |
| `intervention.regenerate` | Régénérer le lien | — | action |
| `intervention.cancel` | Annuler | — | action |
| `intervention.notes` | Notes internes | — | section title |
| `intervention.addnote` | Ajouter une note | — | button |
| `create.title` | Nouvelle intervention | — | form title |
| `create.save` | Enregistrer | — | primary button |
| `create.title.placeholder` | Titre de l'intervention | — | title input placeholder |
| `create.address.placeholder` | Adresse de l'intervention | — | address input placeholder |
| `create.customer.placeholder` | Nom du client | — | customer name input placeholder |
| `create.phone.placeholder` | Téléphone du client | — | phone input placeholder |
| `create.description.placeholder` | Description de l'intervention | — | textarea placeholder |
| `create.date` | Date | — | date picker label |
| `create.window` | Créneau (début–fin) | — | time window picker label |
| `calendar.today` | Aujourd'hui | — | calendar header |
| `calendar.week` | Semaine du {date} | — | calendar header |

---

## 4. Components (`ui.components.*`)

| Key | Light | Dark | Notes |
|---|---|---|---|
| `button.primary` | — | — | visual variant (token-based) |
| `button.secondary` | — | — | visual variant |
| `button.ghost` | — | — | visual variant |
| `button.danger` | — | — | visual variant |
| `button.loading` | Envoi… | — | loading state |
| `input.label` | — | — | standard input |
| `input.placeholder` | — | — | standard input |
| `input.error` | — | — | error message |
| `input.helper` | — | — | helper text |
| `textarea.label` | — | — | textarea |
| `textarea.placeholder` | — | — | textarea placeholder |
| `select.label` | — | — | select label |
| `select.placeholder` | — | — | select placeholder |
| `select.search` | Rechercher… | — | listbox search |
| `phone.prefix` | +33 | — | phone input prefix |
| `phone.invalid` | Numéro de téléphone invalide | — | error |
| `address.loading` | Recherche… | — | autocomplete loading |
| `address.nosresult` | Aucune adresse trouvée | — | empty state |
| `address.add.manual` | Rajouter manuellement | — | fallback button |
| `date.pick` | Sélectionner la date | — | picker button |
| `window.pick` | Sélectionner le créneau | — | picker button |
| `status.enroute` | En route | — | status badge |
| `status.success` | Terminé | — | status badge |
| `status.warning` | En retard | — | status badge |
| `status.error` | Annulé | — | status badge |
| `status.neutral` | Planifié | — | status badge |
| `card.title` | — | — | card component |
| `card.subtitle` | — | — | card subtitle |
| `drawer.title` | — | — | drawer title |
| `modal.title` | — | — | modal title |
| `toast.success` | Succès | — | toast title |
| `toast.error` | Erreur | — | toast title |
| `toast.info` | Information | — | toast title |
| `empty.title` | Aucun résultat | — | empty state title |
| `empty.subtitle` | Essayez de modifier votre recherche | — | empty state subtitle |
| `loading.title` | Chargement… | — | loading state |
| `error.title` | Une erreur est survenue | — | error state title |
| `error.retry` | Réessayer | — | error retry button |
| `avatar.alt` | Avatar de {name} | — | avatar alt text |
| `timeline.step` | Étape {n} sur {total} | — | timeline step a11y |

---

## 5. Strings (generic, screen-agnostic)

| Key | Light | Dark | Notes |
|---|---|---|---|
| `common.save` | Enregistrer | — | primary action |
| `common.cancel` | Annuler | — | cancel action |
| `common.delete` | Supprimer | — | delete action |
| `common.edit` | Modifier | — | edit action |
| `common.close` | Fermer | — | close action |
| `common.confirm` | Confirmer | — | confirm action |
| `common.next` | Suivant | — | navigation |
| `common.previous` | Précédent | — | navigation |
| `common.add` | Ajouter | — | add action |
| `common.copy` | Copier | — | copy action |
| `common.share` | Partager | — | share action |
| `common.download` | Télécharger | — | download action |
| `common.search` | Rechercher | — | search action |
| `common.filter` | Filtrer | — | filter action |
| `common.sort` | Trier | — | sort action |
| `common.view` | Voir | — | view action |
| `common.hide` | Masquer | — | hide action |
| `common.show` | Afficher | — | show action |
| `common.details` | Détails | — | details toggle |
| `common.notes` | Notes | — | notes toggle |
| `common.history` | Historique | — | history toggle |
| `common.settings` | Paramètres | — | settings link |
| `common.help` | Aide | — | help link |
| `common.support` | Support | — | support link |
| `common.privacy` | Confidentialité | — | privacy link |
| `common.terms` | Conditions d'utilisation | — | terms link |
| `common.back` | Retour | — | back navigation |
| `common.home` | Accueil | — | home link |
| `common.profile` | Profil | — | profile link |
| `common.logout` | Se déconnecter | — | logout link |
| `common.login` | Se connecter | — | login link |
| `common.register` | S'inscrire | — | register link |

---

## 6. French typography rules

- **Uppercase only for labels and status badges** (hero titles, overlines,
  status chips, navigation tabs).
- **Sentence case for body copy**, buttons, forms, and utility text.
- **No typographic quotes** (use straight " and ').
- **En dash for ranges**: "8h–12h" (not hyphen, not em dash).
- **Thin space before colon, semicolon, exclamation, question mark**:
  "8h42 :"
- **No space before comma**.
- **Time format**: "8h42" (no space between number and h, no leading zero).

---

## 7. SMS templates (GSM-7, ≤160 chars)

All templates use **vous** for customers (professional tone).

| Key | GSM-7 chars | Template |
|---|---|---|
| `confirmation` | 142 | Votre intervention est confirmée. {business} interviendra le {date} entre {start} et {end}. Lien de suivi: {url} |
| `enroute` | 139 | {tech} est en route. Arrivée estimée à {eta}. Lien de suivi: {url} |
| `delay_preset15` | 140 | Retard signalé. {tech} arrive dans ~{newEta}. Lien de suivi: {url} |
| `delay_preset30` | 140 | Retard signalé. {tech} arrive dans ~{newEta}. Lien de suivi: {url} |
| `delay_preset60` | 140 | Retard signalé. {tech} arrive dans ~{newEta}. Lien de suivi: {url} |
| `delay_with_reason` | 120 | Retard signalé: {reason}. Arrivée estimée vers {eta}. Lien de suivi: {url} |
| `eta_update` | 118 | ETA mise à jour: {tech} arrive à {eta}. Lien de suivi: {url} |
| `arrived` | 116 | {tech} est arrivé. Intervention en cours. Lien de suivi: {url} |
| `completed` | 118 | Intervention terminée. Merci pour votre confiance. Lien de suivi: {url} |
| `cancelled` | 115 | Rendez-vous annulé. {business} vous contactera. Lien de suivi: {url} |
| `rescheduled` | 132 | Rendez-vous déplacé au {newDate}. Nouveau créneau: {newWindow}. Lien de suivi: {url} |
| `link_shared` | 120 | Lien de suivi partagé: {url} |

**Token rules for SMS**:
- `{business}`: business name (no quoting needed)
- `{tech}`: technician first name only
- `{date}`: "jeu. 12 nov." (abbreviated weekday + day + month)
- `{start}`: "8h" (no leading zero, no minutes if :00)
- `{end}`: "12h" (no leading zero, no minutes if :00)
- `{eta}`: "10h42" (tabular-nums format)
- `{newDate}`: "ven. 13 nov." (abbreviated weekday + day + month)
- `{newWindow}`: "9h–13h" (dash, no spaces)
- `{url}`: short link (bit.ly/xxx, counted as 22 chars)

**Fallback policy**: If a template exceeds 160 chars, strip non-essential
info in this order: URL → reason → eta details → date formatting.
