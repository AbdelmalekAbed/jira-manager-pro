import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, Plus, Edit, Trash2, RefreshCw, Filter, AlertCircle, CheckCircle, Clock, User, Calendar, Tag, Settings, X, ArrowRight } from 'lucide-react';

// Configuration de l'API
const API_BASE_URL = 'http://localhost:5000/api';

// Service API amélioré pour la gestion des types
const apiService = {
  async makeRequest(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || data.error || `HTTP error! status: ${response.status}`);
      }
      
      return data;
    } catch (error) {
      console.error('API Request failed:', error);
      throw error;
    }
  },

  async getTickets(filters = {}) {
    const params = new URLSearchParams();
    if (filters.search) params.append('search', filters.search);
    if (filters.assignee && filters.assignee !== 'all') {
      params.append('assignee', filters.assignee);
    }
    if (filters.type && filters.type !== 'all') {
      params.append('type', filters.type);
    }
    if (filters.status && filters.status !== 'all') {
      params.append('status', filters.status);
    }
    
    const queryString = params.toString();
    const endpoint = queryString ? `/tickets?${queryString}` : '/tickets';
    
    return await this.makeRequest(endpoint);
  },

  async getTicketDetails(key) {
    return await this.makeRequest(`/tickets/${key}/details`);
  },

  async createTicket(data) {
    return await this.makeRequest('/tickets', {
      method: 'POST',
      body: JSON.stringify({
        summary: data.summary,
        description: data.description,
        issueType: data.issueType,  // Cohérent avec l'API
        priority: data.priority,
        assignee: data.assignee
      }),
    });
  },

  async updateTicket(key, data) {
    const payload = {};
    if (data.summary && data.summary.trim()) {
      payload.summary = data.summary.trim();
    }
    if (data.description && data.description.trim()) {
      payload.description = data.description.trim();
    }
    if (data.priority) {
      payload.priority = data.priority;
    }
    if (data.issueType) {
      payload.issueType = data.issueType;  // Cohérent
    }
    if (data.assignee) {
      payload.assignee = data.assignee;
    }
    
    return await this.makeRequest(`/tickets/${key}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async deleteTicket(key) {
    return await this.makeRequest(`/tickets/${key}`, {
      method: 'DELETE',
    });
  },

  async getTransitions(key) {
    return await this.makeRequest(`/tickets/${key}/transitions`);
  },

  async transitionTicket(key, transitionName, comment = null) {
    const payload = { transition_name: transitionName };
    if (comment && comment.trim()) {
      payload.comment = comment.trim();
    }
    
    return await this.makeRequest(`/tickets/${key}/transition`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async getStats() {
    return await this.makeRequest('/stats');
  },

  async healthCheck() {
    return await this.makeRequest('/health');
  }
};

// Fonction utilitaire pour parser les informations du ticket depuis le format string
const parseTicketInfo = (ticketString) => {
  try {
    const parts = ticketString.split(': ');
    if (parts.length < 2) return null;
    
    const key = parts[0].trim();
    const rest = parts[1];
    
    // Extraire les parties entre crochets avec regex améliorée
    const bracketRegex = /\[([^\]]+)\]/g;
    const brackets = [];
    let match;
    while ((match = bracketRegex.exec(rest)) !== null) {
      brackets.push(match[1]);
    }
    
    if (brackets.length >= 3) {
      // Format: "KEY: SUMMARY [ASSIGNEE] [TYPE] [PRIORITY]"
      const assignee = brackets[0] === 'Unassigned' ? 'Non assigné' : brackets[0];
      const issueType = brackets[1];
      const priority = brackets[2] || 'Medium';
      
      // Extraire le summary (tout avant le premier crochet)
      const summaryMatch = rest.match(/^(.+?)\s*\[/);
      const summary = summaryMatch ? summaryMatch[1].trim() : rest.trim();
      
      return {
        key,
        summary,
        assignee,
        issueType,
        priority
      };
    } else if (brackets.length >= 2) {
      // Ancien format sans priorité
      const assignee = brackets[0] === 'Unassigned' ? 'Non assigné' : brackets[0];
      const issueType = brackets[1];
      
      const summaryMatch = rest.match(/^(.+?)\s*\[/);
      const summary = summaryMatch ? summaryMatch[1].trim() : rest.trim();
      
      return {
        key,
        summary,
        assignee,
        issueType,
        priority: 'Medium' // Priorité par défaut
      };
    }
  } catch (error) {
    console.error('Erreur parsing ticket:', error);
  }
  return null;
};

// Components existants (LoadingSpinner, StatusBadge, Modal, etc.)
const LoadingSpinner = ({ size = 'md' }) => {
  return (
    <div className={`jira-spinner jira-spinner-${size}`}></div>
  );
};

const StatusBadge = ({ status }) => {
  const getStatusClass = (status) => {
    const normalizedStatus = status.toUpperCase().replace(/[^A-Z]/g, '');
    
    switch (normalizedStatus) {
      case 'TODO':
      case 'AFAIRE':
      case 'OPEN':
        return 'jira-status-todo';
      case 'INPROGRESS':
      case 'ENCOURS':
      case 'PROGRESS':
        return 'jira-status-progress';
      case 'DONE':
      case 'TERMINE':
      case 'TERMINEES':
      case 'CLOSED':
      case 'RESOLVED':
        return 'jira-status-done';
      default:
        return 'jira-status-other';
    }
  };
  
  const getStatusIcon = (status) => {
    const normalizedStatus = status.toUpperCase().replace(/[^A-Z]/g, '');
    
    switch (normalizedStatus) {
      case 'TODO':
      case 'AFAIRE':
      case 'OPEN':
        return Clock;
      case 'INPROGRESS':
      case 'ENCOURS':
      case 'PROGRESS':
        return RefreshCw;
      case 'DONE':
      case 'TERMINE':
      case 'TERMINEES':
      case 'CLOSED':
      case 'RESOLVED':
        return CheckCircle;
      default:
        return Tag;
    }
  };
  
  const statusClass = getStatusClass(status);
  const Icon = getStatusIcon(status);
  
  return (
    <span className={`jira-status-badge ${statusClass}`}>
      <Icon size={12} />
      {status}
    </span>
  );
};

// TicketCard amélioré pour extraire correctement les types
const TicketCard = ({ ticket, onEdit, onDelete, onTransition }) => {
  const ticketInfo = parseTicketInfo(ticket);
  
  if (!ticketInfo) {
    // Fallback pour l'ancien format
    const key = ticket.split(':')[0].trim();
    const rest = ticket.slice(key.length + 1).replace(/^:\s*/, '');
    const summary = rest.split(' [')[0];
    const assignee = rest.match(/\[(.*?)\]/)?.[1] || 'Unassigned';
    
    return (
      <div className="jira-ticket-card">
        <div className="jira-ticket-header">
          <div className="jira-flex-1 jira-min-w-0">
            <div className="jira-ticket-meta">
              <span className="jira-ticket-key">{key}</span>
              <span>•</span>
              <div className="jira-ticket-assignee">
                <User size={10} />
                {assignee}
              </div>
            </div>
            <p className="jira-ticket-summary">{summary}</p>
          </div>
          
          <div className="jira-ticket-actions">
            <button
              onClick={() => onEdit(key)}
              className="jira-ticket-action"
              title="Modifier"
            >
              <Edit size={14} />
            </button>
            <button
              onClick={() => onTransition(key)}
              className="jira-ticket-action success"
              title="Changer statut"
            >
              <ArrowRight size={14} />
            </button>
            <button
              onClick={() => onDelete(key)}
              className="jira-ticket-action danger"
              title="Supprimer"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="jira-ticket-card">
      <div className="jira-ticket-header">
        <div className="jira-flex-1 jira-min-w-0">
          <div className="jira-ticket-meta">
            <span className="jira-ticket-key">{ticketInfo.key}</span>
            <span>•</span>
            <div className="jira-ticket-assignee">
              <User size={10} />
              {ticketInfo.assignee}
            </div>
            <span>•</span>
            <span className="jira-ticket-type" title="Type de ticket">
              {ticketInfo.issueType}
            </span>
          </div>
          <p className="jira-ticket-summary">{ticketInfo.summary}</p>
        </div>
        
        <div className="jira-ticket-actions">
          <button
            onClick={() => onEdit(ticketInfo.key)}
            className="jira-ticket-action"
            title="Modifier"
          >
            <Edit size={14} />
          </button>
          <button
            onClick={() => onTransition(ticketInfo.key)}
            className="jira-ticket-action success"
            title="Changer statut"
          >
            <ArrowRight size={14} />
          </button>
          <button
            onClick={() => onDelete(ticketInfo.key)}
            className="jira-ticket-action danger"
            title="Supprimer"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  
  return (
    <div className="jira-modal-overlay">
      <div className="jira-modal">
        <div className="jira-modal-header">
          <h2 className="jira-modal-title">{title}</h2>
          <button onClick={onClose} className="jira-modal-close">
            <X size={20} />
          </button>
        </div>
        <div className="jira-modal-body">
          {children}
        </div>
      </div>
    </div>
  );
};

// CreateTicketModal amélioré
const CreateTicketModal = ({ isOpen, onClose, onSubmit, loading, assignees }) => {
  const [formData, setFormData] = useState({
    summary: '',
    description: '',
    issueType: 'Task',
    priority: 'Medium',
    assignee: ''
  });
  const [errors, setErrors] = useState({});
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = {};
    
    if (!formData.summary.trim()) {
      newErrors.summary = 'Le résumé est requis';
    }
    
    if (!formData.issueType.trim()) {
      newErrors.issueType = 'Le type de ticket est requis';
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    const success = await onSubmit(formData);
    if (success) {
      setFormData({ 
        summary: '', 
        description: '', 
        issueType: 'Task', 
        priority: 'Medium', 
        assignee: '' 
      });
      setErrors({});
      onClose();
    }
  };
  
  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };
  
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Créer un nouveau ticket">
      <div className="form-compact">
        <form onSubmit={handleSubmit}>
          <div className="jira-form-group">
            <label className="jira-form-label">
              Résumé *
            </label>
            <input
              type="text"
              value={formData.summary}
              onChange={(e) => handleChange('summary', e.target.value)}
              className={`jira-form-input jira-w-full ${errors.summary ? 'border-red-300' : ''}`}
              placeholder="Titre du ticket"
            />
            {errors.summary && (
              <p className="jira-form-error">{errors.summary}</p>
            )}
          </div>
          
          <div className="jira-form-group">
            <label className="jira-form-label">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              className="jira-form-textarea jira-w-full"
              placeholder="Description détaillée du ticket"
            />
          </div>
          
          <div className="jira-form-row-3">
            <div className="jira-form-group">
              <label className="jira-form-label">
                Type *
              </label>
              <select
                value={formData.issueType}
                onChange={(e) => handleChange('issueType', e.target.value)}
                className={`jira-form-select jira-w-full ${errors.issueType ? 'border-red-300' : ''}`}
              >
                <option value="">Sélectionner un type</option>
                <option value="Task">Task</option>
                <option value="Bug">Bug</option>
                <option value="Story">Story</option>
                <option value="Epic">Epic</option>
              </select>
              {errors.issueType && (
                <p className="jira-form-error">{errors.issueType}</p>
              )}
            </div>
            
            <div className="jira-form-group">
              <label className="jira-form-label">
                Priorité
              </label>
              <select
                value={formData.priority}
                onChange={(e) => handleChange('priority', e.target.value)}
                className="jira-form-select jira-w-full"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Highest">Highest</option>
              </select>
            </div>
            
            <div className="jira-form-group">
              <label className="jira-form-label">
                Assigné à
              </label>
              <select
                value={formData.assignee}
                onChange={(e) => handleChange('assignee', e.target.value)}
                className="jira-form-select jira-w-full"
              >
                <option value="">Non assigné</option>
                {assignees.map(assignee => (
                  <option key={assignee} value={assignee}>{assignee}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="jira-form-actions">
            <button
              type="button"
              onClick={onClose}
              className="jira-btn jira-btn-secondary"
              disabled={loading}
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="jira-btn jira-btn-primary"
            >
              {loading && <LoadingSpinner size="sm" />}
              {loading ? 'Création...' : 'Créer le ticket'}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
};

// EditTicketModal amélioré avec gestion correcte des types
const EditTicketModal = ({ isOpen, onClose, onSubmit, loading, ticketKey, assignees }) => {
  const [formData, setFormData] = useState({
    summary: '',
    description: '',
    priority: '',
    issueType: '',
    assignee: '',
    status: '',
    created: '',
    updated: ''
  });
  const [errors, setErrors] = useState({});
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [originalData, setOriginalData] = useState({});

  // Fonction pour parser l'ADF en texte brut
  const parseADFDescription = (adf) => {
    if (!adf || typeof adf !== 'object' || !adf.content) return '';
    try {
      return adf.content
        .map((para) =>
          para.content
            ? para.content.map((text) => text?.text || '').join(' ')
            : ''
        )
        .filter((text) => text)
        .join('\n') || '';
    } catch (error) {
      console.error('Error parsing ADF:', error);
      return '';
    }
  };

  // Charger les détails du ticket
  useEffect(() => {
    if (isOpen && ticketKey) {
      loadTicketDetails();
    } else {
      setFormData({
        summary: '',
        description: '',
        priority: '',
        issueType: '',
        assignee: '',
        status: '',
        created: '',
        updated: ''
      });
      setErrors({});
    }
  }, [isOpen, ticketKey]);

  const loadTicketDetails = async () => {
    setDetailsLoading(true);
    try {
      const response = await apiService.getTicketDetails(ticketKey);
      if (response?.success && response.ticket) {
        const ticket = response.ticket;
        
        const getAssigneeName = (assigneeData) => {
          if (!assigneeData) return '';
          if (typeof assigneeData === 'string') {
            return assigneeData === 'Unassigned' ? '' : assigneeData;
          }
          if (typeof assigneeData === 'object') {
            return assigneeData.displayName || 
                  assigneeData.name || 
                  assigneeData.key ||
                  assigneeData.accountId || 
                  assigneeData.emailAddress ||
                  '';
          }
          return '';
        };
        
        const ticketData = {
          summary: ticket.summary || '',
          description: typeof ticket.description === 'object' 
            ? parseADFDescription(ticket.description) 
            : ticket.description || '',
          priority: ticket.priority?.name || ticket.priority || '',
          issueType: ticket.issueType?.name || ticket.issueType || '',
          assignee: getAssigneeName(ticket.assignee),
          status: ticket.status || '',
          created: ticket.created || '',
          updated: ticket.updated || ''
        };
        
        setFormData(ticketData);
        setOriginalData(ticketData);
      }
    } catch (error) {
      console.error('Error loading ticket details:', error);
      setErrors({ general: 'Impossible de charger les détails du ticket' });
    } finally {
      setDetailsLoading(false);
    }
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Vérifier les changements
    const hasChanges = Object.keys(formData).some(key => {
      if (key === 'created' || key === 'updated' || key === 'status') return false;
      return formData[key] !== originalData[key];
    });
    
    if (!hasChanges) {
      setErrors({ general: 'Aucune modification détectée' });
      return;
    }
    
    const success = await onSubmit(ticketKey, formData);
    if (success) {
      onClose();
    }
  };
  
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Modifier ${ticketKey || 'Ticket'}`}>
      {detailsLoading ? (
        <div className="jira-flex jira-items-center jira-justify-center jira-py-12">
          <LoadingSpinner size="sm" />
          <span style={{ marginLeft: '0.5rem', fontSize: '0.875rem', color: '#64748b' }}>
            Chargement des détails...
          </span>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          {errors.general && (
            <div className="jira-alert jira-alert-error">
              <AlertCircle size={20} />
              <p>{errors.general}</p>
            </div>
          )}
          
          <div className="jira-form-group">
            <label className="jira-form-label">
              Clé du ticket
            </label>
            <input
              type="text"
              value={ticketKey || ''}
              className="jira-form-input jira-w-full readonly-field"
              readOnly
            />
          </div>
          
          <div className="jira-form-group">
            <label className="jira-form-label">
              Résumé
            </label>
            <input
              type="text"
              value={formData.summary}
              onChange={(e) => setFormData(prev => ({ ...prev, summary: e.target.value }))}
              className="jira-form-input jira-w-full"
              placeholder="Titre du ticket"
            />
          </div>
          
          <div className="jira-form-group">
            <label className="jira-form-label">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="jira-form-textarea jira-w-full"
              placeholder="Description détaillée"
            />
          </div>
          
          <div className="jira-form-group">
            <label className="jira-form-label">
              Statut
            </label>
            <div className="jira-form-input readonly-field" style={{ display: 'flex', alignItems: 'center' }}>
              {formData.status ? <StatusBadge status={formData.status} /> : 'Inconnu'}
            </div>
          </div>
          
          <div className="jira-form-row-3">
            <div className="jira-form-group">
              <label className="jira-form-label">
                Type
              </label>
              <select
                value={formData.issueType}
                onChange={(e) => setFormData(prev => ({ ...prev, issueType: e.target.value }))}
                className="jira-form-select jira-w-full"
              >
                <option value="">Sélectionner un type</option>
                <option value="Task">Task</option>
                <option value="Bug">Bug</option>
                <option value="Story">Story</option>
                <option value="Epic">Epic</option>
              </select>
            </div>
            
            <div className="jira-form-group">
              <label className="jira-form-label">
                Priorité
              </label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value }))}
                className="jira-form-select jira-w-full"
              >
                <option value="">Sélectionner une priorité</option>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Highest">Highest</option>
              </select>
            </div>
            
            <div className="jira-form-group">
              <label className="jira-form-label">
                Assigné à
              </label>
              <select
                value={formData.assignee}
                onChange={(e) => setFormData(prev => ({ ...prev, assignee: e.target.value }))}
                className="jira-form-select jira-w-full"
              >
                <option value="">Non assigné</option>
                {assignees.map(assignee => (
                  <option key={assignee} value={assignee}>{assignee}</option>
                ))}
              </select>
            </div>
          </div>
          
          {formData.created && (
            <div className="jira-form-row">
              <div className="jira-form-group">
                <label className="jira-form-label">
                  Créé le
                </label>
                <input
                  type="text"
                  value={new Date(formData.created).toLocaleDateString('fr-FR')}
                  className="jira-form-input jira-w-full readonly-field"
                  readOnly
                />
              </div>
              
              {formData.updated && (
                <div className="jira-form-group">
                  <label className="jira-form-label">
                    Modifié le
                  </label>
                  <input
                    type="text"
                    value={new Date(formData.updated).toLocaleDateString('fr-FR')}
                    className="jira-form-input jira-w-full readonly-field"
                    readOnly
                  />
                </div>
              )}
            </div>
          )}
          
          <div className="jira-form-actions">
            <button
              type="button"
              onClick={onClose}
              className="jira-btn jira-btn-secondary"
              disabled={loading}
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading || detailsLoading}
              className="jira-btn jira-btn-primary"
            >
              {loading && <LoadingSpinner size="sm" />}
              {loading ? 'Mise à jour...' : 'Mettre à jour'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
};

