#!/usr/bin/env python3
"""
Jira Manager Pro - API Flask
Une API REST professionnelle pour la gestion des tickets Jira avec validation, 
logging, gestion d'erreurs avancée et documentation automatique.
Version compatible avec l'interface React.
"""

from flask import Flask, request, jsonify, current_app
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from werkzeug.exceptions import BadRequest, NotFound, InternalServerError, Forbidden
import logging
import os
import sys
import traceback
from datetime import datetime
from functools import wraps
from typing import Dict, List, Optional
import json
from dotenv import load_dotenv
import requests.exceptions
from collections import defaultdict, Counter
from datetime import datetime, timedelta
from dateutil import parser
from flask import request, jsonify
from dateutil.tz import tzutc  

# Import du module Jira existant
try:
    from script_jira import JiraManager
except ImportError:
    print("❌ Erreur: script_jira.py non trouvé. Assurez-vous que le fichier existe.")
    sys.exit(1)

load_dotenv()

# Configuration de l'application
class Config:
    """Configuration de l'application"""
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-key-change-in-production')
    JIRA_URL = os.getenv('JIRA_URL')
    JIRA_EMAIL = os.getenv('JIRA_EMAIL')
    JIRA_TOKEN = os.getenv('JIRA_TOKEN')
    JIRA_PROJECT_KEY = os.getenv('JIRA_PROJECT_KEY')
    DEBUG = os.getenv('FLASK_DEBUG', 'False').lower() == 'true'
    LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')
    RATE_LIMIT_STORAGE_URL = os.getenv('RATE_LIMIT_STORAGE_URL', 'memory://')

# Configuration du logging
def setup_logging(app: Flask) -> None:
    """Configure le système de logging"""
    log_level = getattr(logging, app.config['LOG_LEVEL'].upper(), logging.INFO)
    
    formatter = logging.Formatter(
        '[%(asctime)s] %(levelname)s in %(module)s: %(message)s'
    )
    
    if not os.path.exists('logs'):
        os.makedirs('logs')
    
    file_handler = logging.FileHandler('logs/jira_api.log')
    file_handler.setFormatter(formatter)
    file_handler.setLevel(log_level)
    
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    console_handler.setLevel(log_level)
    
    app.logger.addHandler(file_handler)
    app.logger.addHandler(console_handler)
    app.logger.setLevel(log_level)

def create_app(config_class=Config) -> Flask:
    """Factory pour créer l'application Flask"""
    app = Flask(__name__)
    app.config.from_object(config_class)
    
    CORS(app, origins=["http://localhost:3000", "http://127.0.0.1:3000"])
    
    limiter = Limiter(
        key_func=get_remote_address,
        app=app,
        default_limits=["200 per day", "50 per hour"],
        storage_uri=app.config['RATE_LIMIT_STORAGE_URL']
    )
    
    setup_logging(app)
    
    return app, limiter

app, limiter = create_app()

# Validation des variables d'environnement
def validate_environment():
    """Valide que toutes les variables d'environnement nécessaires sont présentes"""
    required_vars = ['JIRA_URL', 'JIRA_EMAIL', 'JIRA_TOKEN', 'JIRA_PROJECT_KEY']
    missing_vars = [var for var in required_vars if not os.getenv(var)]
    
    if missing_vars:
        error_msg = f"Variables d'environnement manquantes: {', '.join(missing_vars)}"
        app.logger.error(error_msg)
        raise EnvironmentError(error_msg)

ISSUE_TYPE_MAPPING = {
    'tâche': 'Tâche',
    'bug': 'Bug',
    'story': 'Story',
    'epic': 'Epic'
}

def translate_issue_type(issue_type_name: str) -> str:
    """Traduit le nom du type de ticket si nécessaire."""
    return ISSUE_TYPE_MAPPING.get(issue_type_name.lower(), issue_type_name)

# Fonction utilitaire pour normaliser les assignés
def normalize_assignee(assignee):
    """Normalise les valeurs d'assigné pour éliminer les doublons"""
    if not assignee or assignee.lower() in ['unassigned', 'non assigné', 'non-assigne', '']:
        return 'Non assigné'
    return assignee.strip()

# Initialisation du gestionnaire Jira
try:
    validate_environment()
    jira_manager = JiraManager()
    app.logger.info("✅ JiraManager initialisé avec succès")
except Exception as e:
    app.logger.error(f"❌ Erreur d'initialisation JiraManager: {e}")
    jira_manager = None

# Fonction utilitaire pour récupérer les types de tickets valides
def get_valid_issue_types():
    """Récupère les types de tickets valides depuis Jira (fonction interne)"""
    try:
        response = jira_manager._make_request("GET", f"project/{jira_manager.project_key}")
        if response and response.status_code == 200:
            issue_types = [t['name'] for t in response.json()['issueTypes'] if not t.get('subtask')]
            app.logger.info(f"Types de tickets valides récupérés: {issue_types}")
            return issue_types
        else:
            app.logger.error(f"Impossible de récupérer les types de tickets: {response.status_code if response else 'Pas de réponse'}")
            return ['Task', 'Bug', 'Story', 'Epic']
    except Exception as e:
        app.logger.error(f"Erreur lors de la récupération des types: {str(e)}")
        return ['Task', 'Bug', 'Story', 'Epic']

