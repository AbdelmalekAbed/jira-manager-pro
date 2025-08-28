
#!/usr/bin/env python3
"""
Improved Jira API Script
A command-line tool for managing Jira tickets with enhanced error handling and security.
"""

import requests
from requests.auth import HTTPBasicAuth
import json
import os
import sys
from typing import Dict, Optional, List
from dotenv import load_dotenv
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
import logging

load_dotenv()

class JiraManager:
    def __init__(self):
        self.jira_url = os.getenv("JIRA_URL")
        self.email = os.getenv("JIRA_EMAIL")
        self.api_token = os.getenv("JIRA_TOKEN")
        self.project_key = os.getenv("JIRA_PROJECT_KEY")
        
        self.auth = HTTPBasicAuth(self.email, self.api_token)
        self.headers = {"Accept": "application/json", "Content-Type": "application/json"}
        
        # Setup logging
        logging.basicConfig(
            level=logging.INFO,
            filename='jira_manager.log',
            filemode='a',
            format='[%(asctime)s] %(levelname)s in %(module)s: %(message)s'
        )
        self.logger = logging.getLogger(__name__)
        
        # Test connection on initialization
        if not self._test_connection():
            self.logger.error("❌ Failed to connect to Jira. Please check your credentials.")
            print("❌ Failed to connect to Jira. Please check your credentials.")
            sys.exit(1)

    def _test_connection(self) -> bool:
        """Test if the connection to Jira is working."""
        try:
            url = f"{self.jira_url}/rest/api/3/myself"
            response = self._make_request("GET", "myself")
            return response and response.status_code == 200
        except requests.exceptions.RequestException as e:
            self.logger.error(f"Connection test failed: {str(e)}")
            return False

    def _make_request(self, method: str, endpoint: str, **kwargs) -> Optional[requests.Response]:
        """Make a request to Jira API with error handling and retry."""
        url = f"{self.jira_url}/rest/api/3/{endpoint}"
        
        session = requests.Session()
        retry = Retry(
            total=3,
            backoff_factor=0.5,
            status_forcelist=[500, 502, 503, 504]
        )
        adapter = HTTPAdapter(max_retries=retry)
        session.mount('http://', adapter)
        session.mount('https://', adapter)
        
        try:
            response = session.request(method, url, headers=self.headers, auth=self.auth, timeout=30, **kwargs)
            response.raise_for_status()
            self.logger.info(f"Successful request to {endpoint}: {response.status_code}")
            return response
        except requests.exceptions.Timeout as e:
            self.logger.error(f"Request timed out for {endpoint}: {str(e)}")
            print(f"❌ Request timed out for {endpoint}. Please try again.")
        except requests.exceptions.ConnectionError as e:
            self.logger.error(f"Connection error for {endpoint}: {str(e)}")
            print(f"❌ Connection error for {endpoint}. Please check your internet connection.")
        except requests.exceptions.HTTPError as e:
            self.logger.error(f"HTTP error for {endpoint}: {str(e)} - Response: {e.response.text if e.response else 'No response'}")
            print(f"❌ HTTP error for {endpoint}: {e.response.status_code if e.response else 'No response'}")
        except requests.exceptions.RequestException as e:
            self.logger.error(f"Request error for {endpoint}: {str(e)}")
            print(f"❌ Request error for {endpoint}: {e}")
        
        return None

    def get_tickets(self) -> Dict[str, List[str]]:
        """Retrieve and display tickets organized by status with issue type information."""
        self.logger.info("\n🔍 Retrieving tickets...")
        print("\n🔍 Retrieving tickets...")
        
        params = {"jql": f"project={self.project_key} ORDER BY status ASC, created DESC"}
        response = self._make_request("GET", "search", params=params)
        
        if not response:
            return {}
            
        if response.status_code == 200:
            try:
                data = response.json()
                tickets_by_status = {}
                
                for issue in data["issues"]:
                    status = issue["fields"]["status"]["name"]
                    key = issue["key"]
                    summary = issue["fields"]["summary"]
                    assignee = issue["fields"].get("assignee")
                    assignee_name = assignee["displayName"] if assignee else "Unassigned"
                    issue_type = issue["fields"]["issuetype"]["name"]  # Récupérer le type
                    priority = issue["fields"].get("priority")
                    priority_name = priority["name"] if priority else "None"
                    
                    if status not in tickets_by_status:
                        tickets_by_status[status] = []
                    
                    # Format: "KEY: SUMMARY [ASSIGNEE] [TYPE] [PRIORITY]"
                    ticket_string = f"{key}: {summary} [{assignee_name}] [{issue_type}] [{priority_name}]"
                    tickets_by_status[status].append(ticket_string)
                
                # Display results
                if tickets_by_status:
                    for status, tickets in tickets_by_status.items():
                        self.logger.info(f"\n📌 {status} ({len(tickets)}):")
                        print(f"\n📌 {status} ({len(tickets)}):")
                        for ticket in tickets:
                            self.logger.info(f"   - {ticket}")
                            print(f"   - {ticket}")
                else:
                    self.logger.info(f"📋 No tickets found in project {self.project_key}")
                    print(f"📋 No tickets found in project {self.project_key}")
                    
                return tickets_by_status
                
            except (KeyError, json.JSONDecodeError) as e:
                self.logger.error(f"❌ Error parsing response: {e}")
                print(f"❌ Error parsing response: {e}")
        else:
            self.logger.error(f"❌ Error retrieving tickets: {response.status_code} - {response.text}")
            print(f"❌ Error retrieving tickets: {response.status_code}")
            if response.status_code == 400:
                self.logger.info("💡 Check your project key or JQL syntax")
                print("💡 Check your project key or JQL syntax")
            elif response.status_code == 401:
                self.logger.info("💡 Check your credentials")
                print("💡 Check your credentials")
        
        return {}

    def get_issue_types(self) -> List[str]:
        """Retrieve available issue types for the project."""
        response = self._make_request("GET", f"project/{self.project_key}")
        
        if not response or response.status_code != 200:
            self.logger.error(f"❌ Error retrieving issue types: {response.status_code if response else 'No response'}")
            print(f"❌ Error retrieving issue types")
            return []
        
        try:
            data = response.json()
            issue_types = [issue_type["name"] for issue_type in data["issueTypes"] if not issue_type.get("subtask")]
            self.logger.info(f"✅ Available issue types: {', '.join(issue_types)}")
            return issue_types
        except (KeyError, json.JSONDecodeError) as e:
            self.logger.error(f"❌ Error parsing issue types: {e}")
            print(f"❌ Error parsing issue types: {e}")
            return []

    def create_ticket(self, summary: str, description: str, issue_type: str = "Task", 
                     priority: Optional[str] = None, assignee: Optional[str] = None) -> bool:
        """Create a new ticket with validated issue type, priority and assignee."""
        if not summary.strip():
            self.logger.error("❌ Summary cannot be empty")
            print("❌ Summary cannot be empty")
            return False

        # Validate issue type
        available_issue_types = self.get_issue_types()
        if issue_type not in available_issue_types:
            self.logger.error(f"❌ Invalid issue type '{issue_type}'. Available types: {', '.join(available_issue_types)}")
            print(f"❌ Invalid issue type '{issue_type}'. Available types: {', '.join(available_issue_types)}")
            return False

        payload = {
            "fields": {
                "project": {"key": self.project_key},
                "summary": summary.strip(),
                "description": {
                    "type": "doc",
                    "version": 1,
                    "content": [
                        {
                            "type": "paragraph",
                            "content": [{"type": "text", "text": description.strip()}] if description.strip() else []
                        }
                    ]
                },
                "issuetype": {"name": issue_type}
            }
        }

        # Add priority if provided
        if priority and priority.strip():
            payload["fields"]["priority"] = {"name": priority.strip()}

        # Add assignee if provided
        if assignee and assignee.strip():
            payload["fields"]["assignee"] = {"accountId": assignee.strip()}

        response = self._make_request("POST", "issue", json=payload)
        
        if not response:
            return False
            
        if response.status_code == 201:
            try:
                ticket_key = response.json()['key']
                self.logger.info(f"✅ Ticket created: {ticket_key}")
                print(f"✅ Ticket created: {ticket_key}")
                return True
            except (KeyError, json.JSONDecodeError) as e:
                self.logger.error(f"❌ Error parsing response: {e}")
                print("✅ Ticket created successfully")
                return True
        else:
            self.logger.error(f"❌ Error creating ticket: {response.status_code} - {response.text}")
            print(f"❌ Error creating ticket: {response.status_code}")
            if response.status_code == 400:
                try:
                    error_data = response.json()
                    if "errors" in error_data:
                        for field, error in error_data["errors"].items():
                            self.logger.info(f"💡 {field}: {error}")
                            print(f"💡 {field}: {error}")
                except json.JSONDecodeError:
                    pass
        
        return False

    def update_ticket(self, ticket_key: str, new_summary: Optional[str] = None, 
                     new_description: Optional[str] = None, new_issue_type: Optional[str] = None,
                     new_priority: Optional[str] = None, new_assignee: Optional[str] = None) -> bool:
        """Update an existing ticket with optional issue type, priority and assignee."""
        if not ticket_key.strip():
            self.logger.error("❌ Ticket key cannot be empty")
            print("❌ Ticket key cannot be empty")
            return False

        fields = {}
        
        if new_summary and new_summary.strip():
            fields["summary"] = new_summary.strip()
            
        if new_description and new_description.strip():
            fields["description"] = {
                "type": "doc",
                "version": 1,
                "content": [
                    {
                        "type": "paragraph",
                        "content": [{"type": "text", "text": new_description.strip()}]
                    }
                ]
            }

        if new_issue_type and new_issue_type.strip():
            available_issue_types = self.get_issue_types()
            if new_issue_type not in available_issue_types:
                self.logger.error(f"❌ Invalid issue type '{new_issue_type}'. Available types: {', '.join(available_issue_types)}")
                print(f"❌ Invalid issue type '{new_issue_type}'. Available types: {', '.join(available_issue_types)}")
                return False
            fields["issuetype"] = {"name": new_issue_type}

        # Add priority if provided
        if new_priority is not None:
            if new_priority.strip():
                fields["priority"] = {"name": new_priority.strip()}
            else:
                # Pour retirer la priorité, on peut essayer de la mettre à None
                fields["priority"] = None

        # Add assignee if provided
        if new_assignee is not None:
            if new_assignee.strip():
                fields["assignee"] = {"accountId": new_assignee.strip()}
            else:
                # Pour désassigner, on met l'assignee à null
                fields["assignee"] = None

        if not fields:
            self.logger.error("❌ No fields to update")
            print("❌ No fields to update")
            return False

        payload = {"fields": fields}
        response = self._make_request("PUT", f"issue/{ticket_key}", json=payload)
        
        if not response:
            return False
            
        if response.status_code == 204:
            self.logger.info(f"✅ Ticket {ticket_key} updated successfully")
            print(f"✅ Ticket {ticket_key} updated successfully")
            return True
        else:
            self.logger.error(f"❌ Error updating ticket: {response.status_code} - {response.text}")
            print(f"❌ Error updating ticket: {response.status_code}")
            if response.status_code == 404:
                self.logger.info(f"💡 Ticket {ticket_key} not found")
                print(f"💡 Ticket {ticket_key} not found")
            elif response.status_code == 400:
                self.logger.info("💡 Check your input data")
                print("💡 Check your input data")
                try:
                    error_data = response.json()
                    if "errors" in error_data:
                        for field, error in error_data["errors"].items():
                            self.logger.info(f"💡 {field}: {error}")
                            print(f"💡 {field}: {error}")
                except json.JSONDecodeError:
                    pass
        
        return False

    def get_available_transitions(self, ticket_key: str) -> Dict[str, str]:
        """Get available transitions for a ticket."""
        response = self._make_request("GET", f"issue/{ticket_key}/transitions")
        
        if not response or response.status_code != 200:
            self.logger.error(f"❌ Error getting transitions for {ticket_key}: {response.status_code if response else 'No response'}")
            print(f"❌ Error getting transitions for {ticket_key}")
            return {}
        
        try:
            data = response.json()
            transitions = {}
            for transition in data["transitions"]:
                transitions[transition["name"]] = transition["id"]
            self.logger.info(f"✅ Available transitions for {ticket_key}: {', '.join(transitions.keys())}")
            return transitions
        except (KeyError, json.JSONDecodeError) as e:
            self.logger.error(f"❌ Error parsing transitions: {e}")
            print("❌ Error parsing transitions")
            return {}

    def transition_ticket(self, ticket_key: str, transition_name: Optional[str] = None, comment: Optional[str] = None) -> bool:
        """Transition a ticket to a new status, with optional comment for 'Terminé' transitions."""
        if not ticket_key.strip():
            self.logger.error("❌ Ticket key cannot be empty")
            print("❌ Ticket key cannot be empty")
            return False

        # Get available transitions
        transitions = self.get_available_transitions(ticket_key)
        
        if not transitions:
            return False

        # If no specific transition provided, show available options
        if not transition_name:
            print(f"\n🔄 Available transitions for {ticket_key}:")
            for i, (name, trans_id) in enumerate(transitions.items(), 1):
                print(f"{i}. {name}")
            
            try:
                choice = int(input("\nChoose transition (number): ")) - 1
                if 0 <= choice < len(transitions):
                    transition_name = list(transitions.keys())[choice]
                else:
                    self.logger.error("❌ Invalid choice")
                    print("❌ Invalid choice")
                    return False
            except (ValueError, IndexError):
                self.logger.error("❌ Invalid input")
                print("❌ Invalid input")
                return False

        # Check if transition exists
        if transition_name not in transitions:
            self.logger.error(f"❌ Transition '{transition_name}' not available")
            print(f"❌ Transition '{transition_name}' not available")
            print(f"💡 Available transitions: {', '.join(transitions.keys())}")
            return False

        # Add comment if transitioning to 'Terminé' and comment provided
        if 'terminé' in transition_name.lower() and comment and comment.strip():
            comment_payload = {
                "body": {
                    "type": "doc",
                    "version": 1,
                    "content": [
                        {
                            "type": "paragraph",
                            "content": [{"type": "text", "text": comment.strip()}]
                        }
                    ]
                }
            }
            comment_response = self._make_request("POST", f"issue/{ticket_key}/comment", json=comment_payload)
            if not comment_response or comment_response.status_code != 201:
                self.logger.error(f"❌ Error adding comment: {comment_response.status_code if comment_response else 'No response'} - {comment_response.text if comment_response else ''}")
                print(f"❌ Error adding comment: {comment_response.status_code if comment_response else 'No response'}")
                return False
            self.logger.info("✅ Comment added successfully")
            print("✅ Comment added successfully")

        # Perform transition
        payload = {
            "transition": {
                "id": transitions[transition_name]
            }
        }

        response = self._make_request("POST", f"issue/{ticket_key}/transitions", json=payload)
        
        if not response:
            return False
            
        if response.status_code == 204:
            self.logger.info(f"✅ Ticket {ticket_key} transitioned to '{transition_name}' successfully")
            print(f"✅ Ticket {ticket_key} transitioned to '{transition_name}' successfully")
            return True
        else:
            self.logger.error(f"❌ Error transitioning ticket: {response.status_code} - {response.text}")
            print(f"❌ Error transitioning ticket: {response.status_code}")
            if response.status_code == 400:
                self.logger.info("💡 Check if the transition is valid for current status")
                print("💡 Check if the transition is valid for current status")
            elif response.status_code == 404:
                self.logger.info(f"💡 Ticket {ticket_key} not found")
                print(f"💡 Ticket {ticket_key} not found")
        
        return False

    def delete_ticket(self, ticket_key: str) -> bool:
        """Delete a ticket."""
        if not ticket_key.strip():
            self.logger.error("❌ Ticket key cannot be empty")
            print("❌ Ticket key cannot be empty")
            return False

        # Confirmation
        confirm = input(f"⚠️  Are you sure you want to delete {ticket_key}? (y/N): ")
        if confirm.lower() != 'y':
            self.logger.info("❌ Deletion cancelled")
            print("❌ Deletion cancelled")
            return False

        response = self._make_request("DELETE", f"issue/{ticket_key}")
        
        if not response:
            return False
            
        if response.status_code == 204:
            self.logger.info(f"✅ Ticket {ticket_key} deleted successfully")
            print(f"✅ Ticket {ticket_key} deleted successfully")
            return True
        else:
            self.logger.error(f"❌ Error deleting ticket: {response.status_code} - {response.text}")
            print(f"❌ Error deleting ticket: {response.status_code}")
            if response.status_code == 404:
                self.logger.info(f"💡 Ticket {ticket_key} not found")
                print(f"💡 Ticket {ticket_key} not found")
            elif response.status_code == 403:
                self.logger.info("💡 You don't have permission to delete this ticket")
                print("💡 You don't have permission to delete this ticket")
        
        return False