const TransitionModal = ({ isOpen, onClose, onSubmit, loading, ticketKey, currentStatus }) => {
  const [selectedTransition, setSelectedTransition] = useState('');
  const [comment, setComment] = useState('');
  const [availableTransitions, setAvailableTransitions] = useState([]);
  const [loadingTransitions, setLoadingTransitions] = useState(false);

  // Reset form when modal opens/closes or ticket changes
  useEffect(() => {
    if (!isOpen) {
      setSelectedTransition('');
      setComment('');
      setAvailableTransitions([]);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && ticketKey) {
      loadTransitions();
    }
  }, [isOpen, ticketKey]);

  const loadTransitions = async () => {
    setLoadingTransitions(true);
    try {
      const response = await apiService.getTransitions(ticketKey);
      if (response.success && response.transitions) {
        setAvailableTransitions(Object.keys(response.transitions));
      } else {
        setAvailableTransitions([]);
      }
    } catch (error) {
      console.error('Error loading transitions:', error);
      setAvailableTransitions([]);
    } finally {
      setLoadingTransitions(false);
    }
  };

  // Vérifier si la transition sélectionnée mène vers "terminé"
  const isTransitionToDone = (transitionName) => {
    const normalizedTransition = transitionName.toLowerCase();
    return normalizedTransition.includes('done') || 
           normalizedTransition.includes('terminé') || 
           normalizedTransition.includes('termine') ||
           normalizedTransition.includes('close') ||
           normalizedTransition.includes('resolve');
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (selectedTransition) {
      const success = await onSubmit(ticketKey, selectedTransition, comment);
      if (success) {
        setSelectedTransition('');
        setComment('');
        onClose();
      }
    }
  };
  
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Changer le statut de ${ticketKey || 'Ticket'}`}>
      <form onSubmit={handleSubmit}>
        <div className="jira-form-group">
          <label className="jira-form-label jira-mb-4">
            Statut actuel: {currentStatus ? <StatusBadge status={currentStatus} /> : <span style={{color: '#64748b'}}>Chargement...</span>}
          </label>
          
          {loadingTransitions ? (
            <div className="jira-flex jira-items-center jira-justify-center jira-py-12">
              <LoadingSpinner size="sm" />
              <span style={{marginLeft: '0.5rem', fontSize: '0.875rem', color: '#64748b'}}>Chargement des transitions...</span>
            </div>
          ) : (
            <>
              <label className="jira-form-label">
                Nouvelle transition
              </label>
              <select
                value={selectedTransition}
                onChange={(e) => setSelectedTransition(e.target.value)}
                className="jira-form-select jira-w-full"
              >
                <option value="">Sélectionner une transition</option>
                {availableTransitions.map(transition => (
                  <option key={transition} value={transition}>{transition}</option>
                ))}
              </select>
            </>
          )}
        </div>
        
        {selectedTransition && isTransitionToDone(selectedTransition) && (
          <div className="done-comment-section">
            <label className="done-comment-label">
              Commentaire de clôture *
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="done-comment-input"
              placeholder="Décrivez brièvement la résolution de cette tâche..."
              required
            />
          </div>
        )}
        
        <div className="jira-form-actions">
          <button
            type="button"
            onClick={onClose}
            className="jira-btn jira-btn-secondary"
            disabled={loading}
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={loading || !selectedTransition || loadingTransitions || (isTransitionToDone(selectedTransition) && !comment.trim())}
            className="jira-btn jira-btn-primary"
          >
            {loading && <LoadingSpinner size="sm" />}
            {loading ? 'Changement...' : 'Changer le statut'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message, loading }) => (
  <Modal isOpen={isOpen} onClose={onClose} title={title}>
    <div>
      <div className="jira-flex jira-items-center jira-gap-3 jira-mb-4">
        <AlertCircle style={{color: '#ef4444', marginTop: '0.125rem'}} size={20} />
        <p style={{color: '#374151'}}>{message}</p>
      </div>
      
      <div className="jira-form-actions">
        <button
          onClick={onClose}
          className="jira-btn jira-btn-secondary"
          disabled={loading}
        >
          Annuler
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className="jira-btn jira-btn-danger"
        >
          {loading && <LoadingSpinner size="sm" />}
          {loading ? 'Suppression...' : 'Supprimer'}
        </button>
      </div>
    </div>
  </Modal>
);

// Main Component avec gestion améliorée des types
export default function JiraManagerPro() {
  const [tickets, setTickets] = useState({});
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('unknown');
  const [filters, setFilters] = useState({
    search: '',
    assignee: 'all',
    type: 'all',
    status: 'all',
    priority: 'all'
  });
  
  // Modal states
  const [modals, setModals] = useState({
    create: false,
    edit: false,
    transition: false,
    confirm: false
  });
  
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  
  const openModal = useCallback((type, ticketKey = null) => {
    console.log('Opening modal:', type, 'for ticket:', ticketKey);
    setSelectedTicket(ticketKey);
    setModals(prev => ({ ...prev, [type]: true }));
  }, []);
  
  const closeModal = useCallback((type) => {
    setModals(prev => ({ ...prev, [type]: false }));
    setSelectedTicket(null);
    setConfirmAction(null);
  }, []);

  // Check API health
  const checkHealth = useCallback(async () => {
    try {
      const response = await apiService.healthCheck();
      setConnectionStatus(response.jira_connection === 'connected' ? 'connected' : 'disconnected');
    } catch (error) {
      setConnectionStatus('error');
    }
  }, []);
  
  const loadTickets = useCallback(async (currentFilters = filters) => {
    try {
      setLoading(true);
      setError('');
      const data = await apiService.getTickets(currentFilters);
      setTickets(data);
    } catch (err) {
      setError(err.message || 'Impossible de charger les tickets');
      setTickets({});
    } finally {
      setLoading(false);
    }
  }, [filters]);
  
  useEffect(() => {
    checkHealth();
    loadTickets();
  }, [checkHealth, loadTickets]);
  
  const handleCreateTicket = async (formData) => {
    setActionLoading(true);
    try {
      const result = await apiService.createTicket(formData);
      if (result.success) {
        await loadTickets();
        return true;
      }
    } catch (err) {
      setError(err.message || 'Erreur lors de la création du ticket');
    } finally {
      setActionLoading(false);
    }
    return false;
  };
  
  const handleEditTicket = async (ticketKey, formData) => {
    setActionLoading(true);
    try {
      const result = await apiService.updateTicket(ticketKey, formData);
      if (result.success) {
        await loadTickets();
        return true;
      }
    } catch (err) {
      setError(err.message || 'Erreur lors de la modification du ticket');
    } finally {
      setActionLoading(false);
    }
    return false;
  };
  
  const handleTransitionTicket = async (ticketKey, transitionName, comment = null) => {
    setActionLoading(true);
    try {
      const result = await apiService.transitionTicket(ticketKey, transitionName, comment);
      if (result.success) {
        await loadTickets();
        return true;
      }
    } catch (err) {
      setError(err.message || 'Erreur lors du changement de statut');
    } finally {
      setActionLoading(false);
    }
    return false;
  };
  
  const handleDeleteTicket = async () => {
    if (!confirmAction?.ticketKey) return;
    
    setActionLoading(true);
    try {
      const result = await apiService.deleteTicket(confirmAction.ticketKey);
      if (result.success) {
        await loadTickets();
        closeModal('confirm');
      }
    } catch (err) {
      setError(err.message || 'Erreur lors de la suppression du ticket');
    } finally {
      setActionLoading(false);
    }
  };
  
  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
    loadTickets(newFilters);
  };
  
  const findTicketStatus = (ticketKey) => {
    for (const [status, ticketList] of Object.entries(tickets)) {
      if (ticketList.some(ticket => ticket.startsWith(ticketKey))) {
        return status;
      }
    }
    return null;
  };

  // Fonction pour ordonner les statuts
  const getOrderedStatuses = (statuses) => {
    const statusOrder = {
      'À faire': 1,
      'A faire': 1,
      'Todo': 1,
      'TO DO': 1,
      'Open': 1,
      'En cours': 2,
      'IN PROGRESS': 2,
      'In Progress': 2,
      'Progress': 2,
      'Terminé': 3,
      'Terminée': 3,
      'Terminées': 3,
      'Done': 3,
      'DONE': 3,
      'Closed': 3,
      'Resolved': 3
    };

    return statuses.sort((a, b) => {
      const orderA = statusOrder[a] || 999;
      const orderB = statusOrder[b] || 999;
      
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      
      // Si même ordre, tri alphabétique
      return a.localeCompare(b);
    });
  };
  
  const statuses = getOrderedStatuses(Object.keys(tickets));
  const totalTickets = Object.values(tickets).flat().length;
  
  // Calculer les options de filtrage avec extraction améliorée des types
  const uniqueAssignees = useMemo(() => {
    const assignees = new Set();
    Object.values(tickets).flat().forEach(ticket => {
      const ticketInfo = parseTicketInfo(ticket);
      if (ticketInfo && ticketInfo.assignee && ticketInfo.assignee !== 'Non assigné') {
        assignees.add(ticketInfo.assignee);
      }
    });
    return Array.from(assignees);
  }, [tickets]);

  const uniqueTypes = useMemo(() => {
    const types = new Set();
    Object.values(tickets).flat().forEach(ticket => {
      const ticketInfo = parseTicketInfo(ticket);
      if (ticketInfo && ticketInfo.issueType) {
        types.add(ticketInfo.issueType);
      }
    });
    return Array.from(types).sort();
  }, [tickets]);

  // Ajouter cette constante pour les priorités disponibles
  const AVAILABLE_PRIORITIES = ['Low', 'Medium', 'High', 'Highest'];
  // Mettre à jour la section de filtrage pour utiliser les priorités disponibles
  const uniquePriorities = useMemo(() => {
    const priorities = new Set();
    Object.values(tickets).flat().forEach(ticket => {
      const ticketInfo = parseTicketInfo(ticket);
      if (ticketInfo && ticketInfo.priority) {
        priorities.add(ticketInfo.priority);
      }
    });
    
    // S'assurer que toutes les priorités disponibles sont incluses
    AVAILABLE_PRIORITIES.forEach(priority => {
      priorities.add(priority);
    });
    
    return Array.from(priorities).sort();
  }, [tickets]);

  const ticketTypes = uniqueTypes.length > 0 ? uniqueTypes : ['Task', 'Bug', 'Story', 'Epic'];
  const allStatuses = statuses;
  
  return (
    <>
      <style>{`
.jira-manager {
  min-height: 100vh;
  background-color: #f8fafc;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.jira-header {
  background: white;
  border-bottom: 1px solid #e2e8f0;
  padding: 1rem 0;
}

.jira-header-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.jira-header-title {
  font-size: 1.875rem;
  font-weight: 700;
  color: #1e293b;
  margin: 0;
}

.jira-header-stats {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: #64748b;
  margin-top: 0.25rem;
}

.jira-status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: #22c55e;
}