# Fonction utilitaire pour valider l'accountId
def validate_account_id(assignee: str) -> Optional[str]:
    """Valide et convertit un assignee (email, nom, ou accountId) en accountId"""
    if not assignee:
        return None
    
    # Normaliser l'assigné
    normalized = normalize_assignee(assignee)
    if normalized == 'Non assigné':
        return None
    
    # Si c'est déjà un accountId (format long avec caractères alphanumériques et certains caractères spéciaux)
    if len(assignee) > 20 and all(c.isalnum() or c in [':', '-'] for c in assignee):
        return assignee
    
    # Rechercher l'utilisateur
    response = jira_manager._make_request("GET", f"user/search?query={assignee}")
    if response and response.status_code == 200:
        users = response.json()
        if users:
            return users[0].get('accountId')
        app.logger.warning(f"Aucun utilisateur trouvé pour query: {assignee}")
        return None
    app.logger.error(f"Échec recherche utilisateur pour {assignee}: {response.status_code if response else 'N/A'}")
    return None

# Décorateurs utilitaires
def validate_jira_connection(f):
    """Décorateur pour vérifier la connexion Jira"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not jira_manager:
            app.logger.error("JiraManager non initialisé")
            return jsonify({
                'success': False,
                'error': 'Service Jira non disponible',
                'message': 'La connexion à Jira n\'a pas pu être établie'
            }), 503
        return f(*args, **kwargs)
    return decorated_function

def log_request(f):
    """Décorateur pour logger les requêtes"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        start_time = datetime.now()
        app.logger.info(f"🚀 {request.method} {request.path} - IP: {request.remote_addr}")
        
        try:
            result = f(*args, **kwargs)
            duration = (datetime.now() - start_time).total_seconds()
            app.logger.info(f"✅ {request.method} {request.path} - {duration:.3f}s")
            return result
        except Exception as e:
            duration = (datetime.now() - start_time).total_seconds()
            app.logger.error(f"❌ {request.method} {request.path} - {duration:.3f}s - Error: {str(e)}")
            raise
    
    return decorated_function

def validate_json(required_fields: List[str] = None, optional_fields: List[str] = None):
    """Décorateur pour valider les données JSON"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if not request.is_json:
                return jsonify({
                    'success': False,
                    'error': 'Content-Type doit être application/json'
                }), 400
            
            data = request.get_json(silent=True)
            if data is None:
                return jsonify({
                    'success': False,
                    'error': 'JSON invalide ou manquant'
                }), 400
            
            if required_fields:
                missing_fields = [field for field in required_fields if not data.get(field)]
                if missing_fields:
                    return jsonify({
                        'success': False,
                        'error': f'Champs requis manquants: {", ".join(missing_fields)}'
                    }), 400
            
            return f(data, *args, **kwargs)
        return decorated_function
    return decorator

# Fonction utilitaire pour parser les informations des tickets depuis le format string
def parse_ticket_info(ticket_string):
    """Parse les informations d'un ticket depuis le format string avec normalisation des assignés"""
    try:
        # Format attendu: "KEY: SUMMARY [ASSIGNEE] [TYPE] [PRIORITY]"
        parts = ticket_string.split(': ', 1)
        if len(parts) < 2:
            return None
        
        key = parts[0].strip()
        rest = parts[1]
        
        # Extraire les parties entre crochets
        import re
        bracket_matches = re.findall(r'\[([^\]]+)\]', rest)
        
        if len(bracket_matches) >= 3:  # Au moins assignee, type et priority
            assignee_raw = bracket_matches[0]
            assignee = normalize_assignee(assignee_raw)
            issue_type = bracket_matches[1]
            priority = bracket_matches[2]
            
            # Extraire le summary (tout avant le premier crochet)
            summary_match = re.match(r'^(.+?)\s*\[', rest)
            summary = summary_match.group(1).strip() if summary_match else rest.strip()
            
            return {
                'key': key,
                'summary': summary,
                'assignee': assignee,
                'issue_type': issue_type,
                'priority': priority
            }
    except Exception as e:
        app.logger.error(f"Erreur parsing ticket: {e}")
    
    return None

# Gestionnaires d'erreurs globaux
@app.errorhandler(400)
def bad_request(error):
    app.logger.warning(f"Requête incorrecte: {error}")
    return jsonify({
        'success': False,
        'error': 'Requête incorrecte',
        'message': str(error.description) if hasattr(error, 'description') else 'Données invalides'
    }), 400

@app.errorhandler(404)
def not_found(error):
    app.logger.warning(f"Ressource non trouvée: {request.path}")
    return jsonify({
        'success': False,
        'error': 'Ressource non trouvée',
        'message': f'L\'endpoint {request.path} n\'existe pas'
    }), 404

@app.errorhandler(403)
def forbidden(error):
    app.logger.warning(f"Permission refusée: {request.path}")
    return jsonify({
        'success': False,
        'error': 'Permission refusée',
        'message': 'Vous n\'avez pas les permissions nécessaires pour cette opération'
    }), 403

@app.errorhandler(429)
def ratelimit_handler(e):
    app.logger.warning(f"Rate limit dépassé: {request.remote_addr}")
    return jsonify({
        'success': False,
        'error': 'Trop de requêtes',
        'message': 'Limite de taux dépassée, veuillez réessayer plus tard'
    }), 429

@app.errorhandler(500)
def internal_error(error):
    app.logger.error(f"Erreur interne: {error}")
    app.logger.error(traceback.format_exc())
    return jsonify({
        'success': False,
        'error': 'Erreur interne du serveur',
        'message': 'Une erreur inattendue s\'est produite'
    }), 500

# Routes API
@app.route('/api/health', methods=['GET'])
def health_check():
    """Vérification de l'état de santé de l'API"""
    try:
        jira_status = "connected" if jira_manager and jira_manager._test_connection() else "disconnected"
        return jsonify({
            'status': 'healthy',
            'timestamp': datetime.now().isoformat(),
            'jira_connection': jira_status,
            'version': '2.5.6'
        }), 200
    except Exception as e:
        return jsonify({
            'status': 'unhealthy',
            'error': str(e),
            'timestamp': datetime.now().isoformat()
        }), 503

