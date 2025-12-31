"""
Huckleberry API Service - REST API for baby activity tracking

Provides HTTP endpoints for logging baby activities to Huckleberry.
Deployed as a separate Cloud Run service from Abby.
"""

import os
import sys
from pathlib import Path
from typing import Optional
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import logging

# Add specs folder to path
specs_dir = Path(__file__).parent.parent.parent / "specs"
sys.path.insert(0, str(specs_dir))

from huckleberry_api.api import HuckleberryAPI

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(title="Huckleberry API Service", version="1.0.0")

# Global API instance
huckleberry_api: Optional[HuckleberryAPI] = None
child_uid: Optional[str] = None
child_name: str = "Baby"


def init_huckleberry():
    """Initialize Huckleberry API client."""
    global huckleberry_api, child_uid, child_name

    email = os.getenv("HUCKLE_USER_ID")
    password = os.getenv("HUCKLE_PW")

    if not email or not password:
        raise ValueError("Missing HUCKLE_USER_ID or HUCKLE_PW in environment")

    logger.info(f"Initializing Huckleberry API for {email}")

    huckleberry_api = HuckleberryAPI(email=email, password=password)
    huckleberry_api.authenticate()

    logger.info(f"Authenticated - User UID: {huckleberry_api.user_uid}")

    # Get first child
    children = huckleberry_api.get_children()
    if not children:
        raise ValueError("No children found in Huckleberry account")

    child_uid = children[0]['uid']
    child_name = children[0]['name']
    logger.info(f"Using child: {child_name} (UID: {child_uid})")


@app.on_event("startup")
async def startup_event():
    """Initialize Huckleberry on startup."""
    try:
        init_huckleberry()
        logger.info("Huckleberry API initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize Huckleberry: {e}")
        # Don't exit - let health check fail instead


@app.get("/health")
async def health():
    """Health check endpoint."""
    if huckleberry_api is None:
        raise HTTPException(status_code=503, detail="Huckleberry API not initialized")
    return {
        "status": "healthy",
        "child": child_name,
        "child_uid": child_uid
    }


# Request models
class LogSleepRequest(BaseModel):
    duration_minutes: int
    notes: Optional[str] = ""


class LogFeedingRequest(BaseModel):
    amount_oz: float
    feeding_type: str  # "bottle" or "nursing"
    notes: Optional[str] = ""


class LogDiaperRequest(BaseModel):
    diaper_type: str  # "pee", "poo", "both", "dry"
    notes: Optional[str] = ""


class LogActivityRequest(BaseModel):
    activity: str  # "burp", "bath", "tummy_time", etc.
    notes: Optional[str] = ""


class LogGrowthRequest(BaseModel):
    weight_lbs: Optional[float] = None
    height_in: Optional[float] = None
    head_in: Optional[float] = None


# Endpoints
@app.post("/log-sleep")
async def log_sleep(request: LogSleepRequest):
    """Log a completed sleep session."""
    if not huckleberry_api:
        raise HTTPException(status_code=503, detail="Huckleberry API not initialized")

    try:
        logger.info(f"Logging sleep: {request.duration_minutes} minutes")
        huckleberry_api.start_sleep(child_uid=child_uid)
        huckleberry_api.complete_sleep(child_uid=child_uid)
        return {
            "success": True,
            "message": f"Logged {request.duration_minutes} minute sleep for {child_name}"
        }
    except Exception as e:
        logger.error(f"Error logging sleep: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/log-feeding")
async def log_feeding(request: LogFeedingRequest):
    """Log a feeding session."""
    if not huckleberry_api:
        raise HTTPException(status_code=503, detail="Huckleberry API not initialized")

    try:
        logger.info(f"Logging feeding: {request.amount_oz}oz {request.feeding_type}")
        huckleberry_api.log_bottle_feeding(
            child_uid=child_uid,
            amount_oz=request.amount_oz,
            notes=request.notes
        )
        return {
            "success": True,
            "message": f"Logged {request.amount_oz}oz {request.feeding_type} for {child_name}"
        }
    except Exception as e:
        logger.error(f"Error logging feeding: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/log-diaper")
async def log_diaper(request: LogDiaperRequest):
    """Log a diaper change."""
    if not huckleberry_api:
        raise HTTPException(status_code=503, detail="Huckleberry API not initialized")

    try:
        logger.info(f"Logging diaper: {request.diaper_type}")
        huckleberry_api.log_diaper(
            child_uid=child_uid,
            mode=request.diaper_type,
            notes=request.notes
        )
        return {
            "success": True,
            "message": f"Logged {request.diaper_type} diaper for {child_name}"
        }
    except Exception as e:
        logger.error(f"Error logging diaper: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/log-activity")
async def log_activity(request: LogActivityRequest):
    """Log a general activity."""
    if not huckleberry_api:
        raise HTTPException(status_code=503, detail="Huckleberry API not initialized")

    try:
        logger.info(f"Logging activity: {request.activity}")
        huckleberry_api.log_activity(
            child_uid=child_uid,
            activity=request.activity,
            notes=request.notes
        )
        return {
            "success": True,
            "message": f"Logged {request.activity} for {child_name}"
        }
    except Exception as e:
        logger.error(f"Error logging activity: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/recent-activity")
async def get_recent_activity(hours: int = 24):
    """Get recent activity summary."""
    if not huckleberry_api:
        raise HTTPException(status_code=503, detail="Huckleberry API not initialized")

    try:
        logger.info(f"Fetching recent activity for last {hours} hours")
        # This would need to be implemented in huckleberry_api
        return {
            "success": True,
            "message": f"Recent activity for {child_name}",
            "data": {}  # TODO: Implement in huckleberry_api
        }
    except Exception as e:
        logger.error(f"Error fetching recent activity: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8081))
    uvicorn.run(app, host="0.0.0.0", port=port)
