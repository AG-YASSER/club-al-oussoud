<div align="center">
  <img src="public/logo.png" alt="Club Al Oussoud Logo" width="160" />
  <h1>🦁 CLUB AL OUSSOUD</h1>
  <p><strong>Application Mobile PWA de Gestion Moderne pour Salles de Sport & Fitness</strong></p>
  <p><em>Train • Build • Roar — Conçue pour remplacer à 100% les carnets et registres papier des gérants de salle.</em></p>

  <p>
    <img src="https://img.shields.io/badge/React-19.2-blue?logo=react" alt="React" />
    <img src="https://img.shields.io/badge/TypeScript-6.0-blue?logo=typescript" alt="TypeScript" />
    <img src="https://img.shields.io/badge/TailwindCSS-v4-38bdf8?logo=tailwind-css" alt="Tailwind" />
    <img src="https://img.shields.io/badge/PWA-Installable-orange?logo=pwa" alt="PWA" />
    <img src="https://img.shields.io/badge/Offline--First-IndexedDB-emerald" alt="Offline-First" />
    <img src="https://img.shields.io/badge/Vercel-Ready-black?logo=vercel" alt="Vercel Ready" />
  </p>
</div>

---

## 🌟 Aperçu du Projet (Overview)

**Club Al Oussoud** est une application web progressive (**Mobile-First PWA**) ultralégère, fluide et ultra-sécurisée conçue spécialement pour les propriétaires et réceptionnistes de salles de sport au Maroc et dans le monde. Elle remplace définitivement les cahiers manuscrits d'inscription et de pointage par une interface tactile moderne, rapide et autonome.

---

## 🚀 Fonctionnalités Clés (Features)

### 1. 📋 Gestion Intelligente des Membres (CRM Membres)
- **Fiches Adhérents Complètes** : Nom, téléphone, contact d'urgence, formule, date de fin, et photo de profil.
- **Remplacement Intégral du Carnet Papier** : Suivi distinct des membres **Payés** et **Non Payés (Dettes)** avec badge d'alerte.
- **Capture Photo Directe** : Prise de photo en direct via la caméra du smartphone ou import depuis la galerie, avec compression WebP locale.
- **Pointage Rapide en 1 Clic** : Validation instantanée de présence à l'entrée avec animations festives et retour sonore.

### 2. 📞 Communication Directe & Native
- **Appel Téléphonique en 1 Clic** : Bouton direct ouvrant le numéroteur natif du smartphone (`tel:+212...`).
- **Relances WhatsApp Automatisées** : Message de rappel pré-rempli et personnalisé selon le statut (retard de paiement, abonnement expiré, ou échéance imminente) directement sur WhatsApp (`wa.me`).
- **Envoi SMS Hors-Ligne** : Lien de secours via SMS natif (`sms:+212...`).

### 3. 💰 Trésorerie & Statistiques Financières (Finance Tab)
- **Tableau de Bord Visuel** : Revenu mensuel (DH), Total des impayés, et Taux de recouvrement en temps réel.
- **Graphique Interactif Recharts** : Visualisation des encaissements journaliers du mois en cours.
- **Gestion des Dettes** : Liste dédiée des membres ayant des cotisations en attente avec bouton d'encaissement direct.
- **Export Comptable** : Export en 1 clic sous format **Excel / CSV** et relevé officiel imprimable **PDF**.

### 4. 📅 Calendrier d'Échéances & Relances (Calendar Tab)
- Calendrier mensuel 7 colonnes affichant visuellement les jours critiques.
- Puces d'alertes colorées : 🟠 Abonnements arrivant à terme sous 7 jours / 🔴 Cotisations impayées.
- Tiroir d'inspection journalière avec relances WhatsApp directes.

### 5. 🌍 Moteur Multilingue Intégral (i18n)
- **العربية (Arabe)** : Support complet RTL (Right-to-Left) avec devises en Dirham Marocain (**د.م.**).
- **Français** : Interface soignée et terminologie adaptée aux clubs sportifs marocains.
- **English** : Traduction intégrale pour usage international.

### 6. 🔒 Sécurité & Persistance Hors-Ligne (Offline-First)
- **100% Fonctionnel Sans Internet** : Toutes les données sont stockées en local sur le téléphone via **IndexedDB (Dexie.js)**.
- **Centre de Sauvegarde Sécurisé** : Exportation et restauration de copies de sécurité chiffrées en JSON en 1 clic.

---

## 🛠️ Stack Technique

- **Frontend Framework** : React 19 + TypeScript + Vite
- **Design System & UI** : Tailwind CSS v4, Radix UI Primitives, Lucide Icons, Tabler Icons
- **Data Visualization** : Recharts
- **Base de Données Locale** : Dexie.js (IndexedDB)
- **PWA / Service Worker** : `manifest.json` + `sw.js` (Installation native sur Android & iOS)
- **Déploiement** : Vercel (avec en-têtes HTTP sécurisés CSP & X-Frame-Options)

---

## 💻 Installation & Démarrage Local

```bash
# 1. Cloner le dépôt
git clone https://github.com/YOUR_USERNAME/club-al-oussoud.git
cd club-al-oussoud

# 2. Installer les dépendances
npm install

# 3. Lancer le serveur de développement local
npm run dev

# 4. Compiler pour la production
npm run build
```

---

## 📱 Installation sur Smartphone (PWA)

### Android (Google Chrome) :
1. Ouvrez le lien de l'application dans Chrome.
2. Appuyez sur **"Ajouter à l'écran d'accueil"** ou **"Installer l'application"**.
3. L'application s'installe comme une véritable application native avec l'icône du Lion.

### iOS / iPhone (Safari) :
1. Ouvrez le lien dans Safari.
2. Appuyez sur l'icône de partage (carré avec flèche vers le haut).
3. Sélectionnez **"Sur l'écran d'accueil"** puis validez avec **Ajouter**.

---

## 🛡️ Sécurité & Confidentialité

- Aucun cookie de traçage tiers.
- En-têtes de sécurité renforcés configurés dans `vercel.json` (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`).
- Les données des adhérents restent sous la propriété exclusive et locale de la salle de sport.

---

<div align="center">
  <sub>Développé avec passion pour <strong>Club Al Oussoud</strong>. Tous droits réservés © 2026.</sub>
</div>
