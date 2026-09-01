from sqlalchemy.orm import Session
from app.models.user import User, Workspace, WorkspaceMember

ROLE_RANK = {"viewer": 0, "editor": 1, "owner": 2}

def link_pending_invites(db: Session, user: User):
    # a workspace owner can invite someone before they ever sign up; once that
    # email creates an account, attach it to any invites waiting for it
    pending = db.query(WorkspaceMember).filter(
        WorkspaceMember.invited_email == user.email,
        WorkspaceMember.user_id.is_(None)
    ).all()
    for invite in pending:
        invite.user_id = user.id
        invite.status = "active"
    if pending:
        db.commit()

def get_membership(db: Session, workspace_id: int, user_id: int) -> WorkspaceMember | None:
    return db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == workspace_id,
        WorkspaceMember.user_id == user_id,
        WorkspaceMember.status == "active"
    ).first()

def get_active_workspace_id(db: Session, user: User) -> int | None:
    """Returns the workspace the user is currently working in, or None for their personal space."""
    if not user.current_workspace_id:
        return None
    if not get_membership(db, user.current_workspace_id, user.id):
        return None  # stale pointer (removed from workspace) - fall back to personal
    return user.current_workspace_id

def require_role(db: Session, workspace_id: int, user: User, min_role: str) -> WorkspaceMember:
    membership = get_membership(db, workspace_id, user.id)
    if not membership or ROLE_RANK.get(membership.role, -1) < ROLE_RANK[min_role]:
        raise PermissionError("Not allowed")
    return membership

def list_workspaces_for_user(db: Session, user: User) -> list[dict]:
    memberships = db.query(WorkspaceMember).filter(
        WorkspaceMember.user_id == user.id,
        WorkspaceMember.status == "active"
    ).all()
    result = []
    for m in memberships:
        workspace = db.query(Workspace).filter(Workspace.id == m.workspace_id).first()
        if workspace:
            member_count = db.query(WorkspaceMember).filter(
                WorkspaceMember.workspace_id == workspace.id,
                WorkspaceMember.status == "active"
            ).count()
            result.append({"id": workspace.id, "name": workspace.name, "role": m.role, "member_count": member_count})
    return result

def create_workspace(db: Session, user: User, name: str) -> Workspace:
    workspace = Workspace(name=name, owner_id=user.id)
    db.add(workspace)
    db.commit()
    db.refresh(workspace)

    db.add(WorkspaceMember(workspace_id=workspace.id, user_id=user.id, invited_email=user.email, role="owner", status="active"))
    db.commit()
    return workspace

def invite_member(db: Session, workspace_id: int, email: str, role: str) -> WorkspaceMember:
    existing = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == workspace_id,
        WorkspaceMember.invited_email == email
    ).first()
    if existing:
        existing.role = role
        db.commit()
        return existing

    invited_user = db.query(User).filter(User.email == email).first()
    member = WorkspaceMember(
        workspace_id=workspace_id,
        invited_email=email,
        role=role,
        user_id=invited_user.id if invited_user else None,
        status="active" if invited_user else "invited",
    )
    db.add(member)
    db.commit()
    db.refresh(member)
    return member