@app.route('/api/users', methods=['GET'])
@limiter.limit("20 per minute")
@log_request
@validate_jira_connection
def search_users():
    """Recherche des utilisateurs Jira pour obtenir leur accountId"""
    try:
        query = request.args.get('query', '').strip()
        if not query:
            return jsonify({
                'success': False,
                'error': 'Requête de recherche requise',
                'message': 'Veuillez fournir un email ou un nom d\'utilisateur via le paramètre query'
            }), 400
        
        app.logger.info(f"Recherche utilisateurs avec query: '{query}'")
        
        response = jira_manager._make_request("GET", f"user/search?query={query}")
        
        if not response:
            app.logger.error("Échec recherche utilisateurs: aucune réponse")
            return jsonify({
                'success': False,
                'error': 'Échec de la recherche d\'utilisateurs',
                'message': 'Erreur réseau ou serveur Jira inaccessible'
            }), 500
            
        if response.status_code == 200:
            users = response.json()
            filtered_users = [
                {
                    'accountId': user['accountId'],
                    'displayName': user.get('displayName', 'Inconnu'),
                    'emailAddress': user.get('emailAddress', '')
                } for user in users
            ]
            app.logger.info(f"Utilisateurs trouvés: {len(filtered_users)}")
            return jsonify({
                'success': True,
                'users': filtered_users
            }), 200
        else:
            app.logger.warning(f"Échec recherche utilisateurs: {response.status_code} - {response.text}")
            if response.status_code == 403:
                return jsonify({
                    'success': False,
                    'error': 'Permission refusée',
                    'message': 'Vous n\'avez pas la permission de rechercher des utilisateurs'
                }), 403
            return jsonify({
                'success': False,
                'error': 'Échec de la recherche d\'utilisateurs',
                'message': response.text
            }), response.status_code
            
    except Exception as e:
        app.logger.error(f"Erreur recherche utilisateurs: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Erreur lors de la recherche d\'utilisateurs',
            'message': str(e)
        }), 500

@app.route('/api/priorities', methods=['GET'])
@limiter.limit("20 per minute")
@log_request
@validate_jira_connection
def get_priorities():
    """Liste les priorités disponibles dans Jira"""
    try:
        response = jira_manager._make_request("GET", "priority")
        if not response:
            app.logger.error("Échec récupération priorités: aucune réponse")
            return jsonify({
                'success': False,
                'error': 'Échec récupération priorités',
                'message': 'Erreur réseau ou serveur Jira inaccessible'
            }), 500
        if response.status_code == 200:
            priorities = [p['name'] for p in response.json()]
            app.logger.info(f"Priorités récupérées: {priorities}")
            return jsonify({
                'success': True,
                'priorities': priorities
            }), 200
        app.logger.warning(f"Échec récupération priorités: {response.status_code} - {response.text}")
        return jsonify({
            'success': False,
            'error': 'Échec récupération priorités',
            'message': response.text
        }), response.status_code
    except Exception as e:
        app.logger.error(f"Erreur récupération priorités: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Erreur récupération priorités',
            'message': str(e)
        }), 500

@app.route('/api/tickets', methods=['GET'])
@limiter.limit("30 per minute")
@log_request
@validate_jira_connection
def list_tickets():
    """Récupère la liste des tickets avec filtrage amélioré et normalisation des assignés"""
    try:
        search = request.args.get('search', '').strip()
        assignee_filter = request.args.get('assignee', 'all').strip()
        type_filter = request.args.get('type', 'all').strip()
        status_filter = request.args.get('status', 'all').strip()
        priority_filter = request.args.get('priority', 'all').strip()

        app.logger.info(f"Récupération tickets - search: '{search}', assignee: '{assignee_filter}', type: '{type_filter}', status: '{status_filter}', priority: '{priority_filter}'")
        
        tickets = jira_manager.get_tickets()
        
        if not tickets:
            app.logger.warning("Aucun ticket récupéré depuis Jira")
            return jsonify({}), 200
        
        filtered_tickets = {}
        
        for status, ticket_list in tickets.items():
            # Filtrage par statut
            status_matches = (status_filter.lower() in ['all', ''] or 
                            status_filter.upper() == status.upper())
            
            if not status_matches:
                continue
                
            filtered_list = []
            
            for ticket_string in ticket_list:
                # Parser les informations du ticket avec normalisation
                ticket_info = parse_ticket_info(ticket_string)
                if not ticket_info:
                    continue
                
                passes_all_filters = True
                
                # Filtrage par recherche
                if search and search.lower() not in ticket_string.lower():
                    passes_all_filters = False
                
                # Filtrage par assignee - normalisation complète
                if passes_all_filters and assignee_filter.lower() not in ['all', '']:
                    ticket_assignee = normalize_assignee(ticket_info['assignee'])
                    normalized_filter = normalize_assignee(assignee_filter)
                    
                    if normalized_filter == 'Non assigné':
                        if ticket_assignee != 'Non assigné':
                            passes_all_filters = False
                    elif ticket_assignee != normalized_filter:
                        passes_all_filters = False
                
                # Filtrage par type
                if passes_all_filters and type_filter.lower() not in ['all', '']:
                    ticket_type = ticket_info.get('issue_type', '')
                    if type_filter.lower() != ticket_type.lower():
                        passes_all_filters = False
                
                # Filtrage par priorité
                if passes_all_filters and priority_filter.lower() not in ['all', '']:
                    ticket_priority = ticket_info.get('priority', '')
                    if priority_filter.lower() != ticket_priority.lower():
                        passes_all_filters = False
                
                if passes_all_filters:
                    filtered_list.append(ticket_string)
            
            if status_matches:
                filtered_tickets[status] = filtered_list
        
        app.logger.info(f"Tickets filtrés: {sum(len(v) for v in filtered_tickets.values())} tickets dans {len(filtered_tickets)} statuts")
        
        return jsonify(filtered_tickets), 200
        
    except Exception as e:
        app.logger.error(f"Erreur lors de la récupération des tickets: {str(e)}")
        if "permission" in str(e).lower():
            return jsonify({
                'success': False,
                'error': 'Permission refusée',
                'message': 'Vous n\'avez pas les permissions nécessaires pour accéder aux tickets'
            }), 403
        return jsonify({
            'success': False,
            'error': 'Erreur lors de la récupération des tickets',
            'message': str(e)
        }), 500

