"""Candidate-facing recommendation UI messages (exact copy per spec)."""

RECOMMENDATION_MESSAGES = {
    "Recommended": (
        "Congratulations!\n\n"
        "You have successfully passed the AI interview evaluation.\n\n"
        "We are pleased to inform you that your performance met our hiring criteria.\n\n"
        "Our recruitment team may contact you soon.\n\n"
        "Best of luck!"
    ),
    "Not Recommended": (
        "Thank you for participating in the interview.\n\n"
        "Unfortunately, your performance did not meet our current hiring requirements.\n\n"
        "We encourage you to continue improving your skills and apply again in the future.\n\n"
        "We wish you success in your career."
    ),
    "Need Further Review": (
        "Your interview has been completed successfully.\n\n"
        "Your evaluation requires additional review by our recruitment team.\n\n"
        "You will receive an update soon.\n\n"
        "Thank you for your patience."
    ),
}


def get_recommendation_message(verdict: str) -> str:
    """Return the exact UI message for a recommendation verdict."""
    return RECOMMENDATION_MESSAGES.get(verdict, "")
