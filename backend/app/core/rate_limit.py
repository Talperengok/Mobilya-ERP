"""
Rate limiter configuration using SlowAPI.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

# Global instances available to the entire app
limiter = Limiter(key_func=get_remote_address)
