"""
Cost Tracking Service
Monitor LLM API usage and costs
"""
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from app.models.user import CostTracking, BudgetSetting
from app.utils.logger import log_info, log_error
from app.services.user_settings import base_provider

# Provider pricing (per 1K tokens)
# Updated regularly as prices change
PROVIDER_PRICING = {
    "mistral": {
        "chat": {
            "input": Decimal("0.0001"),   # $0.10 per 1M tokens = $0.0001 per 1K
            "output": Decimal("0.0003"),  # $0.30 per 1M tokens
        },
        "embedding": {
            "input": Decimal("0.00002"),  # $0.02 per 1M tokens
        }
    },
    "ollama": {
        "chat": {
            "input": Decimal("0"),  # Free (local)
            "output": Decimal("0"),
        },
        "embedding": {
            "input": Decimal("0"),
        }
    }
}

def calculate_cost(provider: str, operation: str, input_tokens: int, output_tokens: int = 0) -> Decimal:
    """Calculate cost based on provider and token usage.

    `provider` may be a specific model id (e.g. "ollama-llama3:8b"); it's
    collapsed to its base provider ("ollama") before the pricing lookup so
    per-model ids don't miss the table and fall through to paid defaults.
    """
    try:
        pricing = PROVIDER_PRICING.get(base_provider(provider.lower()), {})
        
        if operation == "embedding":
            # Embeddings only have input tokens
            input_price = pricing.get("embedding", {}).get("input", Decimal("0"))
            cost = (Decimal(input_tokens) / 1000) * input_price
        else:
            # Chat has both input and output
            input_price = pricing.get("chat", {}).get("input", Decimal("0.001"))
            output_price = pricing.get("chat", {}).get("output", Decimal("0.003"))
            
            input_cost = (Decimal(input_tokens) / 1000) * input_price
            output_cost = (Decimal(output_tokens) / 1000) * output_price
            cost = input_cost + output_cost
        
        return round(cost, 6)
        
    except Exception as e:
        log_error(f"Error calculating cost: {str(e)}")
        return Decimal("0")

def track_cost(
    db: Session,
    user_id: int,
    provider: str,
    operation: str,
    input_tokens: int = 0,
    output_tokens: int = 0,
    metadata: Optional[Dict[str, Any]] = None
) -> CostTracking:
    """Track a single API call cost"""
    try:
        total_tokens = input_tokens + output_tokens
        cost = calculate_cost(provider, operation, input_tokens, output_tokens)
        
        tracking = CostTracking(
            user_id=user_id,
            provider=provider.lower(),
            operation=operation,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=total_tokens,
            cost_usd=cost,
            extra_data=str(metadata) if metadata else None,
            created_at=datetime.utcnow()
        )
        
        db.add(tracking)
        db.commit()
        
        log_info(f"Tracked cost for user {user_id}: {provider}/{operation} = ${cost} ({total_tokens} tokens)")
        
        # Check if budget alert needed
        check_budget_alert(db, user_id)
        
        return tracking
        
    except Exception as e:
        log_error(f"Error tracking cost: {str(e)}")
        db.rollback()
        raise

def get_user_cost_stats(db: Session, user_id: int, days: int = 30) -> Dict[str, Any]:
    """Get cost statistics for a user over the last N days"""
    try:
        since = datetime.utcnow() - timedelta(days=days)
        
        # Total cost
        total_cost = db.query(func.sum(CostTracking.cost_usd)).filter(
            and_(CostTracking.user_id == user_id, CostTracking.created_at >= since)
        ).scalar() or Decimal("0")
        
        # Total tokens
        total_tokens = db.query(func.sum(CostTracking.total_tokens)).filter(
            and_(CostTracking.user_id == user_id, CostTracking.created_at >= since)
        ).scalar() or 0
        
        # Total requests
        total_requests = db.query(func.count(CostTracking.id)).filter(
            and_(CostTracking.user_id == user_id, CostTracking.created_at >= since)
        ).scalar() or 0
        
        # Cost by provider
        by_provider = db.query(
            CostTracking.provider,
            func.sum(CostTracking.cost_usd).label("cost"),
            func.sum(CostTracking.total_tokens).label("tokens"),
            func.count(CostTracking.id).label("requests")
        ).filter(
            and_(CostTracking.user_id == user_id, CostTracking.created_at >= since)
        ).group_by(CostTracking.provider).all()
        
        # Cost by operation
        by_operation = db.query(
            CostTracking.operation,
            func.sum(CostTracking.cost_usd).label("cost"),
            func.sum(CostTracking.total_tokens).label("tokens")
        ).filter(
            and_(CostTracking.user_id == user_id, CostTracking.created_at >= since)
        ).group_by(CostTracking.operation).all()
        
        # Daily breakdown
        daily = db.query(
            func.date(CostTracking.created_at).label("date"),
            func.sum(CostTracking.cost_usd).label("cost"),
            func.sum(CostTracking.total_tokens).label("tokens")
        ).filter(
            and_(CostTracking.user_id == user_id, CostTracking.created_at >= since)
        ).group_by(func.date(CostTracking.created_at)).order_by("date").all()
        
        # Today's cost
        today = datetime.utcnow().date()
        today_cost = db.query(func.sum(CostTracking.cost_usd)).filter(
            and_(
                CostTracking.user_id == user_id,
                func.date(CostTracking.created_at) == today
            )
        ).scalar() or Decimal("0")
        
        # This month's cost
        current_month = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        month_cost = db.query(func.sum(CostTracking.cost_usd)).filter(
            and_(
                CostTracking.user_id == user_id,
                CostTracking.created_at >= current_month
            )
        ).scalar() or Decimal("0")
        
        return {
            "total_cost": float(total_cost),
            "total_tokens": int(total_tokens),
            "total_requests": int(total_requests),
            "today_cost": float(today_cost),
            "month_cost": float(month_cost),
            "by_provider": [
                {
                    "provider": p.provider,
                    "cost": float(p.cost),
                    "tokens": int(p.tokens),
                    "requests": int(p.requests)
                }
                for p in by_provider
            ],
            "by_operation": [
                {
                    "operation": o.operation,
                    "cost": float(o.cost),
                    "tokens": int(o.tokens)
                }
                for o in by_operation
            ],
            "daily": [
                {
                    "date": str(d.date),
                    "cost": float(d.cost),
                    "tokens": int(d.tokens)
                }
                for d in daily
            ],
            "period_days": days
        }
        
    except Exception as e:
        log_error(f"Error getting cost stats: {str(e)}")
        return {}

