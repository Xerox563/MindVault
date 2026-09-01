from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User, Workspace, WorkspaceMember
from app.utils.deps import get_current_user
from app.services.workspace import (
    list_workspaces_for_user, create_workspace, invite_member,
    get_membership, require_role, get_active_workspace_id
)
from app.services.email import send_workspace_invite_email

router = APIRouter(prefix="/api/workspaces", tags=["workspaces"])

@router.get("")
def list_workspaces(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return {
        "workspaces": list_workspaces_for_user(db, current_user),
        "active_workspace_id": get_active_workspace_id(db, current_user),
    }

@router.post("")
def create(payload: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    name = (payload.get("name") or "").strip()
    if not name:
        raise HTTPException(400, "Workspace name is required")
    workspace = create_workspace(db, current_user, name)
    current_user.current_workspace_id = workspace.id
    db.commit()
    return {"id": workspace.id, "name": workspace.name, "role": "owner", "member_count": 1}

@router.post("/switch")
def switch(payload: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    workspace_id = payload.get("workspace_id")
    if workspace_id is not None and not get_membership(db, workspace_id, current_user.id):
        raise HTTPException(403, "You are not a member of this workspace")
    current_user.current_workspace_id = workspace_id
    db.commit()
    return {"active_workspace_id": current_user.current_workspace_id}

@router.get("/{workspace_id}/members")
def list_members(workspace_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not get_membership(db, workspace_id, current_user.id):
        raise HTTPException(403, "You are not a member of this workspace")
    members = db.query(WorkspaceMember).filter(WorkspaceMember.workspace_id == workspace_id).all()
    return [
        {"id": m.id, "email": m.invited_email, "role": m.role, "status": m.status}
        for m in members
    ]

@router.post("/{workspace_id}/invite")
def invite(workspace_id: int, payload: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        require_role(db, workspace_id, current_user, "owner")
    except PermissionError:
        raise HTTPException(403, "Only the workspace owner can invite members")

    email = (payload.get("email") or "").strip().lower()
    role = payload.get("role") or "viewer"
    if role not in ("editor", "viewer"):
        raise HTTPException(400, "Role must be 'editor' or 'viewer'")
    if not email:
        raise HTTPException(400, "Email is required")

    member = invite_member(db, workspace_id, email, role)

    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    send_workspace_invite_email(email, workspace.name, current_user.email, role)

    return {"id": member.id, "email": member.invited_email, "role": member.role, "status": member.status}

@router.delete("/{workspace_id}/members/{member_id}")
def remove_member(workspace_id: int, member_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        require_role(db, workspace_id, current_user, "owner")
    except PermissionError:
        raise HTTPException(403, "Only the workspace owner can remove members")

    member = db.query(WorkspaceMember).filter(WorkspaceMember.id == member_id, WorkspaceMember.workspace_id == workspace_id).first()
    if not member:
        raise HTTPException(404, "Member not found")
    if member.role == "owner":
        raise HTTPException(400, "Cannot remove the workspace owner")

    db.delete(member)
    db.commit()
    return {"message": "Member removed"}
