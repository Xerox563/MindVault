from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User, Space, SpaceMember
from app.utils.deps import get_current_user
from app.services.workspace import get_membership as get_workspace_membership, require_role
from app.services.space import (
    list_spaces_for_workspace, create_space, add_space_member,
    get_space_membership, require_space_role, get_active_space_id
)

router = APIRouter(prefix="/api/spaces", tags=["spaces"])

@router.get("")
def list_spaces(workspace_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not get_workspace_membership(db, workspace_id, current_user.id):
        raise HTTPException(403, "You are not a member of this workspace")
    return {
        "spaces": list_spaces_for_workspace(db, workspace_id, current_user),
        "active_space_id": get_active_space_id(db, current_user),
    }

@router.post("")
def create(payload: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    workspace_id = payload.get("workspace_id")
    name = (payload.get("name") or "").strip()
    if not workspace_id:
        raise HTTPException(400, "Workspace id is required")
    if not name:
        raise HTTPException(400, "Space name is required")

    try:
        require_role(db, workspace_id, current_user, "editor")
    except PermissionError:
        raise HTTPException(403, "Viewers can't create spaces in this workspace")

    space = create_space(db, workspace_id, current_user, name)
    current_user.current_space_id = space.id
    db.commit()
    return {"id": space.id, "name": space.name, "role": "owner", "member_count": 1}

@router.post("/switch")
def switch(payload: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    space_id = payload.get("space_id")
    if space_id is not None and not get_space_membership(db, space_id, current_user.id):
        raise HTTPException(403, "You are not a member of this space")
    current_user.current_space_id = space_id
    db.commit()
    return {"active_space_id": current_user.current_space_id}

@router.get("/{space_id}/members")
def list_members(space_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not get_space_membership(db, space_id, current_user.id):
        raise HTTPException(403, "You are not a member of this space")
    members = db.query(SpaceMember).filter(SpaceMember.space_id == space_id).all()
    return [{"id": m.id, "user_id": m.user_id, "email": m.user.email, "role": m.role} for m in members]

@router.post("/{space_id}/members")
def invite_member(space_id: int, payload: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        require_space_role(db, space_id, current_user, "owner")
    except PermissionError:
        raise HTTPException(403, "Only the space owner can add members")

    space = db.query(Space).filter(Space.id == space_id).first()
    if not space:
        raise HTTPException(404, "Space not found")

    user_id = payload.get("user_id")
    role = payload.get("role") or "viewer"
    if role not in ("editor", "viewer"):
        raise HTTPException(400, "Role must be 'editor' or 'viewer'")
    if not user_id:
        raise HTTPException(400, "User id is required")

    try:
        member = add_space_member(db, space_id, space.workspace_id, user_id, role)
    except ValueError as e:
        raise HTTPException(400, str(e))

    return {"id": member.id, "user_id": member.user_id, "role": member.role}

@router.delete("/{space_id}/members/{member_id}")
def remove_member(space_id: int, member_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        require_space_role(db, space_id, current_user, "owner")
    except PermissionError:
        raise HTTPException(403, "Only the space owner can remove members")

    member = db.query(SpaceMember).filter(SpaceMember.id == member_id, SpaceMember.space_id == space_id).first()
    if not member:
        raise HTTPException(404, "Member not found")
    if member.role == "owner":
        raise HTTPException(400, "Cannot remove the space owner")

    db.delete(member)
    db.commit()
    return {"message": "Member removed"}