@app.route('/api/filters/assignees', methods=['GET'])
@limiter.limit("20 per minute")
@log_request
@validate_jira_connection
def get_unique_assignees():
    """Récupère la liste unique des assignees pour le filtre avec normalisation"""
    try:
        tickets = jira_manager.get_tickets()
        assignees = set()
        
        for status, ticket_list in tickets.items():
            for ticket_string in ticket_list:
                ticket_info = parse_ticket_info(ticket_string)
                if ticket_info:
                    normalized_assignee = normalize_assignee(ticket_info['assignee'])
                    assignees.add(normalized_assignee)
        
        # Convertir en liste, trier et s'assurer que "Non assigné" est en premier si présent
        assignee_list = sorted(list(assignees))
        if 'Non assigné' in assignee_list:
            assignee_list.remove('Non assigné')
            assignee_list.insert(0, 'Non assigné')
        
        return jsonify({
            'success': True,
            'assignees': assignee_list
        }), 200
        
    except Exception as e:
        app.logger.error(f"Erreur récupération assignees: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Erreur récupération assignees',
            'message': str(e)
        }), 500

@app.route('/api/filters/types', methods=['GET'])
@limiter.limit("20 per minute")
@log_request
@validate_jira_connection
def get_unique_types():
    """Récupère la liste unique des types de tickets pour le filtre"""
    try:
        tickets = jira_manager.get_tickets()
        types = set()
        
        for status, ticket_list in tickets.items():
            for ticket_string in ticket_list:
                ticket_info = parse_ticket_info(ticket_string)
                if ticket_info:
                    issue_type = ticket_info.get('issue_type', '')
                    if issue_type:
                        types.add(issue_type)
        
        type_list = sorted(list(types))
        
        return jsonify({
            'success': True,
            'types': type_list
        }), 200
        
    except Exception as e:
        app.logger.error(f"Erreur récupération types: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Erreur récupération types',
            'message': str(e)
        }), 500

@app.route('/api/filters/statuses', methods=['GET'])
@limiter.limit("20 per minute")
@log_request
@validate_jira_connection
def get_unique_statuses():
    """Récupère la liste unique des statuts pour le filtre"""
    try:
        tickets = jira_manager.get_tickets()
        statuses = list(tickets.keys()) if tickets else []
        
        return jsonify({
            'success': True,
            'statuses': statuses
        }), 200
        
    except Exception as e:
        app.logger.error(f"Erreur récupération statuses: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Erreur récupération statuses',
            'message': str(e)
        }), 500

@app.route('/api/tickets/<ticket_key>/details', methods=['GET'])
@limiter.limit("50 per minute")
@log_request
@validate_jira_connection
def get_ticket_details(ticket_key):
    """Récupère les détails complets d'un ticket avec normalisation des assignés"""
    try:
        if not ticket_key.strip():
            return jsonify({
                'success': False,
                'error': 'Clé du ticket requise'
            }), 400
        
        app.logger.info(f"Récupération détails pour {ticket_key}")
        
        response = jira_manager._make_request("GET", f"issue/{ticket_key}")
        
        if response and response.status_code == 200:
            issue_data = response.json()
            
            # Parser la description ADF
            description_content = ''
            if issue_data['fields'].get('description'):
                desc = issue_data['fields']['description']
                if isinstance(desc, dict) and desc.get('content'):
                    for para in desc['content']:
                        if para.get('content'):
                            for text in para['content']:
                                if text.get('type') == 'text' and text.get('text'):
                                    description_content += text['text'] + '\n'
                elif isinstance(desc, str):
                    description_content = desc
            
            # Normaliser l'assigné
            assignee_raw = None
            if issue_data['fields'].get('assignee'):
                assignee_raw = issue_data['fields']['assignee'].get('displayName')
            assignee_normalized = normalize_assignee(assignee_raw)
            
            ticket_details = {
                'key': issue_data.get('key', ticket_key),
                'summary': issue_data['fields'].get('summary', 'Sans titre'),
                'description': description_content.strip(),
                'status': issue_data['fields']['status']['name'],
                'assignee': assignee_normalized,
                'priority': (issue_data['fields']['priority']['name'] 
                           if issue_data['fields'].get('priority') else 'Non définie'),
                'issueType': issue_data['fields']['issuetype']['name'],
                'created': issue_data['fields'].get('created', ''),
                'updated': issue_data['fields'].get('updated', ''),
                'reporter': (issue_data['fields']['reporter']['displayName'] 
                           if issue_data['fields'].get('reporter') else 'Inconnu'),
                'project': (issue_data['fields']['project']['name'] 
                          if issue_data['fields'].get('project') else 'Inconnu')
            }
            
            app.logger.info(f"✅ Détails récupérés pour {ticket_key}, assigné: {assignee_normalized}")
            return jsonify({
                'success': True,
                'ticket': ticket_details
            }), 200
        else:
            status_code = response.status_code if response else 'N/A'
            app.logger.warning(f"❌ Échec récupération détails {ticket_key} - Status: {status_code}")
            
            if response and response.status_code == 404:
                return jsonify({
                    'success': False,
                    'error': 'Ticket non trouvé',
                    'message': f'Le ticket {ticket_key} n\'existe pas'
                }), 404
            elif response and response.status_code == 403:
                return jsonify({
                    'success': False,
                    'error': 'Permission refusée',
                    'message': 'Vous n\'avez pas la permission d\'accéder à ce ticket'
                }), 403
            else:
                return jsonify({
                    'success': False,
                    'error': 'Impossible de récupérer les détails',
                    'message': 'Erreur réseau ou serveur Jira inaccessible'
                }), 500
            
    except Exception as e:
        app.logger.error(f"Erreur récupération détails {ticket_key}: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Erreur lors de la récupération des détails',
            'message': str(e)
        }), 500

