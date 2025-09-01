# Jira Manager Pro

Jira Manager Pro est une application web full-stack conçue pour simplifier et optimiser la gestion des tickets Jira. Elle offre une interface utilisateur moderne et intuitive développée en React, qui communique avec une API backend robuste construite avec Flask. Ce projet a été réalisé dans le cadre de mon stage d'été à **Primatec Engineering**.

---

## 🚀 Fonctionnalités Clés

* **Gestion des Tickets (CRUD) :** Créez, lisez, mettez à jour et supprimez des tickets avec une interface simplifiée.
* **Recherche et Filtrage Avancé :** Filtrez les tickets en temps réel par assigné, statut, type et mot-clé pour une navigation efficace.
* **Transitions de Statut :** Changez l'état d'un ticket via une modale interactive qui affiche uniquement les transitions possibles, simplifiant ainsi le workflow.
* **Gestion des Erreurs :** Validation en temps réel, messages d'erreur contextuels et mécanismes de récupération en cas d'échec de l'API.
* **Expérience Utilisateur Optimale :** Une interface rapide, réactive et intuitive pour une productivité accrue.

---

## 🛠️ Stack Technique

### Frontend
* **React.js :** Bibliothèque pour l'interface utilisateur. Utilisation intensive des Hooks (`useState`, `useEffect`, `useCallback`) pour une logique de composant performante.
* **CSS :** Stylisation de l'application avec des styles modulaires pour une meilleure maintenabilité.

### Backend (API REST)
* **Python (avec Flask) :** Micro-framework pour le serveur de l'API.
* **Flask-CORS :** Sécurisation des requêtes cross-origin du frontend.
* **Flask-Limiter :** Protection de l'API contre les requêtes excessives.
* **Requests :** Bibliothèque pour l'intégration sécurisée avec l'API REST de Jira.

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

<img width="1854" height="943" alt="interface pricipale" src="https://github.com/user-attachments/assets/032c50b8-d67c-472d-b38d-32d078d6bc00" />
<img width="753" height="649" alt="création d'un ticket" src="https://github.com/user-attachments/assets/168c8488-d881-4f04-962e-747e9cf1b79b" />
<img width="753" height="845" alt="modification d'un ticket" src="https://github.com/user-attachments/assets/e70fc62c-ce75-4bef-931e-a7890d4b7986" />
<img width="753" height="359" alt="transition d'un ticket" src="https://github.com/user-attachments/assets/babd6171-dc8e-41d6-be91-abb093f3e10e" />
<img width="753" height="316" alt="suppression d'un ticket" src="https://github.com/user-attachments/assets/758be5d8-e455-4177-b594-87adf6a58130" />
<img width="1499" height="108" alt="filtrage" src="https://github.com/user-attachments/assets/e9bf5eaa-f5bd-4d3c-be3f-adc2740c197d" />


---

## 💡 Perspectives et Améliorations Futures

Le projet Jira Manager Pro, dans sa version actuelle, constitue une base solide et fonctionnelle. Pour continuer à le faire évoluer vers un outil de gestion de projet plus intelligent et proactif, plusieurs axes d'amélioration peuvent être envisagés, notamment en tirant parti des principes de la science des données.

### 1. Fonctions d'Analyse et de Machine Learning

Les données contenues dans Jira (historique des tickets, temps de résolution, etc.) sont une mine d'or pour les analyses.

* **Prédiction de la Durée des Tickets :** Développer un modèle de machine learning capable d'**estimer la durée de résolution d'un nouveau ticket**. En se basant sur des variables comme le type, la priorité, la description ou l'assigné, cette fonction aiderait les chefs de projet à mieux planifier les délais.
* **Identification des Goulots d'Étranglement :** Analyser le flux de travail pour **détecter automatiquement les points de blocage** dans le processus de développement. L'application pourrait alerter sur les tickets qui stagnent ou les utilisateurs qui sont surchargés.
* **Système de Recommandation d'Assignés :** Mettre en place un algorithme qui **suggère l'assigné le plus pertinent** pour un nouveau ticket. La recommandation se baserait sur les compétences, la charge de travail actuelle et l'historique de réussite de l'équipe sur des tâches similaires.

### 2. Améliorations Fonctionnelles et Techniques

Au-delà de l'aspect analytique, l'application peut gagner en confort et en puissance pour l'utilisateur quotidien.

* **Gestion des Pièces Jointes :** Permettre de visualiser, d'ajouter et de supprimer des pièces jointes directement depuis l'interface de l'application.
* **Optimisation de la Performance :** Intégrer un système de **mise en cache côté backend** pour les données statiques (liste des utilisateurs, types de tickets), ce qui réduirait la charge sur l'API de Jira et accélérerait les temps de réponse.
* **Fonctionnalités de Collaboration :** Ajouter la possibilité de consulter et d'ajouter des commentaires à un ticket, et de notifier d'autres utilisateurs via des mentions (`@utilisateur`).
