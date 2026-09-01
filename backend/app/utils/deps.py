import os
import time
import requests
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.config import settings
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

security = HTTPBearer(auto_error=False)

CLERK_API_URL = "https://api.clerk.com/v1"
SCOPES = ["https://www.googleapis.com/auth/drive.readonly"]

# caches verified tokens briefly since clerk verification is two API calls per request
_CLERK_TOKEN_CACHE_TTL_SECONDS = 60
_clerk_token_cache: dict[str, tuple[float, dict]] = {}

def get_google_drive_service_from_clerk(user_id: str, clerk_secret: str):
    try:
        headers = {
            "Authorization": f"Bearer {clerk_secret}",
            "Content-Type": "application/json"
        }

        response = requests.get(
            f"{CLERK_API_URL}/users/{user_id}/oauth_access_tokens/google",
            headers=headers,
            timeout=10
        )
        
        print(f"OAuth token response status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"OAuth token data: {data}")

            if data and len(data) > 0:
                token_data = data[0]
                access_token = token_data.get('token')

                if access_token:
                    print(f"Found Google access token")

                    creds = Credentials(
                        token=access_token,
                        token_uri="https://oauth2.googleapis.com/token",
                        client_id=settings.GOOGLE_CLIENT_ID,
                        client_secret=settings.GOOGLE_CLIENT_SECRET,
                        scopes=SCOPES
                    )

                    service = build('drive', 'v3', credentials=creds)
                    return service
        else:
            print(f"Failed to get OAuth token: {response.text}")

        return None
    except Exception as e:
        print(f"Error getting Google Drive service from Clerk: {e}")
        import traceback
        traceback.print_exc()
        return None

def verify_clerk_token(token: str) -> dict | None:
    cached = _clerk_token_cache.get(token)
    if cached and time.time() - cached[0] < _CLERK_TOKEN_CACHE_TTL_SECONDS:
        return cached[1]

    result = _verify_clerk_token_uncached(token)
    if result:
        _clerk_token_cache[token] = (time.time(), result)
    return result

def _verify_clerk_token_uncached(token: str) -> dict | None:
    try:
        from app.config import settings
        clerk_secret = settings.CLERK_SECRET_KEY
        if not clerk_secret:
            print("CLERK_SECRET_KEY not set in settings")
            return None

        headers = {
            "Authorization": f"Bearer {clerk_secret}",
            "Content-Type": "application/json"
        }

        print(f"Verifying token with Clerk API...")

        import jwt
        try:
            decoded = jwt.decode(token, options={"verify_signature": False})
            session_id = decoded.get('sid')
            print(f"Decoded session_id: {session_id}")
        except Exception as e:
            print(f"Failed to decode JWT: {e}")
            session_id = None

        verify_headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }

        if session_id:
            response = requests.get(
                f"{CLERK_API_URL}/sessions/{session_id}",
                headers=headers,
                timeout=10
            )
        else:
            response = requests.get(
                f"{CLERK_API_URL}/me",
                headers=verify_headers,
                timeout=10
            )

        print(f"Clerk verify response status: {response.status_code}")

        if response.status_code == 200:
            data = response.json()
            print(f"Session data: {data}")

            if 'id' in data and 'user_id' in data:
                user_id = data.get('user_id')
            elif 'id' in data:
                user_id = data.get('id')
            else:
                user_id = None

            if user_id:
                print(f"User ID: {user_id}")
                user_response = requests.get(
                    f"{CLERK_API_URL}/users/{user_id}",
                    headers=headers,
                    timeout=10
                )

                if user_response.status_code == 200:
                    user_data = user_response.json()
                    email = None
                    if user_data.get('email_addresses'):
                        email = user_data['email_addresses'][0].get('email_address')

                    print(f"Found user email: {email}")
                    return {
                        'user_id': user_id,
                        'email': email,
                        'first_name': user_data.get('first_name'),
                        'last_name': user_data.get('last_name'),
                        'external_accounts': user_data.get('external_accounts', []),
                        'full_user_data': user_data
                    }
        else:
            print(f"Clerk verify failed: {response.status_code} - {response.text}")

        return None
    except Exception as e:
        print(f"Clerk verification error: {e}")
        import traceback
        traceback.print_exc()
        return None

def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    token = None
    if credentials:
        token = credentials.credentials
    else:
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]

    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No authentication token provided")

    clerk_data = verify_clerk_token(token)

    if clerk_data:
        clerk_user_id = clerk_data['user_id']
        email = clerk_data.get('email') or f"{clerk_user_id}@clerk.user"

        user = db.query(User).filter(User.email == email).first()

        if not user:
            import secrets
            from app.utils.auth import hash_password

            user = User(
                email=email,
                password_hash=hash_password(secrets.token_hex(32)),
            )
            db.add(user)
            db.commit()
            db.refresh(user)

            from app.services.workspace import link_pending_invites
            link_pending_invites(db, user)

        user._clerk_data = clerk_data

        return user

    # falls back to legacy JWT if not a clerk token, kept for old sessions
    from app.utils.auth import decode_token
    user_id = decode_token(token)
    
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    
    return user