@app.route('/api/tickets', methods=['POST'])
@limiter.limit("10 per minute")
@log_request
@validate_jira_connection
@validate_json(required_fields=['summary'])
def create_ticket(data):
    """Crée un nouveau ticket avec gestion correcte du type, assignee et priorité"""
    try:
        summary = data['summary'].strip()
        description = data.get('description', '').strip()
        issue_type = translate_issue_type(data.get('issueType'))  
        priority = data.get('priority', '').strip() or None
        assignee = data.get('assignee', '').strip() or None
        
        # Validations
        if len(summary) < 5:
            return jsonify({
                'success': False,
                'error': 'Le résumé doit contenir au moins 5 caractères'
            }), 400
        
        if len(summary) > 255:
            return jsonify({
                'success': False,
                'error': 'Le résumé ne peut pas dépasser 255 caractères'
            }), 400
        
        if not issue_type:
            issue_type = 'Task'
        
        # Valider le type de ticket
        valid_issue_types = get_valid_issue_types()
        issue_type_normalized = None
        for valid_type in valid_issue_types:
            if issue_type.lower() == valid_type.lower():
                issue_type_normalized = valid_type
                break
        
        if not issue_type_normalized:
            app.logger.warning(f"Type de ticket invalide: {issue_type}")
            return jsonify({
                'success': False,
                'error': 'Type de ticket invalide',
                'message': f"Le type '{issue_type}' n'est pas valide. Types disponibles: {', '.join(valid_issue_types)}"
            }), 400
        
        # Valider l'assignee si fourni
        validated_assignee = None
        if assignee:
            # Normaliser d'abord
            normalized_assignee = normalize_assignee(assignee)
            if normalized_assignee != 'Non assigné':
                validated_assignee = validate_account_id(assignee)
                if not validated_assignee:
                    app.logger.warning(f"Assignee invalide: {assignee}")
                    return jsonify({
                        'success': False,
                        'error': 'Assignee invalide',
                        'message': f"L'utilisateur '{assignee}' n'a pas été trouvé"
                    }), 400
        
        app.logger.info(f"Création ticket - résumé: '{summary[:50]}...', type: {issue_type_normalized}, assignee: {validated_assignee}, priorité: {priority}")
        
        success = jira_manager.create_ticket(
            summary=summary, 
            description=description, 
            issue_type=issue_type_normalized,
            priority=priority,
            assignee=validated_assignee
        )
        
        if success:
            app.logger.info(f"✅ Ticket créé avec succès")
            return jsonify({
                'success': True,
                'message': f'Ticket créé avec succès',
                'issue_type': issue_type_normalized
            }), 201
        else:
            app.logger.warning(f"❌ Échec création ticket")
            return jsonify({
                'success': False,
                'error': 'Échec de la création du ticket',
                'message': 'Vérifiez les paramètres et permissions'
            }), 400
            
    except Exception as e:
        app.logger.error(f"Erreur création ticket: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Erreur lors de la création du ticket',
            'message': str(e)
        }), 500

@app.route('/api/tickets/<ticket_key>', methods=['PUT'])
@limiter.limit("20 per minute")
@log_request
@validate_jira_connection
@validate_json()
def update_ticket(data, ticket_key):
    """Met à jour un ticket avec normalisation des assignés"""
    try:
        if not ticket_key.strip():
            return jsonify({
                'success': False,
                'error': 'Clé du ticket requise'
            }), 400
        
        new_summary = data.get('summary', '').strip()
        new_description = data.get('description', '').strip()
        new_priority = data.get('priority', '').strip() or None
        new_issue_type = translate_issue_type(data.get('issueType'))
        
        # CORRECTION : Gérer correctement l'assigné
        validated_assignee = None
        assignee_changed = False
        
        if 'assignee' in data:  # Vérifier si le champ assignee est présent dans la requête
            assignee_changed = True
            new_assignee = data['assignee']
            
            # Si l'assigné est None, vide, ou "Non assigné", désassigner
            if new_assignee is None or new_assignee == "" or new_assignee == "Non assigné":
                validated_assignee = None
                app.logger.info(f"Désassignation du ticket {ticket_key}")
            else:
                # Valider l'assigné
                validated_assignee = validate_account_id(new_assignee)
                if not validated_assignee:
                    app.logger.warning(f"Assignee invalide: {new_assignee}")
                    return jsonify({
                        'success': False,
                        'error': 'Assignee invalide',
                        'message': f"L'utilisateur '{new_assignee}' n'a pas été trouvé"
                    }), 400
        
        # Validations
        if new_summary and len(new_summary) < 5:
            return jsonify({
                'success': False,
                'error': 'Le résumé doit contenir au moins 5 caractères'
            }), 400
        
        # Valider le nouveau type si fourni
        new_issue_type_normalized = None
        if new_issue_type:
            valid_issue_types = get_valid_issue_types()
            for valid_type in valid_issue_types:
                if new_issue_type.lower() == valid_type.lower():
                    new_issue_type_normalized = valid_type
                    break
            
            if not new_issue_type_normalized:
                return jsonify({
                    'success': False,
                    'error': 'Type de ticket invalide',
                    'message': f"Le type '{new_issue_type}' n'est pas valide"
                }), 400
        
        if not any([new_summary, new_description, new_priority, new_issue_type_normalized, assignee_changed]):
            return jsonify({
                'success': False,
                'error': 'Au moins un champ doit être fourni pour la mise à jour'
            }), 400
        
        app.logger.info(f"Mise à jour ticket {ticket_key} - Assigné: {validated_assignee if assignee_changed else 'inchangé'}")
        
        success = jira_manager.update_ticket(
            ticket_key=ticket_key, 
            new_summary=new_summary or None,
            new_description=new_description or None,
            new_issue_type=new_issue_type_normalized,
            new_priority=new_priority,
            new_assignee=validated_assignee if assignee_changed else 'no_change'
        )
        
        if success:
            app.logger.info(f"✅ Ticket {ticket_key} mis à jour avec succès")
            return jsonify({
                'success': True,
                'message': f'Ticket {ticket_key} mis à jour avec succès'
            }), 200
        else:
            return jsonify({
                'success': False,
                'error': 'Échec de la mise à jour du ticket',
                'message': 'Vérifiez les valeurs fournies et les permissions'
            }), 400
            
    except Exception as e:
        app.logger.error(f"Erreur mise à jour ticket {ticket_key}: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Erreur lors de la mise à jour du ticket',
            'message': str(e)
        }), 500