.jira-status-indicator.disconnected {
  background-color: #f59e0b;
}

.jira-status-indicator.error {
  background-color: #ef4444;
}

.jira-header-actions {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.jira-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 1.5rem 1rem;
}

.jira-card {
  background: white;
  border-radius: 0.5rem;
  border: 1px solid #e2e8f0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.jira-card-body {
  padding: 1.5rem;
}

.jira-filters {
  display: flex;
  gap: 1rem;
  align-items: center;
  flex-wrap: wrap;
}

.jira-filters-left {
  display: flex;
  gap: 1rem;
  align-items: center;
  flex: 1;
  flex-wrap: wrap;
}

.jira-filters-right {
  min-width: 250px;
}

.jira-filter-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 150px;
}

.jira-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 500;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.2s;
}

.jira-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.jira-btn-primary {
  background-color: #3b82f6;
  color: white;
}

.jira-btn-primary:hover:not(:disabled) {
  background-color: #2563eb;
}

.jira-btn-secondary {
  background-color: white;
  color: #374151;
  border-color: #d1d5db;
}

.jira-btn-secondary:hover:not(:disabled) {
  background-color: #f9fafb;
}

.jira-btn-danger {
  background-color: #ef4444;
  color: white;
}

.jira-btn-danger:hover:not(:disabled) {
  background-color: #dc2626;
}