def get_or_create_budget(db: Session, user_id: int) -> BudgetSetting:
    """Get or create budget settings for a user"""
    budget = db.query(BudgetSetting).filter(BudgetSetting.user_id == user_id).first()
    
    if not budget:
        budget = BudgetSetting(
            user_id=user_id,
            monthly_budget=Decimal("50.00"),
            alert_threshold=Decimal("0.80")
        )
        db.add(budget)
        db.commit()
        db.refresh(budget)
    
    return budget

def update_budget(
    db: Session,
    user_id: int,
    monthly_budget: Optional[float] = None,
    alert_threshold: Optional[float] = None,
    alert_email: Optional[str] = None
) -> BudgetSetting:
    """Update budget settings"""
    budget = get_or_create_budget(db, user_id)
    
    if monthly_budget is not None:
        budget.monthly_budget = Decimal(str(monthly_budget))
    
    if alert_threshold is not None:
        budget.alert_threshold = Decimal(str(alert_threshold))
    
    if alert_email is not None:
        budget.alert_email = alert_email
    
    budget.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(budget)
    
    return budget

def check_budget_alert(db: Session, user_id: int) -> Optional[Dict[str, Any]]:
    """Check if user is approaching budget limit and should be alerted"""
    try:
        budget = get_or_create_budget(db, user_id)
        
        # Get current month's cost
        current_month = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        month_cost = db.query(func.sum(CostTracking.cost_usd)).filter(
            and_(
                CostTracking.user_id == user_id,
                CostTracking.created_at >= current_month
            )
        ).scalar() or Decimal("0")
        
        # Calculate percentage
        if budget.monthly_budget > 0:
            percentage = float(month_cost) / float(budget.monthly_budget)
        else:
            percentage = 0
        
        # Check if alert should be sent
        threshold = float(budget.alert_threshold)
        should_alert = percentage >= threshold
        
        # Check if we already sent alert recently (within 24 hours)
        if should_alert and budget.last_alert_sent:
            hours_since_alert = (datetime.utcnow() - budget.last_alert_sent).total_seconds() / 3600
            if hours_since_alert < 24:
                should_alert = False
        
        alert_info = {
            "should_alert": should_alert,
            "monthly_budget": float(budget.monthly_budget),
            "current_cost": float(month_cost),
            "percentage": round(percentage * 100, 2),
            "threshold_percentage": float(threshold * 100)
        }
        
        if should_alert:
            # Update last alert sent
            budget.last_alert_sent = datetime.utcnow()
            db.commit()
            
            log_info(f"Budget alert triggered for user {user_id}: {alert_info['percentage']}% of budget used")
        
        return alert_info
        
    except Exception as e:
        log_error(f"Error checking budget alert: {str(e)}")
        return None

def get_global_cost_stats(db: Session, days: int = 30) -> Dict[str, Any]:
    """Get global cost statistics across all users"""
    try:
        since = datetime.utcnow() - timedelta(days=days)
        
        # Total platform cost
        total_cost = db.query(func.sum(CostTracking.cost_usd)).filter(
            CostTracking.created_at >= since
        ).scalar() or Decimal("0")
        
        # Total tokens
        total_tokens = db.query(func.sum(CostTracking.total_tokens)).filter(
            CostTracking.created_at >= since
        ).scalar() or 0
        
        # Total requests
        total_requests = db.query(func.count(CostTracking.id)).filter(
            CostTracking.created_at >= since
        ).scalar() or 0
        
        # Top users by cost
        top_users = db.query(
            CostTracking.user_id,
            func.sum(CostTracking.cost_usd).label("cost"),
            func.sum(CostTracking.total_tokens).label("tokens")
        ).filter(
            CostTracking.created_at >= since
        ).group_by(CostTracking.user_id).order_by(func.sum(CostTracking.cost_usd).desc()).limit(10).all()
        
        return {
            "total_cost": float(total_cost),
            "total_tokens": int(total_tokens),
            "total_requests": int(total_requests),
            "top_users": [
                {
                    "user_id": u.user_id,
                    "cost": float(u.cost),
                    "tokens": int(u.tokens)
                }
                for u in top_users
            ]
        }
        
    except Exception as e:
        log_error(f"Error getting global stats: {str(e)}")
        return {}
