from sqlalchemy.orm import Session
from app.models.user import User, Space, SpaceMember
from app.services.workspace import get_membership as get_workspace_membership

ROLE_RANK = {"viewer": 0, "editor": 1, "owner": 2}

def get_space_membership(db: Session, space_id: int, user_id: int) -> SpaceMember | None:
    return db.query(SpaceMember).filter(
        SpaceMember.space_id == space_id,
        SpaceMember.user_id == user_id
    ).first()

def get_active_space_id(db: Session, user: User) -> int | None:
    if not user.current_space_id:
        return None
    if not get_space_membership(db, user.current_space_id, user.id):
        return None
    return user.current_space_id

def require_space_role(db: Session, space_id: int, user: User, min_role: str) -> SpaceMember:
    membership = get_space_membership(db, space_id, user.id)
    if not membership or ROLE_RANK.get(membership.role, -1) < ROLE_RANK[min_role]:
        raise PermissionError("Not allowed")
    return membership

def list_spaces_for_workspace(db: Session, workspace_id: int, user: User) -> list[dict]:
    memberships = db.query(SpaceMember).join(Space, Space.id == SpaceMember.space_id).filter(
        Space.workspace_id == workspace_id,
        SpaceMember.user_id == user.id
    ).all()
    result = []
    for m in memberships:
        space = db.query(Space).filter(Space.id == m.space_id).first()
        if space:
            member_count = db.query(SpaceMember).filter(SpaceMember.space_id == space.id).count()
            result.append({"id": space.id, "name": space.name, "role": m.role, "member_count": member_count})
    return result

def create_space(db: Session, workspace_id: int, user: User, name: str) -> Space:
    space = Space(workspace_id=workspace_id, name=name, created_by=user.id)
    db.add(space)
    db.commit()
    db.refresh(space)

    db.add(SpaceMember(space_id=space.id, user_id=user.id, role="owner"))
    db.commit()
    return space

def add_space_member(db: Session, space_id: int, workspace_id: int, email: str, role: str) -> SpaceMember:
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise ValueError("No account found with that email")

    # the person being added must already belong to the parent workspace, a space narrows access, it doesn't grant new access
    if not get_workspace_membership(db, workspace_id, user.id):
        raise ValueError("This person is not a member of the workspace yet")

    existing = get_space_membership(db, space_id, user.id)
    if existing:
        existing.role = role
        db.commit()
        return existing

    member = SpaceMember(space_id=space_id, user_id=user.id, role=role)
    db.add(member)
    db.commit()
    db.refresh(member)
    return member