@app.route('/api/issue-types', methods=['GET'])
@limiter.limit("20 per minute")
@log_request
@validate_jira_connection
def get_issue_types():
    """Liste les types de tickets disponibles dans le projet."""
    try:
        response = jira_manager._make_request("GET", f"project/{jira_manager.project_key}")
        if not response:
            app.logger.error("Échec récupération types de tickets: aucune réponse")
            return jsonify({
                'success': False,
                'error': 'Échec récupération types de tickets',
                'message': 'Erreur réseau ou serveur Jira inaccessible'
            }), 500
        if response.status_code == 200:
            issue_types = [t['name'] for t in response.json()['issueTypes'] if not t.get('subtask')]
            app.logger.info(f"Types de tickets récupérés: {issue_types}")
            return jsonify({
                'success': True,
                'issue_types': issue_types
            }), 200
        app.logger.warning(f"Échec récupération types de tickets: {response.status_code} - {response.text}")
        return jsonify({
            'success': False,
            'error': 'Échec récupération types de tickets',
            'message': response.text
        }), response.status_code
    except Exception as e:
        app.logger.error(f"Erreur récupération types de tickets: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Erreur récupération types de tickets',
            'message': str(e)
        }), 500

@app.route('/api/tickets/<ticket_key>/transitions', methods=['GET'])
@limiter.limit("50 per minute")
@log_request
@validate_jira_connection
def get_ticket_transitions(ticket_key):
    """Récupère les transitions disponibles pour un ticket"""
    try:
        if not ticket_key.strip():
            return jsonify({
                'success': False,
                'error': 'Clé du ticket requise'
            }), 400
        
        app.logger.info(f"Récupération transitions pour {ticket_key}")
        transitions = jira_manager.get_available_transitions(ticket_key)
        
        if transitions:
            return jsonify({
                'success': True,
                'transitions': transitions
            }), 200
        else:
            return jsonify({
                'success': False,
                'error': 'Impossible de récupérer les transitions',
                'message': 'Vérifiez que le ticket existe'
            }), 404
            
    except Exception as e:
        app.logger.error(f"Erreur récupération transitions {ticket_key}: {str(e)}")
        if "permission" in str(e).lower():
            return jsonify({
                'success': False,
                'error': 'Permission refusée',
                'message': 'Vous n\'avez pas les permissions nécessaires pour accéder aux transitions'
            }), 403
        return jsonify({
            'success': False,
            'error': 'Erreur lors de la récupération des transitions',
            'message': str(e)
        }), 500

@app.route('/api/tickets/<ticket_key>/transition', methods=['POST'])
@limiter.limit("15 per minute")
@log_request
@validate_jira_connection
@validate_json(required_fields=['transition_name'])
def transition_ticket(data, ticket_key):
    """Change le statut d'un ticket"""
    try:
        if not ticket_key.strip():
            return jsonify({
                'success': False,
                'error': 'Clé du ticket requise'
            }), 400
        
        transition_name = data['transition_name'].strip()
        comment = data.get('comment', '').strip() or None
        
        if not transition_name:
            return jsonify({
                'success': False,
                'error': 'Nom de la transition requis'
            }), 400
        
        app.logger.info(f"Transition ticket {ticket_key} vers '{transition_name}'")
        
        success = True
        failed_operations = []
        
        # Ajout du commentaire si requis
        if any(word in transition_name.lower() for word in ['terminé', 'done', 'closed', 'resolve']) and comment:
            comment_payload = {
                "body": {
                    "type": "doc",
                    "version": 1,
                    "content": [
                        {
                            "type": "paragraph",
                            "content": [{"type": "text", "text": comment}]
                        }
                    ]
                }
            }
            response = jira_manager._make_request('POST', f'issue/{ticket_key}/comment', json=comment_payload)
            if not response or response.status_code not in (200, 201):
                failed_operations.append("Ajout commentaire échoué")
                success = False
            else:
                app.logger.info(f"✅ Commentaire ajouté pour {ticket_key}")
        
        # Effectuer la transition
        transition_success = jira_manager.transition_ticket(ticket_key, transition_name)
        if not transition_success:
            failed_operations.append("Transition échouée")
            success = False
        
        if success or transition_success:
            app.logger.info(f"✅ Ticket {ticket_key} transitionné vers '{transition_name}'")
            return jsonify({
                'success': True,
                'message': f'Ticket {ticket_key} transitionné avec succès'
            }), 200
        else:
            return jsonify({
                'success': False,
                'error': 'Échec de la transition du ticket',
                'message': f"Erreurs: {', '.join(failed_operations)}"
            }), 400
            
    except Exception as e:
        app.logger.error(f"Erreur transition ticket {ticket_key}: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Erreur lors de la transition du ticket',
            'message': str(e)
        }), 500