def get_non_empty_input(prompt: str) -> str:
    """Get non-empty input from user."""
    while True:
        value = input(prompt).strip()
        if value:
            return value
        print("❌ This field cannot be empty. Please try again.")

def menu():
    """Interactive menu for Jira operations."""
    print("🚀 Initializing Jira Manager...")
    try:
        jira = JiraManager()
    except KeyboardInterrupt:
        print("\n👋 Goodbye!")
        return
    except Exception as e:
        print(f"❌ Failed to initialize: {e}")
        return

    while True:
        print("\n" + "="*40)
        print("📌 Jira API Manager")
        print("="*40)
        print("1. 📋 List tickets")
        print("2. ➕ Create ticket")
        print("3. ✏️  Modify ticket")
        print("4. 🔄 Change ticket status")
        print("5. 🗑️  Delete ticket")
        print("0. 👋 Exit")
        print("="*40)
        
        choice = input("Choose an option: ").strip()
        
        try:
            if choice == "1":
                jira.get_tickets()
                
            elif choice == "2":
                print("\n➕ Creating new ticket...")
                summary = get_non_empty_input("Summary: ")
                description = input("Description (optional): ")
                issue_type = input("Issue type (default: Task): ").strip() or "Task"
                
                if jira.create_ticket(summary, description, issue_type):
                    print("\n📋 Updated ticket list:")
                    jira.get_tickets()
                    
            elif choice == "3":
                print("\n✏️  Modifying ticket...")
                ticket_key = get_non_empty_input("Ticket key: ")
                new_summary = input("New summary (leave empty to skip): ")
                new_description = input("New description (leave empty to skip): ")
                new_issue_type = input("New issue type (leave empty to skip): ").strip() or None
                
                if jira.update_ticket(ticket_key, new_summary, new_description, new_issue_type):
                    print("\n📋 Updated ticket list:")
                    jira.get_tickets()
                    
            elif choice == "4":
                print("\n🔄 Changing ticket status...")
                ticket_key = get_non_empty_input("Ticket key: ")
                # Get available transitions to check if 'Terminé' is an option
                transitions = jira.get_available_transitions(ticket_key)
                if not transitions:
                    continue
                # Show transitions and get user choice
                print(f"\n🔄 Available transitions for {ticket_key}:")
                for i, (name, trans_id) in enumerate(transitions.items(), 1):
                    print(f"{i}. {name}")
                try:
                    choice = int(input("\nChoose transition (number): ")) - 1
                    if 0 <= choice < len(transitions):
                        transition_name = list(transitions.keys())[choice]
                    else:
                        self.logger.error("❌ Invalid choice")
                        print("❌ Invalid choice")
                        continue
                except (ValueError, IndexError):
                    self.logger.error("❌ Invalid input")
                    print("❌ Invalid input")
                    continue
                # Ask for comment if transitioning to 'Terminé'
                comment = None
                if 'terminé' in transition_name.lower():
                    comment = input("Comment for termination (optional): ").strip() or None
                
                if jira.transition_ticket(ticket_key, transition_name, comment):
                    print("\n📋 Updated ticket list:")
                    jira.get_tickets()
                    
            elif choice == "5":
                print("\n🗑️  Deleting ticket...")
                ticket_key = get_non_empty_input("Ticket key: ")
                
                if jira.delete_ticket(ticket_key):
                    print("\n📋 Updated ticket list:")
                    jira.get_tickets()
                    
            elif choice == "0":
                print("👋 Goodbye!")
                break
                
            else:
                print("❌ Invalid choice. Please try again.")
                
        except KeyboardInterrupt:
            print("\n👋 Goodbye!")
            break
        except Exception as e:
            self.logger.error(f"❌ Unexpected error: {e}")
            print(f"❌ Unexpected error: {e}")

if __name__ == "__main__":
    menu()
