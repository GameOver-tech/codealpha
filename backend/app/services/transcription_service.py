import io
import json
from pathlib import Path

from app.core.config import settings

MOCK_TRANSCRIPT = """
Interviewer: Thank you for joining us today. Let's start with your background. Can you tell us about your experience with Python and backend development?

Candidate: Sure. I've been working with Python for about five years now. My last role was at a fintech startup where I built REST APIs using FastAPI and Django. I worked on a payment processing system that handled about 50,000 transactions per day. I was responsible for the entire backend architecture — database design with PostgreSQL, implementing async task queues with Celery and Redis, and setting up CI/CD pipelines with GitHub Actions. I also contributed to our microservices migration, breaking down a monolithic Django app into six smaller services.

Interviewer: That sounds relevant. How did you handle data consistency during the microservices migration?

Candidate: Good question. We used the Saga pattern with a choreography approach. Each service published events to RabbitMQ when its local transaction completed, and downstream services consumed those events. For rollbacks, we implemented compensating transactions. The tricky part was handling idempotency — we added idempotency keys to all critical endpoints so replaying a message wouldn't double-process a transaction. We also set up dead-letter queues for failed messages and an alerting system in PagerDuty so the team knew immediately if something went wrong.

Interviewer: Let's talk about a technical problem you solved recently. Walk me through your approach.

Candidate: We had a performance issue where a reporting query was taking over 30 seconds to run. I started by profiling it with EXPLAIN ANALYZE and found a sequential scan on a table with two million rows. The root cause was a missing composite index on the columns used in the WHERE and ORDER BY clauses. I added a multi-column index and the query dropped to 200 milliseconds. I also introduced query caching with Redis — frequently accessed reports got cached with a five-minute TTL, and we invalidated the cache whenever new data was ingested. This reduced the average report load time by 95 percent.

Interviewer: How do you stay up to date with new technologies?

Candidate: I follow a few engineering blogs — mostly the Spotify Engineering Blog and the Uber Engineering Blog. I also contribute to open source when I can — I've made a few pull requests to FastAPI's documentation and fixed a bug in a popular async ORM library. I attend PyCon and local Python meetups. I believe in learning by building, so I have a side project where I'm experimenting with WebSockets and real-time data streaming.

Interviewer: Why do you want to work here?

Candidate: I've been following your company's work in the AI space for a while. The problems you're solving with natural language processing are genuinely interesting to me. I think my experience building scalable backend systems would let me contribute from day one, and I'm excited about the chance to work on a product that's actually being used by millions of people.
"""


async def transcribe_audio(audio_file_path: str) -> str:
    """Transcribe an audio file to text.

    In mock mode (USE_MOCK_AI=true or missing WHISPER_API_KEY), returns
    a hardcoded realistic transcript. Otherwise calls OpenAI Whisper API.
    """
    if settings.mock_mode:
        return MOCK_TRANSCRIPT.strip()

    import openai

    client = openai.OpenAI(api_key=settings.WHISPER_API_KEY)

    with open(audio_file_path, "rb") as f:
        audio_bytes = f.read()

    # Whisper accepts files up to 25MB. For larger files we'd chunk it,
    # but for an MVP we pass the file directly.
    transcript_response = client.audio.transcriptions.create(
        model="whisper-1",
        file=io.BytesIO(audio_bytes),
        response_format="text",
    )

    return transcript_response.strip()
