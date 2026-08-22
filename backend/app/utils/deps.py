import os
import requests
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.config import settings

security = HTTPBearer(auto_error=False)

CLERK_API_URL = "https://api.clerk.com/v1"

def verify_clerk_token(token: str) -> dict | None:
    """Verify a Clerk JWT token using Clerk's API."""
    try:
        from app.config import settings
        clerk_secret = settings.CLERK_SECRET_KEY
        if not clerk_secret:
            print("CLERK_SECRET_KEY not set in settings")
            return None
        
        # Call Clerk's sessions/verify endpoint
        headers = {
            "Authorization": f"Bearer {clerk_secret}",
            "Content-Type": "application/json"
        }
        
        print(f"Verifying token with Clerk API...")
        
        # Try to decode the JWT first to get session ID
        import jwt
        try:
            decoded = jwt.decode(token, options={"verify_signature": False})
            session_id = decoded.get('sid')  # Session ID
            print(f"Decoded session_id: {session_id}")
        except Exception as e:
            print(f"Failed to decode JWT: {e}")
            session_id = None
        
        # Verify using the token directly with GET request
        # Clerk expects the token in the Authorization header
        verify_headers = {
            "Authorization": f"Bearer {token}",  # Use user's token, not secret
            "Content-Type": "application/json"
        }
        
        # Try retrieving the session
        if session_id:
            response = requests.get(
                f"{CLERK_API_URL}/sessions/{session_id}",
                headers=headers,  # Use secret key for admin access
                timeout=10
            )
        else:
            # Fallback: try to validate by getting current user info
            response = requests.get(
                f"{CLERK_API_URL}/me",
                headers=verify_headers,  # Use user's token
                timeout=10
            )
        
        print(f"Clerk verify response status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Session data: {data}")
            
            # Handle different response formats
            if 'id' in data and 'user_id' in data:
                # Session object format
                user_id = data.get('user_id')
            elif 'id' in data:
                # User object format (from /me endpoint)
                user_id = data.get('id')
            else:
                user_id = None
            
            if user_id:
                print(f"User ID: {user_id}")
                # Get user details from Clerk
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
                        'last_name': user_data.get('last_name')
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
    """Get current user from either Clerk token or legacy JWT."""
    
    # Get token from header
    token = None
    if credentials:
        token = credentials.credentials
    else:
        # Try to get from Authorization header directly
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
    
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No authentication token provided")
    
    # First, try to verify as Clerk token
    clerk_data = verify_clerk_token(token)
    
    if clerk_data:
        # Find or create user by Clerk ID
        clerk_user_id = clerk_data['user_id']
        email = clerk_data.get('email') or f"{clerk_user_id}@clerk.user"
        
        # Look for existing user by email
        user = db.query(User).filter(User.email == email).first()
        
        if not user:
            # Create new user
            import secrets
            from app.utils.auth import hash_password
            
            user = User(
                email=email,
                password_hash=hash_password(secrets.token_hex(32)),  # Random password
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        
        return user
    
    # Fall back to legacy JWT verification
    from app.utils.auth import decode_token
    user_id = decode_token(token)
    
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    
    return user