@app.route('/api/tickets/<ticket_key>', methods=['DELETE'])
@limiter.limit("5 per minute")
@log_request
@validate_jira_connection
def delete_ticket(ticket_key):
    """Supprime un ticket"""
    try:
        if not ticket_key.strip():
            return jsonify({
                'success': False,
                'error': 'Clé du ticket requise'
            }), 400
        
        app.logger.info(f"Suppression ticket {ticket_key}")
        
        response = jira_manager._make_request("DELETE", f"issue/{ticket_key}")
        
        if not response:
            return jsonify({
                'success': False,
                'error': 'Échec de la suppression du ticket',
                'message': 'Erreur réseau ou serveur Jira inaccessible'
            }), 500
            
        if response.status_code == 204:
            app.logger.info(f"✅ Ticket {ticket_key} supprimé avec succès")
            return jsonify({
                'success': True,
                'message': f'Ticket {ticket_key} supprimé avec succès'
            }), 200
        else:
            app.logger.warning(f"❌ Échec suppression ticket {ticket_key}")
            
            if response.status_code == 404:
                return jsonify({
                    'success': False,
                    'error': 'Ticket non trouvé',
                    'message': f'Le ticket {ticket_key} n\'existe pas'
                }), 404
            elif response.status_code == 403:
                return jsonify({
                    'success': False,
                    'error': 'Permission refusée',
                    'message': 'Vous n\'avez pas la permission de supprimer ce ticket'
                }), 403
            else:
                return jsonify({
                    'success': False,
                    'error': 'Échec de la suppression du ticket',
                    'message': response.text
                }), response.status_code
            
    except Exception as e:
        app.logger.error(f"Erreur suppression ticket {ticket_key}: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Erreur lors de la suppression du ticket',
            'message': str(e)
        }), 500

@app.route('/api/stats', methods=['GET'])
@limiter.limit("20 per minute")
@log_request
@validate_jira_connection
def get_stats():
    """Récupère les statistiques des tickets avec normalisation des assignés"""
    try:
        tickets = jira_manager.get_tickets()
        
        if not tickets:
            return jsonify({
                'total_tickets': 0,
                'by_status': {},
                'by_assignee': {},
                'unassigned_count': 0
            }), 200
        
        stats = {
            'total_tickets': 0,
            'by_status': {},
            'by_assignee': {},
            'unassigned_count': 0
        }
        
        for status, ticket_list in tickets.items():
            stats['by_status'][status] = len(ticket_list)
            stats['total_tickets'] += len(ticket_list)
            
            for ticket in ticket_list:
                ticket_info = parse_ticket_info(ticket)
                if ticket_info:
                    assignee = normalize_assignee(ticket_info['assignee'])
                    if assignee == 'Non assigné':
                        stats['unassigned_count'] += 1
                    else:
                        stats['by_assignee'][assignee] = stats['by_assignee'].get(assignee, 0) + 1
        
        return jsonify(stats), 200
        
    except Exception as e:
        app.logger.error(f"Erreur récupération statistiques: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Erreur lors de la récupération des statistiques',
            'message': str(e)
        }), 500

@app.route('/api/analytics', methods=['GET'])
@limiter.limit("10 per minute")
@log_request
@validate_jira_connection
def get_analytics():
    """Récupère les statistiques analytiques des tickets"""
    try:
        app.logger.info("Starting analytics retrieval")
        tickets_by_status = jira_manager.get_tickets()
        all_tickets = []
        
        for status, ticket_list in tickets_by_status.items():
            for ticket_string in ticket_list:
                ticket_info = parse_ticket_info(ticket_string)
                if ticket_info:
                    response = jira_manager._make_request("GET", f"issue/{ticket_info['key']}")
                    if response and response.status_code == 200:
                        ticket_data = response.json()
                        ticket_info['created'] = ticket_data['fields'].get('created')
                        ticket_info['resolutiondate'] = ticket_data['fields'].get('resolutiondate')
                        # Normaliser l'assigné dans les analytics
                        assignee_raw = None
                        if ticket_data['fields'].get('assignee'):
                            assignee_raw = ticket_data['fields']['assignee'].get('displayName')
                        ticket_info['assignee'] = normalize_assignee(assignee_raw)
                        all_tickets.append(ticket_info)

        if not all_tickets:
            return jsonify({
                'tickets_per_week': [],
                'priority_distribution': {},
                'type_distribution': {},
                'avg_resolution_time': 0.0
            }), 200

        # Ticket count per week
        tickets_per_week = defaultdict(int)
        for ticket in all_tickets:
            if ticket['created']:
                created_date = parser.parse(ticket['created'])
                year_week = f"{created_date.year}-{created_date.isocalendar()[1]:02d}"
                tickets_per_week[year_week] += 1
        tickets_per_week_list = [{"week": k, "count": v} for k, v in sorted(tickets_per_week.items())]

        # Priority distribution
        priority_dist = Counter(ticket.get('priority', 'Unknown') for ticket in all_tickets)

        # Type distribution
        type_dist = Counter(ticket.get('issue_type', 'Unknown') for ticket in all_tickets)

        # Average resolution time (in days, for resolved tickets)
        resolution_times = []
        for ticket in all_tickets:
            if ticket['resolutiondate'] and ticket['created']:
                created = parser.parse(ticket['created'])
                resolved = parser.parse(ticket['resolutiondate'])
                resolution_times.append((resolved - created).total_seconds() / 86400)
        avg_resolution = sum(resolution_times) / len(resolution_times) if resolution_times else 0.0

        return jsonify({
            'tickets_per_week': tickets_per_week_list,
            'priority_distribution': dict(priority_dist),
            'type_distribution': dict(type_dist),
            'avg_resolution_time': round(avg_resolution, 1)
        }), 200

    except Exception as e:
        app.logger.error(f"Error in analytics retrieval: {str(e)}")
        app.logger.error(f"Traceback: {traceback.format_exc()}")
        return jsonify({
            'success': False,
            'error': 'Erreur lors de la récupération des analytics',
            'message': str(e)
        }), 500

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

