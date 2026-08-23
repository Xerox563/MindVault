"""
Cost Tracking Decorator
Automatically track costs for LLM API calls
"""
from functools import wraps
from typing import Callable, Any
from app.services.cost import track_cost
from app.utils.logger import log_error

def track_llm_cost(provider: str, operation: str):
    """
    Decorator to automatically track LLM API costs.
    
    Usage:
        @track_llm_cost(provider="mistral", operation="chat")
        def generate_chat(db, user_id, prompt):
            # ... generate response and get token counts
            return {
                "content": response_text,
                "input_tokens": 100,
                "output_tokens": 50
            }
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Extract db and user_id from args or kwargs
            db = kwargs.get('db') or (args[0] if args else None)
            user_id = kwargs.get('user_id') or (args[1] if len(args) > 1 else None)
            
            try:
                # Call the function
                result = func(*args, **kwargs)
                
                # Track cost if we have the necessary info
                if db and user_id and isinstance(result, dict):
                    input_tokens = result.get('input_tokens', 0)
                    output_tokens = result.get('output_tokens', 0)
                    
                    if input_tokens > 0 or output_tokens > 0:
                        track_cost(
                            db=db,
                            user_id=user_id,
                            provider=provider,
                            operation=operation,
                            input_tokens=input_tokens,
                            output_tokens=output_tokens,
                            metadata={"function": func.__name__}
                        )
                
                return result
                
            except Exception as e:
                log_error(f"Error in cost tracking decorator: {str(e)}")
                raise
        
        return wrapper
    return decorator
