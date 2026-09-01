import requests
from app.config import settings
from app.utils.logger import log_info, log_error

BREVO_API_URL = "https://api.brevo.com/v3/smtp/email"

def send_email(to_email: str, subject: str, html_content: str) -> bool:
    # never raises, a failed email should not break the request that triggered it
    if not settings.BREVO_API_KEY:
        log_info(f"Skipping email to {to_email} ({subject}): no BREVO_API_KEY configured")
        return False

    try:
        response = requests.post(
            BREVO_API_URL,
            headers={
                "api-key": settings.BREVO_API_KEY,
                "Content-Type": "application/json",
                "accept": "application/json",
            },
            json={
                "sender": {"name": settings.BREVO_SENDER_NAME, "email": settings.BREVO_SENDER_EMAIL},
                "to": [{"email": to_email}],
                "subject": subject,
                "htmlContent": html_content,
            },
            timeout=10,
        )
        if response.status_code in (200, 201):
            log_info(f"Sent email to {to_email}: {subject}")
            return True
        log_error(f"Brevo email failed ({response.status_code}): {response.text}")
        return False
    except Exception as e:
        log_error(f"Error sending email via Brevo: {e}")
        return False

def send_workspace_invite_email(to_email: str, workspace_name: str, inviter_email: str, role: str):
    subject = f"{inviter_email} invited you to \"{workspace_name}\" on MindVault"
    html = f"""
    <p>{inviter_email} invited you to join <strong>{workspace_name}</strong> on MindVault as a <strong>{role}</strong>.</p>
    <p>Sign in with this email address at <a href="{settings.FRONTEND_URL}">{settings.FRONTEND_URL}</a> to get access.</p>
    """
    send_email(to_email, subject, html)

def send_budget_alert_email(to_email: str, percentage: float, current_cost: float, monthly_budget: float):
    subject = f"MindVault budget alert: {percentage:.0f}% of your monthly budget used"
    html = f"""
    <p>You've used <strong>${current_cost:.2f}</strong> of your <strong>${monthly_budget:.2f}</strong> monthly budget ({percentage:.0f}%).</p>
    <p>Check your usage at <a href="{settings.FRONTEND_URL}/cost">{settings.FRONTEND_URL}/cost</a>.</p>
    """
    send_email(to_email, subject, html)