.jira-form-input,
.jira-form-select,
.jira-form-textarea {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  font-size: 0.875rem;
}

.jira-form-input:focus,
.jira-form-select:focus,
.jira-form-textarea:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.jira-form-textarea {
  resize: vertical;
  min-height: 80px;
}

.jira-grid {
  display: grid;
  gap: 1.5rem;
}

.jira-grid-3 {
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
}

.jira-column {
  background: white;
  border-radius: 0.5rem;
  border: 1px solid #e2e8f0;
  overflow: hidden;
}

.jira-column-header {
  padding: 1rem;
  background-color: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.jira-column-count {
  background-color: #e2e8f0;
  color: #64748b;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
}

.jira-column-body {
  padding: 1rem;
  min-height: 200px;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.jira-ticket-card {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.375rem;
  padding: 0.75rem;
  transition: all 0.2s;
  cursor: pointer;
}

.jira-ticket-card:hover {
  border-color: #3b82f6;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.jira-ticket-header {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
}

.jira-ticket-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: #64748b;
  margin-bottom: 0.5rem;
}

.jira-ticket-key {
  font-weight: 600;
  color: #3b82f6;
}

.jira-ticket-assignee {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.jira-ticket-type {
  font-weight: 500;
  color: #7c3aed;
}

.jira-ticket-summary {
  font-size: 0.875rem;
  font-weight: 500;
  color: #1e293b;
  margin: 0;
  line-height: 1.4;
}

.jira-ticket-actions {
  display: flex;
  gap: 0.25rem;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.2s;
}

.jira-ticket-card:hover .jira-ticket-actions {
  opacity: 1;
}

.jira-ticket-action {
  padding: 0.25rem;
  border: none;
  background: none;
  color: #64748b;
  border-radius: 0.25rem;
  cursor: pointer;
  transition: all 0.2s;
}

.jira-ticket-action:hover {
  background-color: #f1f5f9;
  color: #334155;
}

.jira-ticket-action.success:hover {
  background-color: #dcfce7;
  color: #16a34a;
}

.jira-ticket-action.danger:hover {
  background-color: #fef2f2;
  color: #dc2626;
}

.jira-status-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-weight: 500;
}

.jira-status-todo {
  background-color: #fef3c7;
  color: #92400e;
}

.jira-status-progress {
  background-color: #dbeafe;
  color: #1e40af;
}

.jira-status-done {
  background-color: #dcfce7;
  color: #166534;
}

.jira-status-other {
  background-color: #f3f4f6;
  color: #374151;
}

.jira-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.jira-modal {
  background: white;
  border-radius: 0.5rem;
  max-width: 600px;
  width: 100%;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.jira-modal-header {
  padding: 1.5rem;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.jira-modal-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: #1e293b;
  margin: 0;
}

.jira-modal-close {
  background: none;
  border: none;
  color: #64748b;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 0.25rem;
}

.jira-modal-close:hover {
  background-color: #f1f5f9;
  color: #334155;
}

.jira-modal-body {
  padding: 1.5rem;
  overflow-y: auto;
  flex: 1;
}

.jira-form-group {
  margin-bottom: 1rem;
}

.jira-form-label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
  margin-bottom: 0.5rem;
}

.jira-form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.jira-form-row-3 {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 1rem;
}

.jira-form-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
  margin-top: 1.5rem;
}

