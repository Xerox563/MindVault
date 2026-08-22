import time
from functools import wraps
from app.utils.logger import log_error, log_info

def retry(max_attempts: int = 3, delay: float = 1.0):
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            attempts = 0
            while attempts < max_attempts:
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    attempts += 1
                    log_error(f"Attempt {attempts} failed for {func.__name__}: {str(e)}")
                    if attempts < max_attempts:
                        time.sleep(delay * attempts)
                    else:
                        raise
        return wrapper
    return decorator