@app.route('/api/analytics/filtered', methods=['GET'])
@limiter.limit("10 per minute")
@log_request
@validate_jira_connection
def get_filtered_analytics():
    """Récupère les analytics filtrées avec normalisation des assignés"""
    try:
        time_filter = request.args.get('time', 'all')
        tickets_by_status = jira_manager.get_tickets()
        
        all_tickets = []
        for status, ticket_list in tickets_by_status.items():
            for ticket_string in ticket_list:
                ticket_info = parse_ticket_info(ticket_string)
                if ticket_info:
                    response = jira_manager._make_request("GET", f"issue/{ticket_info['key']}")
                    if response and response.status_code == 200:
                        ticket_data = response.json()
                        ticket_info['created'] = ticket_data['fields'].get('created')
                        ticket_info['resolution_date'] = ticket_data['fields'].get('resolutiondate')
                        ticket_info['updated'] = ticket_data['fields'].get('updated')
                        
                        # Normaliser l'assigné
                        assignee_raw = None
                        if ticket_data['fields'].get('assignee'):
                            assignee_raw = ticket_data['fields']['assignee'].get('displayName')
                        ticket_info['assignee'] = normalize_assignee(assignee_raw)
                        
                        issue_type = ticket_data['fields'].get('issuetype', {}).get('name', 'Unknown')
                        ticket_info['type'] = 'Task' if issue_type == 'Tâche' else issue_type
                        all_tickets.append(ticket_info)

        tickets_per_week = defaultdict(int)
        priority_distribution = defaultdict(int)
        type_distribution = defaultdict(int)
        assignment_distribution = defaultdict(int)
        total_resolution_time = 0
        resolved_count = 0

        current_date = datetime.now(tzutc())
        filter_date = None
        if time_filter == 'week':
            filter_date = current_date - timedelta(days=7)
        elif time_filter == 'month':
            filter_date = current_date - timedelta(days=30)

        filtered_ticket_count = 0
        
        for ticket in all_tickets:
            created_str = ticket['created']
            if created_str:
                try:
                    created = parser.parse(created_str).astimezone(tzutc())
                    
                    include_ticket = True
                    if filter_date is not None:
                        include_ticket = created >= filter_date
                    
                    if include_ticket:
                        filtered_ticket_count += 1
                        year_week = f"{created.year}-{created.isocalendar()[1]:02d}"
                        tickets_per_week[year_week] += 1
                        priority_distribution[ticket.get('priority', 'Unknown')] += 1
                        type_distribution[ticket.get('type', 'Unknown')] += 1
                        
                        # Utiliser la valeur normalisée de l'assigné
                        normalized_assignee = ticket['assignee']
                        assignment_distribution['Non assignés' if normalized_assignee == 'Non assigné' else 'Assignés'] += 1

                        # Resolution calculation with fallback to 'updated'
                        resolution_date_str = ticket.get('resolution_date') or ticket.get('updated')
                        if resolution_date_str:
                            try:
                                resolution_date = parser.parse(resolution_date_str).astimezone(tzutc())
                                resolution_time = (resolution_date - created).days
                                if resolution_time >= 0:
                                    total_resolution_time += resolution_time
                                    resolved_count += 1
                            except ValueError as e:
                                logger.error(f"Error parsing resolution/updated for {ticket['key']}: {e}")
                        
                except ValueError as e:
                    logger.error(f"Error parsing created for {ticket.get('key', 'unknown')}: {e}")

        avg_resolution_time = total_resolution_time / resolved_count if resolved_count > 0 else 0.0

        return jsonify({
            'success': True,
            'tickets_per_week': [{'week': week, 'count': count} for week, count in sorted(tickets_per_week.items())],
            'priority_distribution': dict(priority_distribution),
            'type_distribution': dict(type_distribution),
            'assignment_distribution': dict(assignment_distribution),
            'avg_resolution_time': round(avg_resolution_time, 1),
            'total_tickets': filtered_ticket_count,
            'resolved_tickets': resolved_count
        }), 200
        
    except Exception as e:
        logger.error(f"Error in filtered analytics: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'error': str(e)}), 500

if __name__ == '__main__':
    if not jira_manager:
        print("❌ Impossible de démarrer l'API sans connexion Jira valide")
        sys.exit(1)
    
    print("🚀 Démarrage de Jira Manager Pro API (Compatible React)...")
    print(f"📊 Niveau de log: {app.config['LOG_LEVEL']}")
    print(f"🔧 Mode debug: {app.config['DEBUG']}")
    print(f"🌐 CORS autorisé pour: http://localhost:3000")
    print("📖 Documentation API disponible sur: /api/docs")
    print("🆕 Version 2.5.6 avec gestion unifiée des assignés")
    
    try:
        app.run(
            host='0.0.0.0',
            port=int(os.getenv('PORT', 5000)),
            debug=app.config['DEBUG'],
            threaded=True
        )
    except KeyboardInterrupt:
        print("\n👋 Arrêt de l'API")
    except Exception as e:
        print(f"❌ Erreur lors du démarrage: {e}")
        sys.exit(1)