from functools import wraps
from typing import Callable, Any
from app.services.cost import track_cost
from app.utils.logger import log_error

def track_llm_cost(provider: str, operation: str):
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            db = kwargs.get('db') or (args[0] if args else None)
            user_id = kwargs.get('user_id') or (args[1] if len(args) > 1 else None)

            try:
                result = func(*args, **kwargs)

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
