#!/usr/bin/env python3
"""
Script to pull EPL matchweek data from Manifold Markets API
Outputs JSON in format compatible with the frontend
"""
import requests
import json
import os
import sys
import argparse
from typing import Optional, Dict, Any, List
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Manifold Markets API base URL
BASE_URL = "https://api.manifold.markets/v0"

def get_api_key() -> Optional[str]:
    """Get API key from environment variable or .env file"""
    api_key = os.getenv('MANIFOLD_API_KEY')
    if api_key:
        return api_key
    
    # Try to read from .env file
    try:
        with open('.env', 'r') as f:
            for line in f:
                if line.startswith('MANIFOLD_API_KEY='):
                    return line.split('=', 1)[1].strip().strip('"').strip("'")
    except FileNotFoundError:
        pass
    
    return None

def make_request(endpoint: str, params: Optional[Dict[str, Any]] = None, api_key: Optional[str] = None, silent: bool = False) -> Dict[str, Any]:
    """Make a request to the Manifold Markets API"""
    url = f"{BASE_URL}/{endpoint}"
    headers = {}
    
    if api_key:
        headers['Authorization'] = f'Key {api_key}'
    
    try:
        response = requests.get(url, headers=headers, params=params)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.HTTPError as e:
        if e.response.status_code == 404 and silent:
            raise
        if not silent:
            print(f"Error making request: {e}", file=sys.stderr)
        raise
    except requests.exceptions.RequestException as e:
        if not silent:
            print(f"Error making request: {e}", file=sys.stderr)
        raise

def get_matchweek_market(matchweek: int, api_key: Optional[str] = None, silent: bool = False) -> Optional[Dict[str, Any]]:
    """Fetch a specific EPL matchweek market by week number"""
    slug = f"english-premier-league-matchweek-{matchweek}"
    try:
        market = make_request(f'slug/{slug}', api_key=api_key, silent=silent)
        return market
    except requests.exceptions.HTTPError as e:
        if e.response.status_code == 404:
            return None
        if not silent:
            print(f"Error fetching matchweek {matchweek}: {e}", file=sys.stderr)
        return None
    except Exception as e:
        if not silent:
            print(f"Error fetching matchweek {matchweek}: {e}", file=sys.stderr)
        return None

def get_open_matchweeks_from(start_week: int = 11, max_weeks: int = 20, api_key: Optional[str] = None) -> Dict[str, Any]:
    """Fetch all open matchweek markets from a starting week onwards"""
    open_markets = {}
    
    for week in range(start_week, start_week + max_weeks):
        try:
            market = get_matchweek_market(week, api_key=api_key, silent=True)
            if market:
                is_resolved = market.get('isResolved', False)
                if not is_resolved:
                    open_markets[f"matchweek_{week}"] = market
            else:
                # Market doesn't exist (404) - stop checking further weeks
                break
        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 404:
                break
        except Exception:
            continue
    
    return open_markets

def extract_team_names_from_text(text: str) -> tuple:
    """Extract team names from match text like 'Arsenal vs Liverpool'"""
    text_lower = text.lower()
    
    # Common EPL team names
    teams = [
        'manchester city', 'manchester united', 'liverpool', 'chelsea', 
        'arsenal', 'tottenham', 'newcastle', 'brighton', 'crystal palace', 
        'everton', 'fulham', 'brentford', 'west ham', 'aston villa', 
        'wolves', 'wolverhampton', 'bournemouth', 'burnley', 'nottingham forest',
        'leeds', 'sunderland', 'leicester', 'southampton', 'luton', 'sheffield united'
    ]
    
    # Try to find two teams in the text
    found_teams = []
    for team in teams:
        if team in text_lower:
            found_teams.append(team.title())
    
    # If we found exactly 2 teams, return them
    if len(found_teams) >= 2:
        return (found_teams[0], found_teams[1])
    elif len(found_teams) == 1:
        # Try to split by common separators
        separators = [' vs ', ' v ', ' vs. ', ' @ ', ' - ', ' – ']
        for sep in separators:
            if sep in text:
                parts = text.split(sep)
                if len(parts) >= 2:
                    return (parts[0].strip(), parts[1].strip())
        return (found_teams[0], 'Unknown')
    
    # Fallback: try to split by common separators
    separators = [' vs ', ' v ', ' vs. ', ' @ ', ' - ', ' – ']
    for sep in separators:
        if sep in text:
            parts = text.split(sep)
            if len(parts) >= 2:
                return (parts[0].strip(), parts[1].strip())
    
    return ('Team 1', 'Team 2')

