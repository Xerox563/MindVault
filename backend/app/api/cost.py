"""
Cost Monitoring API Endpoints
Dashboard for tracking LLM usage and costs
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import Optional
from app.database import get_db
from app.models.user import User
from app.utils.deps import get_current_user
from app.services.cost import (
    get_user_cost_stats, get_or_create_budget, update_budget,
    check_budget_alert, get_global_cost_stats
)
from app.core.rate_limit import limiter

router = APIRouter(prefix="/api/cost", tags=["cost"])

@router.get("/stats")
@limiter.limit("60/minute")
def get_cost_stats(
    request: Request,
    days: int = 30,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get cost statistics for the current user"""
    try:
        stats = get_user_cost_stats(db, current_user.id, days=days)
        budget = get_or_create_budget(db, current_user.id)
        alert = check_budget_alert(db, current_user.id)
        
        return {
            "stats": stats,
            "budget": {
                "monthly_budget": float(budget.monthly_budget),
                "alert_threshold": float(budget.alert_threshold),
                "alert_email": budget.alert_email,
                "last_alert_sent": budget.last_alert_sent.isoformat() if budget.last_alert_sent else None
            },
            "alert": alert,
            "days": days
        }
    except Exception as e:
        raise HTTPException(500, f"Failed to get cost stats: {str(e)}")

@router.get("/daily")
@limiter.limit("60/minute")
def get_daily_cost(
    request: Request,
    days: int = 30,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get daily cost breakdown"""
    try:
        stats = get_user_cost_stats(db, current_user.id, days=days)
        return {
            "daily": stats.get("daily", []),
            "days": days
        }
    except Exception as e:
        raise HTTPException(500, f"Failed to get daily costs: {str(e)}")

@router.get("/by-provider")
@limiter.limit("60/minute")
def get_cost_by_provider(
    request: Request,
    days: int = 30,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get cost breakdown by provider"""
    try:
        stats = get_user_cost_stats(db, current_user.id, days=days)
        return {
            "by_provider": stats.get("by_provider", []),
            "days": days
        }
    except Exception as e:
        raise HTTPException(500, f"Failed to get provider costs: {str(e)}")

@router.get("/budget")
@limiter.limit("60/minute")
def get_budget(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get current budget settings"""
    try:
        budget = get_or_create_budget(db, current_user.id)
        alert = check_budget_alert(db, current_user.id)
        
        return {
            "monthly_budget": float(budget.monthly_budget),
            "alert_threshold": float(budget.alert_threshold),
            "alert_email": budget.alert_email,
            "last_alert_sent": budget.last_alert_sent.isoformat() if budget.last_alert_sent else None,
            "current_usage": alert
        }
    except Exception as e:
        raise HTTPException(500, f"Failed to get budget: {str(e)}")

@router.put("/budget")
@limiter.limit("30/minute")
def update_user_budget(
    request: Request,
    budget_update: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update budget settings"""
    try:
        budget = update_budget(
            db,
            current_user.id,
            monthly_budget=budget_update.get("monthly_budget"),
            alert_threshold=budget_update.get("alert_threshold"),
            alert_email=budget_update.get("alert_email")
        )
        
        return {
            "monthly_budget": float(budget.monthly_budget),
            "alert_threshold": float(budget.alert_threshold),
            "alert_email": budget.alert_email,
            "message": "Budget settings updated successfully"
        }
    except Exception as e:
        raise HTTPException(500, f"Failed to update budget: {str(e)}")

@router.get("/alert-status")
@limiter.limit("60/minute")
def get_alert_status(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Check if user should be alerted about budget"""
    try:
        alert = check_budget_alert(db, current_user.id)
        return alert
    except Exception as e:
        raise HTTPException(500, f"Failed to check alert: {str(e)}")

# Admin endpoints
@router.get("/admin/global-stats")
@limiter.limit("30/minute")
def get_admin_global_stats(
    request: Request,
    days: int = 30,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get global cost statistics (admin only)"""
    # TODO: Add admin check
    try:
        stats = get_global_cost_stats(db, days=days)
        return stats
    except Exception as e:
        raise HTTPException(500, f"Failed to get global stats: {str(e)}")
