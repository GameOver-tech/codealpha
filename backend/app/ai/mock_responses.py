"""Mock LLM evaluation payload — used when no LLM API key is configured.

Mirrors the exact JSON schema the evaluation prompts request, so mock mode
exercises the same code paths as live providers.
"""
import json

MOCK_EVALUATION = {
    "scores": {
        "technical_skills": 86,
        "communication": 80,
        "confidence": 78,
        "problem_solving": 88,
        "relevant_experience": 84,
        "leadership": 72,
        "teamwork": 75,
        "critical_thinking": 82,
        "behavior": 79,
        "professionalism": 83,
        "overall_score": 81,
    },
    "technical_evaluation": {
        "technical_knowledge": "Demonstrates strong command of backend engineering — Python, FastAPI, Django, PostgreSQL, and async task queues. Concepts were explained accurately with concrete implementation detail.",
        "communication_skills": "Answers are clear, logically structured, and jargon is explained when used. Communication is effective and easy to follow.",
        "confidence_level": "Confident and direct delivery with minimal hedging. Comfortable defending design decisions.",
        "problem_solving": "Methodical approach — profiled with EXPLAIN ANALYZE, identified root cause, applied a targeted fix, then measured the result. Structured and data-driven.",
        "relevant_experience": "Directly relevant background in scalable backend systems, payments, and microservices that matches the role's requirements.",
        "leadership": "Showed ownership of architecture decisions and team coordination during the migration; room for more explicit leadership examples.",
        "teamwork": "References collaboration with teams and contributions to shared codebases and open source.",
        "critical_thinking": "Considers trade-offs (Saga vs orchestration, idempotency, dead-letter queues) rather than giving surface-level answers.",
        "behavior": "Professional, composed, and responsive throughout the interview.",
        "professionalism": "Consistently professional tone and respectful engagement with the interviewer.",
        "answer_quality": "High — answers were specific, relevant, and grounded in real experience.",
        "answer_accuracy": "Accurate technical claims with appropriate detail; no errors detected.",
        "depth_of_knowledge": "Deep understanding of distributed systems and database optimization concepts.",
        "domain_expertise": "Strong domain expertise in backend web services and system design.",
        "soft_skills": "Good listener, structured communicator, and clearly collaborative.",
        "overall_performance": "Overall a strong performance — the candidate is well-suited for a senior backend role.",
    },
    "strengths": [
        "Strong backend architecture experience — designed and migrated a monolith to six microservices using the Saga pattern",
        "Excellent problem-solving — used EXPLAIN ANALYZE and composite indexing to cut query time from 30s to 200ms",
        "Solid understanding of distributed systems — idempotency keys, compensating transactions, dead-letter queues",
        "Proactive learner — contributes to open source, attends PyCon, builds side projects with WebSockets",
    ],
    "weaknesses": [
        "Could provide more specific metrics on the scale and impact of the microservices migration",
        "Mentioned Redis caching but did not elaborate on invalidation strategy or edge cases like cache stampedes",
        "Did not discuss testing methodology or how quality was maintained during the migration",
    ],
    "report": {
        "executive_summary": "The candidate demonstrates strong backend engineering skills with relevant experience in Python, FastAPI, and system design. Their hands-on work with the Saga pattern for a microservices migration and a methodical approach to resolving a 30-second query performance issue show solid technical depth. Communication is clear and structured. Overall, the candidate is well-suited for a senior backend role and is recommended for hire.",
        "interview_overview": "A structured technical interview covering the candidate's background, a microservices migration, a performance debugging scenario, and career development. The candidate engaged fully and answered all questions in depth.",
        "candidate_overview": "Five years of Python backend experience, currently specialized in FastAPI/Django, payments processing, and scalable system architecture.",
        "performance_analysis": "Strong across the board — technical depth, structured problem-solving, and clear communication. Confidence was consistent; pacing was good with minor room for more concise answers.",
        "technical_assessment": "Advanced understanding of backend systems, database optimization, and event-driven architecture. Answers were accurate and well-reasoned.",
        "communication_assessment": "Clear, concise, and jargon-aware communication with good structure in longer answers.",
        "confidence_assessment": "Confident delivery with minimal hesitation or hedging language.",
        "problem_solving_assessment": "Excellent — profiling-first debugging, root-cause analysis, and measurable outcomes.",
        "experience_assessment": "Relevant, hands-on experience that maps directly to the role's core responsibilities.",
        "improvement_suggestions": "1. Quantify impact with more metrics in future answers. 2. Elaborate on cache invalidation and concurrency edge cases. 3. Discuss testing strategy and how quality is maintained in large migrations.",
    },
    "recommendation": {
        "verdict": "Recommended",
        "reason": "Strong technical foundation, excellent problem-solving ability, and directly relevant experience. Performance met all hiring criteria for the role.",
    },
}

MOCK_EVALUATION_JSON = json.dumps(MOCK_EVALUATION)
