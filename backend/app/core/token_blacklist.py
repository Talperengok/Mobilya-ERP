"""
In-memory token blacklist for JWT invalidation.

In a multi-process or production environment, this should be backed by Redis.
For this containerized single-instance backend, an in-memory set is sufficient.
"""

from typing import Set

_blacklist: Set[str] = set()

def blacklist_token(jti: str) -> None:
    """Add a JWT ID to the blacklist."""
    _blacklist.add(jti)

def is_blacklisted(jti: str) -> bool:
    """Check if a given JWT ID is blacklisted."""
    return jti in _blacklist
