from slack_sdk import WebClient
from slack_sdk.errors import SlackApiError
from app.utils.logger import log_error, log_info

def get_slack_client(bot_token: str):
    return WebClient(token=bot_token)

def get_slack_channels(bot_token: str) -> list[dict]:
    try:
        client = get_slack_client(bot_token)
        result = client.conversations_list(types="public_channel,private_channel")
        channels = result["channels"]
        return [{
            "id": c["id"],
            "name": c["name"],
            "is_private": c.get("is_private", False)
        } for c in channels if c.get("name")]
    except SlackApiError as e:
        log_error(f"Failed to get Slack channels: {str(e)}")
        return []

def get_channel_messages(bot_token: str, channel_id: str, limit: int = 100) -> list[dict]:
    try:
        client = get_slack_client(bot_token)
        result = client.conversations_history(channel=channel_id, limit=limit)
        messages = result["messages"]
        
        return [{
            "user": msg.get("user"),
            "text": msg.get("text"),
            "ts": msg.get("ts"),
            "timestamp": msg.get("ts")
        } for msg in messages]
    except SlackApiError as e:
        log_error(f"Failed to get channel messages: {str(e)}")
        return []

def get_channel_history_text(bot_token: str, channel_id: str, limit: int = 100) -> str:
    try:
        messages = get_channel_messages(bot_token, channel_id, limit)
        text_parts = []
        for msg in messages:
            if msg.get("text"):
                text_parts.append(f"User {msg.get('user')}: {msg.get('text')}")
        return "\n".join(text_parts)
    except Exception as e:
        log_error(f"Failed to get channel history text: {str(e)}")
        return ""

def search_slack_messages(bot_token: str, query: str) -> list[dict]:
    try:
        client = get_slack_client(bot_token)
        result = client.search_messages(query=query, count=20)
        matches = result["messages"]["matches"]
        
        return [{
            "channel": m.get("channel", {}).get("name"),
            "text": m.get("text"),
            "ts": m.get("ts"),
            "user": m.get("user")
        } for m in matches]
    except SlackApiError as e:
        log_error(f"Failed to search Slack messages: {str(e)}")
        return []

def get_slack_user_info(bot_token: str, user_id: str) -> dict:
    try:
        client = get_slack_client(bot_token)
        result = client.users_info(user=user_id)
        user = result["user"]
        return {
            "id": user["id"],
            "name": user["name"],
            "real_name": user.get("real_name"),
            "email": user.get("profile", {}).get("email")
        }
    except SlackApiError as e:
        log_error(f"Failed to get user info: {str(e)}")
        return {}