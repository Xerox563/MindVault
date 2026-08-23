from notion_client import Client
from app.utils.logger import log_error, log_info

def get_notion_client(api_key: str):
    return Client(auth=api_key)

def get_notion_databases(api_key: str) -> list[dict]:
    try:
        client = get_notion_client(api_key)
        result = client.search(filter={"property": "object", "value": "database"}, page_size=50)
        
        databases = []
        for item in result.get("results", []):
            if item.get("object") == "database":
                databases.append({
                    "id": item["id"],
                    "title": item["title"][0]["plain_text"] if item.get("title") else "Untitled",
                    "url": item["url"]
                })
        return databases
    except Exception as e:
        log_error(f"Failed to get Notion databases: {str(e)}")
        return []

def get_notion_pages(api_key: str, database_id: str = None) -> list[dict]:
    try:
        client = get_notion_client(api_key)
        
        if database_id:
            result = client.databases.query(database_id=database_id, page_size=50)
        else:
            result = client.search(filter={"property": "object", "value": "page"}, page_size=50)
        
        pages = []
        for item in result.get("results", []):
            title = "Untitled"
            if item.get("properties"):
                for prop_name, prop_data in item["properties"].items():
                    if prop_data.get("type") == "title":
                        title_text = prop_data.get("title", [])
                        if title_text:
                            title = title_text[0].get("plain_text", "Untitled")
            
            pages.append({
                "id": item["id"],
                "title": title,
                "url": item["url"],
                "created_time": item.get("created_time")
            })
        return pages
    except Exception as e:
        log_error(f"Failed to get Notion pages: {str(e)}")
        return []

def get_page_content(api_key: str, page_id: str) -> str:
    try:
        client = get_notion_client(api_key)
        blocks = client.blocks.children.list(block_id=page_id)
        
        text_parts = []
        for block in blocks.get("results", []):
            block_type = block.get("type")
            
            if block_type == "paragraph":
                text = block.get("paragraph", {}).get("rich_text", [])
                if text:
                    text_parts.append("".join([t.get("plain_text", "") for t in text]))
            
            elif block_type == "heading_1":
                text = block.get("heading_1", {}).get("rich_text", [])
                if text:
                    text_parts.append("# " + "".join([t.get("plain_text", "") for t in text]))
            
            elif block_type == "heading_2":
                text = block.get("heading_2", {}).get("rich_text", [])
                if text:
                    text_parts.append("## " + "".join([t.get("plain_text", "") for t in text]))
            
            elif block_type == "heading_3":
                text = block.get("heading_3", {}).get("rich_text", [])
                if text:
                    text_parts.append("### " + "".join([t.get("plain_text", "") for t in text]))
            
            elif block_type == "bulleted_list_item":
                text = block.get("bulleted_list_item", {}).get("rich_text", [])
                if text:
                    text_parts.append("- " + "".join([t.get("plain_text", "") for t in text]))
            
            elif block_type == "numbered_list_item":
                text = block.get("numbered_list_item", {}).get("rich_text", [])
                if text:
                    text_parts.append("1. " + "".join([t.get("plain_text", "") for t in text]))
            
            elif block_type == "code":
                text = block.get("code", {}).get("rich_text", [])
                language = block.get("code", {}).get("language", "")
                if text:
                    code_text = "".join([t.get("plain_text", "") for t in text])
                    text_parts.append(f"```{language}\n{code_text}\n```")
            
            elif block_type == "quote":
                text = block.get("quote", {}).get("rich_text", [])
                if text:
                    text_parts.append("> " + "".join([t.get("plain_text", "") for t in text]))
        
        return "\n".join(text_parts)
    except Exception as e:
        log_error(f"Failed to get page content: {str(e)}")
        return ""

def extract_notion_as_text(api_key: str, page_id: str = None, database_id: str = None) -> str:
    try:
        text_parts = []
        
        if page_id:
            content = get_page_content(api_key, page_id)
            return content
        
        if database_id:
            pages = get_notion_pages(api_key, database_id)
            for page in pages:
                content = get_page_content(api_key, page["id"])
                if content:
                    text_parts.append(f"Page: {page['title']}")
                    text_parts.append(content)
                    text_parts.append("")
            return "\n".join(text_parts)
        
        return ""
    except Exception as e:
        log_error(f"Failed to extract Notion as text: {str(e)}")
        return ""