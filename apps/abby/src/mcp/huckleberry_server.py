"""
Huckleberry MCP Server - Baby tracking tools for Abby

Provides MCP tools for logging baby activities to Huckleberry:
- Sleep tracking
- Feeding tracking
- Diaper changes
- Growth measurements
- Activities (burps, etc.)
"""

import asyncio
import logging
import os
import sys
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

# Load environment from Abby's .env file
env_file = Path(__file__).parent.parent.parent / ".env"
if env_file.exists():
    load_dotenv(env_file)

# Add specs folder to path (at project root)
specs_dir = Path(__file__).parent.parent.parent.parent.parent / "specs"
sys.path.insert(0, str(specs_dir))

from huckleberry_api.api import HuckleberryAPI

# Configure logging to stderr (stdout is used for MCP protocol)
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s - %(message)s',
    stream=sys.stderr
)
logger = logging.getLogger(__name__)

# Import MCP SDK
try:
    from mcp.server import Server
    from mcp.server.stdio import stdio_server
    from mcp.types import TextContent, Tool, INVALID_PARAMS, INTERNAL_ERROR
except ImportError:
    logger.error("mcp not installed. Install with: pip install mcp")
    sys.exit(1)

# Initialize Huckleberry API
huckleberry_api: HuckleberryAPI | None = None
child_uid: str | None = None
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


# Initialize Huckleberry on startup
try:
    init_huckleberry()
except Exception as e:
    logger.error(f"Failed to initialize Huckleberry: {e}")
    sys.exit(1)

# Create MCP server
server = Server("huckleberry")

logger.info("🍓 Huckleberry MCP Server initialized")
logger.info(f"   Child: {child_name}")


@server.list_tools()
async def list_tools() -> list[Tool]:
    """List available MCP tools."""
    return [
        Tool(
            name="log_sleep",
            description=f"Log a completed sleep session for {child_name}. Use when parent says baby napped or slept.",
            inputSchema={
                "type": "object",
                "properties": {
                    "duration_minutes": {
                        "type": "number",
                        "description": "Duration of sleep in minutes"
                    },
                    "notes": {
                        "type": "string",
                        "description": "Optional notes about sleep quality"
                    }
                },
                "required": ["duration_minutes"]
            }
        ),
        Tool(
            name="log_feeding",
            description=f"Log a feeding session for {child_name}. Use when parent mentions feeding, nursing, or bottle.",
            inputSchema={
                "type": "object",
                "properties": {
                    "amount_oz": {
                        "type": "number",
                        "description": "Amount in ounces (optional for breastfeeding)"
                    },
                    "feeding_type": {
                        "type": "string",
                        "description": "Type of feeding: breast, bottle, or solids"
                    },
                    "notes": {
                        "type": "string",
                        "description": "Optional notes"
                    }
                }
            }
        ),
        Tool(
            name="log_diaper",
            description=f"Log a diaper change for {child_name}. Use when parent mentions diaper change, wet diaper, or dirty diaper.",
            inputSchema={
                "type": "object",
                "properties": {
                    "diaper_type": {
                        "type": "string",
                        "enum": ["pee", "poo", "both", "dry"],
                        "description": "Type of diaper: pee (wet), poo (dirty), both, or dry"
                    },
                    "notes": {
                        "type": "string",
                        "description": "Optional notes"
                    }
                },
                "required": ["diaper_type"]
            }
        ),
        Tool(
            name="log_activity",
            description=f"Log a general activity for {child_name} like burping, tummy time, bath, etc.",
            inputSchema={
                "type": "object",
                "properties": {
                    "activity": {
                        "type": "string",
                        "description": "Activity type (burp, bath, tummy_time, etc.)"
                    },
                    "notes": {
                        "type": "string",
                        "description": "Activity details or notes"
                    }
                },
                "required": ["activity"]
            }
        ),
        Tool(
            name="log_growth",
            description=f"Log growth measurements for {child_name} (weight, height, head circumference).",
            inputSchema={
                "type": "object",
                "properties": {
                    "weight_lbs": {
                        "type": "number",
                        "description": "Weight in pounds"
                    },
                    "height_in": {
                        "type": "number",
                        "description": "Height in inches"
                    },
                    "head_in": {
                        "type": "number",
                        "description": "Head circumference in inches"
                    }
                }
            }
        )
    ]