.jira-form-error {
  color: #dc2626;
  font-size: 0.75rem;
  margin-top: 0.25rem;
}

.jira-alert {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 1rem;
  border-radius: 0.5rem;
  margin-bottom: 1rem;
}

.jira-alert-error {
  background-color: #fef2f2;
  color: #991b1b;
  border: 1px solid #fecaca;
}

.jira-alert-warning {
  background-color: #fffbeb;
  color: #92400e;
  border: 1px solid #fed7aa;
}

.jira-alert-dismissible {
  position: relative;
}

.jira-alert-dismiss {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 0.25rem;
}

.jira-spinner {
  border: 2px solid #f3f4f6;
  border-top: 2px solid #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.jira-spinner-sm {
  width: 16px;
  height: 16px;
}

.jira-spinner-md {
  width: 24px;
  height: 24px;
}

.jira-spinner-lg {
  width: 32px;
  height: 32px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.jira-empty-state {
  text-align: center;
  padding: 3rem 1rem;
  color: #64748b;
}

.jira-empty-state svg {
  margin: 0 auto 1rem;
  color: #cbd5e1;
}

.jira-empty-state h3 {
  font-size: 1.125rem;
  font-weight: 600;
  color: #374151;
  margin-bottom: 0.5rem;
}

.jira-column-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  color: #9ca3af;
  min-height: 120px;
}