def convert_manifold_to_frontend_format(markets_dict: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Convert Manifold market format to frontend-compatible format"""
    frontend_markets = []
    current_time = datetime.now().timestamp() * 1000  # Current time in milliseconds
    
    for week_key, market in markets_dict.items():
        week_num = week_key.replace('matchweek_', '')
        answers = market.get('answers', [])
        
        # Get market close time (in milliseconds since epoch)
        close_time = market.get('closeTime', None)
        is_resolved = market.get('isResolved', False)
        
        # Skip if market is resolved or has passed
        if is_resolved:
            continue
        
        # Skip if close_time exists and is in the past
        if close_time and close_time < current_time:
            continue
        
        # Group answers by match (extract team names from answer text)
        for answer in answers:
            answer_text = answer.get('text', '')
            probability = answer.get('probability', 0)
            volume = answer.get('volume', 0)
            
            # Skip markets with probability > 95% (essentially resolved) or <= 0% (no chance)
            if probability > 0.95 or probability <= 0:
                continue
            
            # Extract team names from answer text
            team1, team2 = extract_team_names_from_text(answer_text)
            
            # Create a unique ID for this match entry (market_id + answer text)
            # This ensures each match has a unique identifier even if they share the same market_id
            import hashlib
            unique_id = hashlib.md5(f"{market.get('id', '')}-{answer_text}".encode()).hexdigest()[:12]
            
            # Create a market entry
            market_entry = {
                'market_id': market.get('id', ''),
                'unique_id': unique_id,  # Unique identifier for this specific match entry
                'question': market.get('question', ''),
                'url': market.get('url', ''),
                'matchweek': int(week_num),
                'match_text': answer_text,
                'team1': team1,
                'team2': team2,
                'probability': probability,
                'volume': volume,
                'is_resolved': is_resolved,
                'close_time': close_time,
                'created_time': market.get('createdTime', None),
            }
            
            frontend_markets.append(market_entry)
    
    return frontend_markets

def main():
    parser = argparse.ArgumentParser(description='Fetch EPL matchweek markets from Manifold')
    parser.add_argument('--start-week', type=int, default=11, help='Starting matchweek (default: 11)')
    parser.add_argument('--max-weeks', type=int, default=20, help='Maximum weeks to check (default: 20)')
    parser.add_argument('--api-key', help='Manifold API key (or set MANIFOLD_API_KEY env var)')
    parser.add_argument('--limit', type=int, help='Limit number of results (not used, kept for compatibility)')
    
    args = parser.parse_args()
    
    # Get API key
    api_key = args.api_key or get_api_key()
    
    try:
        # Fetch open matchweek markets
        open_markets = get_open_matchweeks_from(args.start_week, args.max_weeks, api_key)
        
        if not open_markets:
            # Return empty result
            result = {
                'error': None,
                'markets': []
            }
            print(json.dumps(result, indent=2))
            return 0
        
        # Convert to frontend format
        frontend_markets = convert_manifold_to_frontend_format(open_markets)
        
        result = {
            'error': None,
            'markets': frontend_markets
        }
        
        print(json.dumps(result, indent=2))
        return 0
        
    except Exception as e:
        result = {
            'error': str(e),
            'markets': []
        }
        print(json.dumps(result, indent=2), file=sys.stderr)
        return 1

if __name__ == '__main__':
    sys.exit(main())