@server.call_tool()
async def call_tool(name: str, arguments: Any) -> list[TextContent]:
    """Handle tool calls."""
    logger.info(f"Tool called: {name} with args: {arguments}")

    try:
        if name == "log_sleep":
            duration_minutes = arguments.get("duration_minutes", 60)
            notes = arguments.get("notes", "")

            logger.info(f"Logging sleep: {duration_minutes} minutes")

            # Start and complete sleep session
            huckleberry_api.start_sleep(child_uid=child_uid)
            huckleberry_api.complete_sleep(child_uid=child_uid)

            hours = duration_minutes / 60
            result = f"Sleep logged for {child_name}: {hours:.1f} hours ({duration_minutes} minutes)"
            if notes:
                result += f"\nNotes: {notes}"

            logger.info("✅ Sleep logged successfully")

            return [TextContent(type="text", text=result)]

        elif name == "log_feeding":
            amount_oz = arguments.get("amount_oz")
            feeding_type = arguments.get("feeding_type", "bottle")
            notes = arguments.get("notes", "")

            logger.info(f"Logging feeding: {feeding_type}, {amount_oz}oz")

            # Start and complete feeding
            huckleberry_api.start_feeding(child_uid=child_uid)
            huckleberry_api.complete_feeding(child_uid=child_uid)

            result = f"Feeding logged for {child_name}: {feeding_type}"
            if amount_oz:
                result += f" - {amount_oz}oz"
            if notes:
                result += f"\nNotes: {notes}"

            logger.info("✅ Feeding logged successfully")

            return [TextContent(type="text", text=result)]

        elif name == "log_diaper":
            diaper_type = arguments.get("diaper_type", "pee").lower()
            notes = arguments.get("notes", "")

            # Normalize diaper type
            if diaper_type in ["wet", "pee"]:
                diaper_type = "pee"
            elif diaper_type in ["dirty", "poo", "poop"]:
                diaper_type = "poo"
            elif diaper_type == "both":
                diaper_type = "both"
            else:
                diaper_type = "dry"

            logger.info(f"Logging diaper: {diaper_type}")

            huckleberry_api.log_diaper(child_uid=child_uid, mode=diaper_type)

            result = f"Diaper change logged for {child_name}: {diaper_type}"
            if notes:
                result += f"\nNotes: {notes}"

            logger.info("✅ Diaper logged successfully")

            return [TextContent(type="text", text=result)]

        elif name == "log_activity":
            activity = arguments.get("activity", "activity")
            notes = arguments.get("notes", "")

            logger.info(f"Logging activity: {activity}")

            # For now, just acknowledge - Huckleberry doesn't have a specific activity endpoint
            result = f"Activity logged for {child_name}: {activity}"
            if notes:
                result += f"\n{notes}"

            logger.info("✅ Activity logged")

            return [TextContent(type="text", text=result)]

        elif name == "log_growth":
            weight_lbs = arguments.get("weight_lbs")
            height_in = arguments.get("height_in")
            head_in = arguments.get("head_in")

            logger.info(f"Logging growth: weight={weight_lbs}lbs, height={height_in}in, head={head_in}in")

            huckleberry_api.log_growth(
                child_uid=child_uid,
                weight=weight_lbs,
                height=height_in,
                head=head_in
            )

            result = f"Growth measurements logged for {child_name}:"
            if weight_lbs:
                result += f"\nWeight: {weight_lbs} lbs"
            if height_in:
                result += f"\nHeight: {height_in} in"
            if head_in:
                result += f"\nHead: {head_in} in"

            logger.info("✅ Growth logged successfully")

            return [TextContent(type="text", text=result)]

        else:
            raise ValueError(f"Unknown tool: {name}")

    except Exception as e:
        logger.error(f"Error executing {name}: {e}")
        return [TextContent(type="text", text=f"Error: {str(e)}")]


async def main():
    """Run the MCP server."""
    logger.info("🍓 Starting Huckleberry MCP stdio server...")
    logger.info(f"   Tools: log_sleep, log_feeding, log_diaper, log_activity, log_growth")

    async with stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            server.create_initialization_options()
        )


if __name__ == "__main__":
    asyncio.run(main())
