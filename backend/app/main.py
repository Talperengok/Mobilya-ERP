"""
Mobilya ERP — FastAPI Application Entry Point

Creates the FastAPI app, mounts middleware, registers routes,
and auto-creates database tables on startup.
"""

import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.v1.router import api_router
from app.db.session import engine
from app.db.base import Base
from app.core.rate_limit import limiter
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler

# Import all models so they register with Base.metadata
import app.models  # noqa: F401


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context: create tables on startup, start MRP background loop."""
    # Startup
    Base.metadata.create_all(bind=engine)
    
    # Start background MRP poller
    from app.services.mrp_poller import mrp_background_loop
    from app.services.reservation_cleaner import clean_stale_reservations_loop
    from app.services.task_scheduler import task_scheduler_loop
    mrp_task = asyncio.create_task(mrp_background_loop())
    reservation_task = asyncio.create_task(clean_stale_reservations_loop())
    scheduler_task = asyncio.create_task(task_scheduler_loop())
    print("[Startup] MRP background poller started (30s interval)")
    print("[Startup] Reservation cleaner started (5m interval, 30m cutoff)")
    print("[Startup] DB-backed Task Queue Scheduler started (5s interval)")
    
    yield
    
    # Shutdown
    mrp_task.cancel()
    reservation_task.cancel()
    scheduler_task.cancel()
    try:
        await asyncio.gather(mrp_task, reservation_task, scheduler_task, return_exceptions=True)
    except asyncio.CancelledError:
        pass
    print("[Shutdown] Background tasks stopped")


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.PROJECT_NAME,
        description=(
            "ERP System Simulation for a Furniture Manufacturing Company. "
            "Manages inventory, BOM, orders, and MRP-driven production."
        ),
        version="1.0.0",
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
    )

    # CORS — allow the Next.js frontend (and Swagger UI) to call the API
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:3000",
            "http://localhost:3001",
            "http://127.0.0.1:3000",
            "http://127.0.0.1:3001",
            "http://0.0.0.0:3000",
            "http://0.0.0.0:3001",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Mount all API routes under /api/v1
    app.include_router(api_router, prefix=settings.API_V1_PREFIX)

    @app.get("/health", tags=["System"])
    def health_check():
        return {"status": "healthy", "service": settings.PROJECT_NAME}

    # Mount slowapi limiter
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    return app


app = create_app()
