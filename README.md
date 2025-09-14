# Jira Manager Pro

Jira Manager Pro est une application web full-stack conçue pour simplifier et optimiser la gestion des tickets Jira. Elle offre une interface utilisateur moderne et intuitive développée en React, qui communique avec une API backend robuste construite avec Flask. Ce projet a été réalisé dans le cadre de mon stage d'été à **Primatec Engineering**.

---

## 🚀 Fonctionnalités Clés  

* **Gestion des Tickets (CRUD) :** Créez, lisez, mettez à jour et supprimez des tickets avec une interface simplifiée.  
* **Recherche et Filtrage Avancé :** Filtrez les tickets en temps réel par assigné, statut, type et mot-clé pour une navigation efficace.  
* **Transitions de Statut :** Changez l'état d'un ticket via une modale interactive qui affiche uniquement les transitions possibles, simplifiant ainsi le workflow.  
* **Gestion des Erreurs :** Validation en temps réel, messages d'erreur contextuels et mécanismes de récupération en cas d'échec de l'API.  
* **Expérience Utilisateur Optimale :** Une interface rapide, réactive et intuitive pour une productivité accrue.  
* **📊 Tableau de Bord Analytique :** Visualisez les métriques clés des tickets grâce à des **graphiques interactifs** et des **insights actionnables** :  
  - Volume de tickets créés par semaine (tendance et pics d’activité).  
  - Distribution par priorité (High, Medium, Low…).  
  - Distribution par type (Bug, Task, Story…).  
  - Répartition par assignation (charge de travail des membres).  
  - Temps moyen de résolution des tickets.  
  - Panneau d’**insights dynamiques** pour détecter tendances et points critiques.  

---

## 🛠️ Stack Technique

### Frontend
* **React.js :** Bibliothèque pour l'interface utilisateur. Utilisation intensive des Hooks (`useState`, `useEffect`, `useCallback`) pour une logique de composant performante.
* **CSS :** Stylisation de l'application avec des styles modulaires pour une meilleure maintenabilité.
* **Recharts & Visualisations personnalisées :** Création de graphiques (barres, donuts, KPI cards).  

### Backend (API REST)
* **Python (avec Flask) :** Micro-framework pour le serveur de l'API.
* **Flask-CORS :** Sécurisation des requêtes cross-origin du frontend.
* **Flask-Limiter :** Protection de l'API contre les requêtes excessives.
* **Requests :** Bibliothèque pour l'intégration sécurisée avec l'API REST de Jira.
* **Endpoints Analytics :** Calcul et agrégation de métriques (tickets/semaine, distribution, temps de résolution).  

### Outils de Développement
* **Git & GitHub :** Système de contrôle de version pour le travail collaboratif.
* **Visual Studio Code :** Environnement de développement principal.
* **Postman :** Outil essentiel pour tester les endpoints de l'API backend.

---

## ⚙️ Installation et Utilisation

### Prérequis
* Node.js (v14 ou plus)
* Python (v3.8 ou plus)
* Un projet Jira Cloud et un jeton d'API (API Token).

### 1. Configuration de l'environnement
1.  Clonez le dépôt : `git clone https://votre-repo.git`
2.  Créez et configurez le fichier `.env` à la racine du projet avec vos identifiants Jira :
    ```ini
    JIRA_URL=[https://votre-domaine.atlassian.net](https://votre-domaine.atlassian.net)
    JIRA_EMAIL=votre-email@exemple.com
    JIRA_TOKEN=votre-token-jira
    JIRA_PROJECT_KEY=VOTRE_CLE_PROJET
    ```

### 2. Démarrage du Backend
1.  Naviguez dans le dossier `backend` : `cd backend`
2.  Installez les dépendances : `pip install -r requirements.txt`
3.  Lancez le serveur : `python api.py`
    L'API démarrera sur `http://localhost:5000`.

### 3. Démarrage du Frontend
1.  Dans un nouveau terminal, naviguez dans le dossier `frontend` : `cd ../frontend`
2.  Installez les dépendances : `npm install`
3.  Lancez l'application : `npm start`
    L'interface utilisateur sera accessible sur `http://localhost:3000`.

---

## 🖼️ Aperçu de l'Application
Veuillez trouver ci-jointes des captures d'écran de la page d'accueil du projet.

<img width="1854" height="943" alt="interface pricipale" src="https://github.com/user-attachments/assets/032c50b8-d67c-472d-b38d-32d078d6bc00" />
<img width="753" height="649" alt="création d'un ticket" src="https://github.com/user-attachments/assets/168c8488-d881-4f04-962e-747e9cf1b79b" />
<img width="753" height="845" alt="modification d'un ticket" src="https://github.com/user-attachments/assets/e70fc62c-ce75-4bef-931e-a7890d4b7986" />
<img width="753" height="359" alt="transition d'un ticket" src="https://github.com/user-attachments/assets/babd6171-dc8e-41d6-be91-abb093f3e10e" />
<img width="753" height="316" alt="suppression d'un ticket" src="https://github.com/user-attachments/assets/758be5d8-e455-4177-b594-87adf6a58130" />
<img width="1499" height="108" alt="filtrage" src="https://github.com/user-attachments/assets/e9bf5eaa-f5bd-4d3c-be3f-adc2740c197d" />

Ci dessous, vous trouverez les vues d'ensembles du Tableau de Bord Analytique du Jira Manager Pro 

<img width="1919" height="942" alt="Screenshot from 2025-09-14 10-29-45" src="https://github.com/user-attachments/assets/9bcff9c7-f814-4fc7-a5db-01be81a85458" />
<img width="1507" height="923" alt="Screenshot from 2025-09-14 10-38-50" src="https://github.com/user-attachments/assets/ef5428bc-e988-483f-8dd6-536813d6ef5e" />
<img width="1778" height="939" alt="Screenshot from 2025-09-14 11-06-28" src="https://github.com/user-attachments/assets/fb00d4f6-7912-433f-ac40-0d2cb5b622c4" />


---