.jira-footer {
  background: white;
  border-top: 1px solid #e2e8f0;
  padding: 1.5rem 0;
  margin-top: 2rem;
  text-align: center;
  font-size: 0.875rem;
  color: #64748b;
}

.jira-status-text {
  margin-left: 0.5rem;
  font-weight: 500;
}

.jira-status-text.connected {
  color: #16a34a;
}

.jira-status-text.disconnected {
  color: #f59e0b;
}

.jira-status-text.error {
  color: #dc2626;
}

.jira-flex {
  display: flex;
}

.jira-items-center {
  align-items: center;
}

.jira-justify-center {
  justify-content: center;
}

.jira-gap-2 {
  gap: 0.5rem;
}

.jira-gap-3 {
  gap: 0.75rem;
}

.jira-py-12 {
  padding: 3rem 0;
}

.jira-mb-4 {
  margin-bottom: 1rem;
}

.jira-min-w-0 {
  min-width: 0;
}

.jira-flex-1 {
  flex: 1;
}

.jira-w-full {
  width: 100%;
}

.animate-spin {
  animation: spin 1s linear infinite;
}

.ticket-details {
  max-height: 400px;
  overflow-y: auto;
}

.ticket-field {
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #e2e8f0;
}

.ticket-field:last-child {
  border-bottom: none;
}

