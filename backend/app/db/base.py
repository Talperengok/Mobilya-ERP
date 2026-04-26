"""
SQLAlchemy 2.0 Declarative Base.
All ORM models inherit from this Base class.
"""

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass
