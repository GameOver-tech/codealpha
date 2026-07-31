"""Role-scoped tool registry for the AI assistant.

The registry maps tool names to their Groq tool schema (description +
strict JSON parameters) and their handler. Admin tools are never exposed
to candidates — the model literally cannot call them. Handlers still
re-check the actor role as defense in depth.
"""
from __future__ import annotations

from app.models.user import User
from app.tools import admin_tools, candidate_tools


def _params(**properties) -> dict:
    """Build a strict JSON-schema parameters object.

    With additionalProperties=False + required, Groq validates the model's
    tool-call arguments server-side, so handlers receive well-typed args.
    """
    return {
        "type": "object",
        "properties": properties,
        "required": [],
        "additionalProperties": False,
    }


def _str(description: str, required: bool = False) -> dict:
    # NOTE: `required` is NOT valid inside a property schema — Groq rejects it
    # with "expected array, but got boolean". Required-ness is enforced by the
    # top-level `required` array + `additionalProperties: false` (strict mode).
    return {"type": "string", "description": description}


# Name -> (description, parameters_schema, handler)
ADMIN_TOOLS: dict = {
    "get_dashboard_stats": (
        "Get current platform dashboard statistics: total candidates, total interviews, "
        "interviewed candidates, interviews processing/failed, recommendation counts, "
        "and average overall score.",
        _params(),
        admin_tools.get_dashboard_stats,
    ),
    "list_candidates": (
        "List candidate accounts, optionally filtered by a search term (name or email). "
        "Paginated with limit (default 50, max 100) and offset.",
        _params(
            search=_str("Optional search term matching name or email"),
            limit=_str("Maximum number of results (1-100)"),
            offset=_str("Number of results to skip"),
        ),
        admin_tools.list_candidates,
    ),
    "get_candidate": (
        "Get a single candidate's full details (profile, skills, education, experience) by email.",
        _params(email=_str("The candidate's email address", required=True)),
        admin_tools.get_candidate,
    ),
    "update_candidate": (
        "Update a candidate's profile fields (name, phone, skills, education, experience, "
        "current_company, expected_salary, is_active) by email. Only provided fields change.",
        _params(
            email=_str("The candidate's email address", required=True),
            first_name=_str("New first name"),
            last_name=_str("New last name"),
            phone=_str("New phone number"),
            gender=_str("New gender"),
            skills=_str("Comma-separated skills"),
            education=_str("Education summary"),
            experience=_str("Experience summary"),
            current_company=_str("Current company"),
            expected_salary=_str("Expected salary"),
            is_active=_str("Whether the account is active (true/false)"),
        ),
        admin_tools.update_candidate,
    ),
    "delete_candidate": (
        "Permanently delete a candidate account (and their interviews) by email. "
        "Confirm with the user before calling.",
        _params(email=_str("The candidate's email address", required=True)),
        admin_tools.delete_candidate,
    ),
    "create_candidate": (
        "Create a new candidate account. Requires email, password, and optional name. "
        "The account is created in Supabase Auth and provisioned locally.",
        _params(
            email=_str("The candidate's email address", required=True),
            password=_str("Initial password (min 8 characters)", required=True),
            first_name=_str("First name"),
            last_name=_str("Last name"),
            phone=_str("Phone number"),
        ),
        admin_tools.create_candidate,
    ),
    "list_interviews": (
        "List all interviews with candidate info, scores, and recommendation. "
        "Optionally filter by pipeline status (uploaded/processing/transcript_ready/"
        "ai_evaluation/pdf_generated/completed/failed).",
        _params(
            status=_str("Optional pipeline status filter"),
            limit=_str("Maximum number of results (1-100)"),
            offset=_str("Number of results to skip"),
        ),
        admin_tools.list_interviews,
    ),
    "update_interview_status": (
        "Update an interview's admin review status. Valid values: Pending, Processing, "
        "Completed, Recommended, Not Recommended, Need Further Review, Rejected, Selected.",
        _params(
            interview_id=_str("The interview UUID", required=True),
            status=_str("The new admin status", required=True),
        ),
        admin_tools.update_interview_status,
    ),
    "get_candidate_results": (
        "Get the interview results for a specific candidate by email: job title, status, "
        "admin status, overall score, all dimension scores, technical evaluation, "
        "strengths, weaknesses, and recommendation verdict. Returns a tabular list.",
        _params(email=_str("The candidate's email address", required=True)),
        admin_tools.get_candidate_results,
    ),
    "get_interview_details": (
        "Get the full analysis for a single interview by id: transcript, technical "
        "evaluation, sentiment and speech analysis, scores, strengths and weaknesses, "
        "recommendation with reason, and the full professional report.",
        _params(interview_id=_str("The interview UUID", required=True)),
        admin_tools.get_interview_details,
    ),
    "get_recent_activity": (
        "Get the most recent platform activity (new interviews, status changes, support "
        "requests, candidate actions) from the audit trail, newest first.",
        _params(limit=_str("Maximum number of entries (1-100, default 20)")),
        admin_tools.get_recent_activity,
    ),
    "get_analytics": (
        "Get hiring analytics: funnel (registered/interviewed/recommended/selected), "
        "success rate, average interview duration, and monthly interview trends.",
        _params(months=_str("Number of months of trend data (default 6, max 24)")),
        admin_tools.get_analytics,
    ),
    "list_users": (
        "List platform users with their roles (admin/candidate), optionally filtered by role.",
        _params(
            role=_str("Optional role filter: admin or candidate"),
            limit=_str("Maximum number of results (1-100)"),
            offset=_str("Number of results to skip"),
        ),
        admin_tools.list_users,
    ),
    "change_role": (
        "Change a user's role (admin/candidate) by email. You cannot change your own role.",
        _params(
            email=_str("The user's email address", required=True),
            role=_str("The new role: admin or candidate", required=True),
        ),
        admin_tools.change_role,
    ),
    "send_notification": (
        "Send a notification to a user by email. Currently records the notification "
        "for delivery (integration pending).",
        _params(
            email=_str("Recipient email", required=True),
            message=_str("Notification message text", required=True),
        ),
        admin_tools.send_notification,
    ),
    "get_system_logs": (
        "Get recent system activity (audit log), optionally filtered by action name.",
        _params(
            action=_str("Optional action substring filter"),
            limit=_str("Maximum number of log entries (1-100)"),
        ),
        admin_tools.get_system_logs,
    ),
}

CANDIDATE_TOOLS: dict = {
    "get_my_interview_status": (
        "Get the signed-in candidate's awaiting interview status and time: whether the "
        "interview is still being processed, how long it has been, and a friendly status "
        "message. Never reveals interview questions or content.",
        _params(),
        candidate_tools.get_my_interview_status,
    ),
    "get_my_result": (
        "Get the signed-in candidate's final interview result: status and hiring "
        "recommendation verdict with a friendly message. Detailed scores and reports "
        "are shared by the recruiter, not shown here.",
        _params(),
        candidate_tools.get_my_result,
    ),
    "faq_search": (
        "Search the platform FAQ for an answer (interviews, results, rescheduling, "
        "account, password, resume).",
        _params(query=_str("The question or topic to search", required=True)),
        candidate_tools.faq_search,
    ),
    "contact_support": (
        "Submit a support request on behalf of the signed-in candidate to resolve "
        "any issue (interview problems, rescheduling, account help).",
        _params(message=_str("The support message", required=True)),
        candidate_tools.contact_support,
    ),
    "get_my_notifications": (
        "Get the signed-in candidate's recent notifications (status updates, support replies).",
        _params(),
        candidate_tools.get_my_notifications,
    ),
}

_REGISTRY = {
    "admin": ADMIN_TOOLS,
    "candidate": CANDIDATE_TOOLS,
}


def get_tools_for_role(role: str) -> dict:
    return _REGISTRY.get(role, CANDIDATE_TOOLS)


def get_groq_tools(role: str) -> list[dict]:
    """Build the Groq `tools` payload (name, description, strict parameters)."""
    return [
        {
            "type": "function",
            "function": {
                "name": name,
                "description": desc,
                "parameters": schema,
            },
        }
        for name, (desc, schema, _handler) in get_tools_for_role(role).items()
    ]


async def execute_tool(db, actor: User, role: str, name: str, args: dict) -> dict:
    """Execute a tool call by name with role enforcement. Raises on unknown tool."""
    tools = get_tools_for_role(role)
    entry = tools.get(name)
    if entry is None:
        from app.utils.exceptions import BadRequestError

        raise BadRequestError(f"Unknown tool for role '{role}': {name}")
    _desc, _schema, handler = entry
    return await handler(db, actor, **args)