.ticket-field-label {
  font-weight: 600;
  color: #374151;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
}

.ticket-field-value {
  color: #64748b;
  font-size: 0.875rem;
  line-height: 1.5;
}

.ticket-field-value.empty {
  font-style: italic;
  color: #9ca3af;
}

.done-comment-section {
  border-top: 1px solid #e2e8f0;
  padding-top: 1rem;
  margin-top: 1rem;
}

.done-comment-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
  margin-bottom: 0.5rem;
  display: block;
}

.done-comment-input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  resize: vertical;
  min-height: 80px;
}

.done-comment-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-compact {
  padding: 1rem;
}

.form-compact .jira-form-actions {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #e2e8f0;
}

.readonly-field {
  background-color: #f8fafc;
  color: #64748b;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .jira-filters {
    flex-direction: column;
    align-items: stretch;
  }
  
  .jira-filters-left {
    flex-direction: column;
  }
  
  .jira-filters-right {
    min-width: auto;
  }
  
  .jira-form-row,
  .jira-form-row-3 {
    grid-template-columns: 1fr;
  }
}
      `}</style>
      <div className="jira-manager">
        {/* Header */}
        <header className="jira-header">
          <div className="jira-header-content">
            <div className="jira-header-left">
              <h1 className="jira-header-title">Jira Manager Pro</h1>
              <div className="jira-header-stats">
                <span>{totalTickets} tickets</span>
                <span>•</span>
                <span>{statuses.length} statuts</span>
                <span>•</span>
                <div className="jira-flex jira-items-center jira-gap-2">
                  <div className={`jira-status-indicator ${
                    connectionStatus === 'connected' ? '' : 
                    connectionStatus === 'disconnected' ? 'disconnected' : 'error'
                  }`}></div>
                  <span>
                    {connectionStatus === 'connected' ? 'Connecté' : 
                     connectionStatus === 'disconnected' ? 'Déconnecté' : 'Erreur'}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="jira-header-actions">
              <button
                onClick={() => { checkHealth(); loadTickets(); }}
                disabled={loading}
                className="jira-btn jira-btn-secondary jira-btn-icon"
                title="Actualiser"
              >
                <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
              </button>
              
              <button
                onClick={() => openModal('create')}
                className="jira-btn jira-btn-primary"
                disabled={connectionStatus !== 'connected'}
              >
                <Plus size={18} />
                Nouveau ticket
              </button>
            </div>
          </div>
        </header>
        
        {/* Connection Warning */}
        {connectionStatus !== 'connected' && (
          <div className="jira-container">
            <div className="jira-alert jira-alert-warning">
              <AlertCircle size={20} />
              <div>
                <p style={{fontWeight: 500}}>
                  {connectionStatus === 'disconnected' ? 'Connexion Jira déconnectée' : 'Erreur de connexion'}
                </p>
                <p style={{fontSize: '0.875rem'}}>
                  Vérifiez que l'API est démarrée et que la configuration Jira est correcte.
                </p>
              </div>
            </div>
          </div>
        )}
        
        {/* Filters */}
        <div className="jira-container">
          <div className="jira-card jira-mb-4">
            <div className="jira-card-body">
              <div className="jira-filters">
                <div className="jira-filters-left">
                  <div className="jira-filter-group">
                    <Filter size={18} style={{color: '#64748b'}} />
                    <select
                      value={filters.type}
                      onChange={(e) => handleFilterChange({ ...filters, type: e.target.value })}
                      className="jira-form-select"
                    >
                      <option value="all">Tous les types</option>
                      {ticketTypes.map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>

                  <div className="jira-filter-group">
                    <AlertCircle size={18} style={{color: '#64748b'}} />
                    <select
                      value={filters.priority}
                      onChange={(e) => handleFilterChange({ ...filters, priority: e.target.value })}
                      className="jira-form-select"
                    >
                      <option value="all">Toutes les priorités</option>
                      {AVAILABLE_PRIORITIES.map(priority => (
                        <option key={priority} value={priority}>{priority}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="jira-filter-group">
                    <Tag size={18} style={{color: '#64748b'}} />
                    <select
                      value={filters.status}
                      onChange={(e) => handleFilterChange({ ...filters, status: e.target.value })}
                      className="jira-form-select"
                    >
                      <option value="all">Tous les statuts</option>
                      {allStatuses.map(status => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="jira-filter-group">
                    <User size={18} style={{color: '#64748b'}} />
                    <select
                      value={filters.assignee}
                      onChange={(e) => handleFilterChange({ ...filters, assignee: e.target.value })}
                      className="jira-form-select"
                    >
                      <option value="all">Tous les assignés</option>
                      <option value="unassigned">Non assignés</option>
                      {uniqueAssignees.map(assignee => (
                        <option key={assignee} value={assignee}>{assignee}</option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <div className="jira-filters-right">
                  <div className="jira-filter-group">
                    <Search size={18} style={{color: '#64748b'}} />
                    <input
                      type="text"
                      placeholder="Rechercher des tickets..."
                      value={filters.search}
                      onChange={(e) => handleFilterChange({ ...filters, search: e.target.value })}
                      className="jira-form-input"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Error Message */}
          {error && (
            <div className="jira-alert jira-alert-error jira-alert-dismissible">
              <AlertCircle size={20} />
              <span>{error}</span>
              <button
                onClick={() => setError('')}
                className="jira-alert-dismiss"
              >
                <X size={18} />
              </button>
            </div>
          )}
          
          {/* Loading State */}
          {loading ? (
            <div className="jira-flex jira-items-center jira-justify-center jira-py-12">
              <LoadingSpinner size="lg" />
              <span style={{marginLeft: '0.75rem', color: '#64748b'}}>Chargement des tickets...</span>
            </div>
          ) : (
            /* Tickets Grid */
            <div className="jira-grid jira-grid-3">
              {statuses.length === 0 ? (
                <div className="jira-empty-state" style={{gridColumn: '1 / -1'}}>
                  <Tag size={48} />
                  <h3>Aucun ticket trouvé</h3>
                  <p>
                    {connectionStatus === 'connected' 
                      ? 'Créez votre premier ticket pour commencer' 
                      : 'Vérifiez la connexion à Jira'}
                  </p>
                  {connectionStatus === 'connected' && (
                    <button
                      onClick={() => openModal('create')}
                      className="jira-btn jira-btn-primary"
                    >
                      <Plus size={18} />
                      Créer un ticket
                    </button>
                  )}
                </div>
              ) : (
                statuses.map(status => (
                  <div key={status} className="jira-column">
                    <div className="jira-column-header">
                      <StatusBadge status={status} />
                      <span className="jira-column-count">
                        {tickets[status]?.length || 0}
                      </span>
                    </div>
                    
                    <div className="jira-column-body">
                      {tickets[status]?.length === 0 ? (
                        <div className="jira-column-empty">
                          <Clock size={24} />
                          <p>Aucun ticket</p>
                        </div>
                      ) : (
                        tickets[status]?.map((ticket, index) => {
                          const ticketInfo = parseTicketInfo(ticket);
                          const ticketKey = ticketInfo ? ticketInfo.key : ticket.split(':')[0].trim();
                          return (
                            <TicketCard
                              key={`${ticketKey}-${index}`}
                              ticket={ticket}
                              onEdit={(key) => openModal('edit', key)}
                              onDelete={(key) => {
                                setConfirmAction({
                                  ticketKey: key,
                                  title: 'Supprimer le ticket',
                                  message: `Êtes-vous sûr de vouloir supprimer le ticket ${key} ? Cette action est irréversible.`
                                });
                                openModal('confirm');
                              }}
                              onTransition={(key) => openModal('transition', key)}
                            />
                          );
                        })
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
        
        {/* Modals */}
        <CreateTicketModal
          isOpen={modals.create}
          onClose={() => closeModal('create')}
          onSubmit={handleCreateTicket}
          loading={actionLoading}
          assignees={uniqueAssignees}
        />
        
        <EditTicketModal
          isOpen={modals.edit}
          onClose={() => closeModal('edit')}
          onSubmit={handleEditTicket}
          loading={actionLoading}
          ticketKey={selectedTicket}
          assignees={uniqueAssignees}
        />
        
        <TransitionModal
          isOpen={modals.transition}
          onClose={() => closeModal('transition')}
          onSubmit={handleTransitionTicket}
          loading={actionLoading}
          ticketKey={selectedTicket}
          currentStatus={selectedTicket ? findTicketStatus(selectedTicket) : null}
        />
        
        <ConfirmModal
          isOpen={modals.confirm}
          onClose={() => closeModal('confirm')}
          onConfirm={handleDeleteTicket}
          loading={actionLoading}
          title={confirmAction?.title || ''}
          message={confirmAction?.message || ''}
        />
        
        {/* Footer */}
        <footer className="jira-footer">
          <div className="jira-container">
            <p>Jira Manager Pro - Interface moderne pour la gestion de tickets</p>
            <p>
              API Status: 
              <span className={`jira-status-text ${
                connectionStatus === 'connected' ? 'connected' : 
                connectionStatus === 'disconnected' ? 'disconnected' : 'error'
              }`}>
                {connectionStatus === 'connected' ? 'Connecté à Jira' : 
                 connectionStatus === 'disconnected' ? 'Jira déconnecté' : 'Erreur de connexion'}
              </span>
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}