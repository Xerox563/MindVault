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
        clerk_secret = os.getenv('CLERK_SECRET_KEY', '')
        if not clerk_secret:
            print("CLERK_SECRET_KEY not set")
            return None
        
        # Call Clerk's sessions/verify endpoint
        headers = {
            "Authorization": f"Bearer {clerk_secret}",
            "Content-Type": "application/json"
        }
        
        response = requests.post(
            f"{CLERK_API_URL}/sessions/verify",
            headers=headers,
            json={"token": token},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get('status') == 'active':
                user_id = data.get('user_id')
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
                    
                    return {
                        'user_id': user_id,
                        'email': email,
                        'first_name': user_data.get('first_name'),
                        'last_name': user_data.get('last_name')
                    }
        
        return None
    except Exception as e:
        print(f"Clerk verification error: {e}")
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
