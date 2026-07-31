"""Initial schema for HireLens AI.

Revision ID: 0001_initial
Revises:
Create Date: 2026-07-31

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlalchemy.dialects.postgresql as postgresql


revision: str = "0001_initial"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create all application tables."""
    op.create_table(
        'users',
        sa.Column('email', sa.String(255), nullable=False, unique=True),
        sa.Column('password_hash', sa.String(255), nullable=True),
        sa.Column('role', sa.Enum('admin', 'candidate', name='user_role'), nullable=False, server_default='candidate'),
        sa.Column('first_name', sa.String(100), nullable=False, server_default=''),
        sa.Column('last_name', sa.String(100), nullable=False, server_default=''),
        sa.Column('phone', sa.String(30), nullable=False, server_default=''),
        sa.Column('gender', sa.String(30), nullable=False, server_default=''),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('auth_uid', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False)
    )
    op.create_index('ix_users_auth_uid', 'users', ['auth_uid'])
    op.create_index('ix_users_email', 'users', ['email'], unique=True)

    op.create_table(
        'activity_logs',
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('action', sa.String(200), nullable=False),
        sa.Column('entity_type', sa.String(50), nullable=False, server_default=''),
        sa.Column('entity_id', sa.String(100), nullable=False, server_default=''),
        sa.Column('details', sa.JSON(), nullable=False),
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL')
    )
    op.create_index('ix_activity_logs_user_id', 'activity_logs', ['user_id'])

    op.create_table(
        'candidate_profiles',
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False, unique=True),
        sa.Column('experience', sa.String(), nullable=False, server_default=''),
        sa.Column('skills', sa.String(), nullable=False, server_default=''),
        sa.Column('education', sa.String(), nullable=False, server_default=''),
        sa.Column('current_company', sa.String(255), nullable=False, server_default=''),
        sa.Column('expected_salary', sa.String(100), nullable=False, server_default=''),
        sa.Column('profile_picture_url', sa.String(500), nullable=False, server_default=''),
        sa.Column('resume_url', sa.String(500), nullable=False, server_default=''),
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE')
    )

    op.create_table(
        'interviews',
        sa.Column('candidate_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('title', sa.String(255), nullable=False, server_default='Interview'),
        sa.Column('status', sa.Enum('uploaded', 'processing', 'transcript_ready', 'ai_evaluation', 'pdf_generated', 'completed', 'failed', name='interview_status'), nullable=False, server_default='uploaded'),
        sa.Column('job_title', sa.String(255), nullable=False, server_default=''),
        sa.Column('job_description', sa.String(1000), nullable=False, server_default=''),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('duration_seconds', sa.Integer(), nullable=False, server_default=sa.text('0')),
        sa.Column('error_message', sa.String(1000), nullable=False, server_default=''),
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['candidate_id'], ['users.id'], ondelete='CASCADE')
    )
    op.create_index('ix_interviews_candidate_id', 'interviews', ['candidate_id'])

    op.create_table(
        'jobs',
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('description', sa.String(), nullable=False, server_default=''),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='SET NULL')
    )

    op.create_table(
        'generated_pdfs',
        sa.Column('interview_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('filename', sa.String(500), nullable=False),
        sa.Column('storage_path', sa.String(500), nullable=False, server_default=''),
        sa.Column('file_size_bytes', sa.Integer(), nullable=False, server_default=sa.text('0')),
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['interview_id'], ['interviews.id'], ondelete='CASCADE')
    )
    op.create_index('ix_generated_pdfs_interview_id', 'generated_pdfs', ['interview_id'])

    op.create_table(
        'interview_files',
        sa.Column('interview_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('original_filename', sa.String(500), nullable=False),
        sa.Column('storage_path', sa.String(500), nullable=False),
        sa.Column('content_type', sa.String(150), nullable=False, server_default=''),
        sa.Column('file_size_bytes', sa.Integer(), nullable=False, server_default=sa.text('0')),
        sa.Column('duration_seconds', sa.Integer(), nullable=False, server_default=sa.text('0')),
        sa.Column('is_primary', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['interview_id'], ['interviews.id'], ondelete='CASCADE')
    )
    op.create_index('ix_interview_files_interview_id', 'interview_files', ['interview_id'])

    op.create_table(
        'interview_reports',
        sa.Column('interview_id', postgresql.UUID(as_uuid=True), nullable=False, unique=True),
        sa.Column('executive_summary', sa.String(), nullable=False, server_default=''),
        sa.Column('interview_overview', sa.String(), nullable=False, server_default=''),
        sa.Column('candidate_overview', sa.String(), nullable=False, server_default=''),
        sa.Column('performance_analysis', sa.String(), nullable=False, server_default=''),
        sa.Column('technical_assessment', sa.String(), nullable=False, server_default=''),
        sa.Column('communication_assessment', sa.String(), nullable=False, server_default=''),
        sa.Column('confidence_assessment', sa.String(), nullable=False, server_default=''),
        sa.Column('problem_solving_assessment', sa.String(), nullable=False, server_default=''),
        sa.Column('experience_assessment', sa.String(), nullable=False, server_default=''),
        sa.Column('improvement_suggestions', sa.String(), nullable=False, server_default=''),
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['interview_id'], ['interviews.id'], ondelete='CASCADE')
    )
    op.create_index('ix_interview_reports_interview_id', 'interview_reports', ['interview_id'], unique=True)

    op.create_table(
        'interview_scores',
        sa.Column('interview_id', postgresql.UUID(as_uuid=True), nullable=False, unique=True),
        sa.Column('technical_skills', sa.Float(), nullable=False, server_default=sa.text('0.0')),
        sa.Column('communication', sa.Float(), nullable=False, server_default=sa.text('0.0')),
        sa.Column('confidence', sa.Float(), nullable=False, server_default=sa.text('0.0')),
        sa.Column('problem_solving', sa.Float(), nullable=False, server_default=sa.text('0.0')),
        sa.Column('relevant_experience', sa.Float(), nullable=False, server_default=sa.text('0.0')),
        sa.Column('leadership', sa.Float(), nullable=False, server_default=sa.text('0.0')),
        sa.Column('teamwork', sa.Float(), nullable=False, server_default=sa.text('0.0')),
        sa.Column('critical_thinking', sa.Float(), nullable=False, server_default=sa.text('0.0')),
        sa.Column('behavior', sa.Float(), nullable=False, server_default=sa.text('0.0')),
        sa.Column('professionalism', sa.Float(), nullable=False, server_default=sa.text('0.0')),
        sa.Column('overall_score', sa.Float(), nullable=False, server_default=sa.text('0.0')),
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['interview_id'], ['interviews.id'], ondelete='CASCADE')
    )
    op.create_index('ix_interview_scores_interview_id', 'interview_scores', ['interview_id'], unique=True)

    op.create_table(
        'recommendations',
        sa.Column('interview_id', postgresql.UUID(as_uuid=True), nullable=False, unique=True),
        sa.Column('verdict', sa.Enum('Recommended', 'Not Recommended', 'Need Further Review', name='recommendation_verdict'), nullable=False),
        sa.Column('reason', sa.String(), nullable=False, server_default=''),
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['interview_id'], ['interviews.id'], ondelete='CASCADE')
    )
    op.create_index('ix_recommendations_interview_id', 'recommendations', ['interview_id'], unique=True)

    op.create_table(
        'sentiment_analysis',
        sa.Column('interview_id', postgresql.UUID(as_uuid=True), nullable=False, unique=True),
        sa.Column('sentiment', sa.String(30), nullable=False, server_default=''),
        sa.Column('emotion', sa.String(50), nullable=False, server_default=''),
        sa.Column('confidence', sa.Float(), nullable=False, server_default=sa.text('0.0')),
        sa.Column('professionalism', sa.Float(), nullable=False, server_default=sa.text('0.0')),
        sa.Column('summary', sa.String(), nullable=False, server_default=''),
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['interview_id'], ['interviews.id'], ondelete='CASCADE')
    )
    op.create_index('ix_sentiment_analysis_interview_id', 'sentiment_analysis', ['interview_id'], unique=True)

    op.create_table(
        'speech_analysis',
        sa.Column('interview_id', postgresql.UUID(as_uuid=True), nullable=False, unique=True),
        sa.Column('speech_speed_wpm', sa.Float(), nullable=False, server_default=sa.text('0.0')),
        sa.Column('avg_pause_seconds', sa.Float(), nullable=False, server_default=sa.text('0.0')),
        sa.Column('total_pauses', sa.Integer(), nullable=False, server_default=sa.text('0')),
        sa.Column('speaking_rate', sa.Float(), nullable=False, server_default=sa.text('0.0')),
        sa.Column('confidence', sa.Float(), nullable=False, server_default=sa.text('0.0')),
        sa.Column('tone', sa.String(50), nullable=False, server_default=''),
        sa.Column('emotion', sa.String(50), nullable=False, server_default=''),
        sa.Column('clarity', sa.Float(), nullable=False, server_default=sa.text('0.0')),
        sa.Column('fluency', sa.Float(), nullable=False, server_default=sa.text('0.0')),
        sa.Column('energy', sa.Float(), nullable=False, server_default=sa.text('0.0')),
        sa.Column('notes', sa.String(), nullable=False, server_default=''),
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['interview_id'], ['interviews.id'], ondelete='CASCADE')
    )
    op.create_index('ix_speech_analysis_interview_id', 'speech_analysis', ['interview_id'], unique=True)

    op.create_table(
        'strengths',
        sa.Column('interview_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('text', sa.String(), nullable=False),
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['interview_id'], ['interviews.id'], ondelete='CASCADE')
    )
    op.create_index('ix_strengths_interview_id', 'strengths', ['interview_id'])

    op.create_table(
        'technical_evaluation',
        sa.Column('interview_id', postgresql.UUID(as_uuid=True), nullable=False, unique=True),
        sa.Column('technical_knowledge', sa.String(), nullable=False, server_default=''),
        sa.Column('communication_skills', sa.String(), nullable=False, server_default=''),
        sa.Column('confidence_level', sa.String(), nullable=False, server_default=''),
        sa.Column('problem_solving', sa.String(), nullable=False, server_default=''),
        sa.Column('relevant_experience', sa.String(), nullable=False, server_default=''),
        sa.Column('leadership', sa.String(), nullable=False, server_default=''),
        sa.Column('teamwork', sa.String(), nullable=False, server_default=''),
        sa.Column('critical_thinking', sa.String(), nullable=False, server_default=''),
        sa.Column('behavior', sa.String(), nullable=False, server_default=''),
        sa.Column('professionalism', sa.String(), nullable=False, server_default=''),
        sa.Column('answer_quality', sa.String(), nullable=False, server_default=''),
        sa.Column('answer_accuracy', sa.String(), nullable=False, server_default=''),
        sa.Column('depth_of_knowledge', sa.String(), nullable=False, server_default=''),
        sa.Column('domain_expertise', sa.String(), nullable=False, server_default=''),
        sa.Column('soft_skills', sa.String(), nullable=False, server_default=''),
        sa.Column('overall_performance', sa.String(), nullable=False, server_default=''),
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['interview_id'], ['interviews.id'], ondelete='CASCADE')
    )
    op.create_index('ix_technical_evaluation_interview_id', 'technical_evaluation', ['interview_id'], unique=True)

    op.create_table(
        'transcripts',
        sa.Column('interview_id', postgresql.UUID(as_uuid=True), nullable=False, unique=True),
        sa.Column('full_text', sa.String(), nullable=False, server_default=''),
        sa.Column('segments', sa.JSON(), nullable=False),
        sa.Column('speakers', sa.JSON(), nullable=False),
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['interview_id'], ['interviews.id'], ondelete='CASCADE')
    )
    op.create_index('ix_transcripts_interview_id', 'transcripts', ['interview_id'], unique=True)

    op.create_table(
        'weaknesses',
        sa.Column('interview_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('text', sa.String(), nullable=False),
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['interview_id'], ['interviews.id'], ondelete='CASCADE')
    )
    op.create_index('ix_weaknesses_interview_id', 'weaknesses', ['interview_id'])



def downgrade() -> None:
    """Drop all application tables (reverse order)."""
    op.drop_index('ix_weaknesses_interview_id', table_name='weaknesses')
    op.drop_table('weaknesses')

    op.drop_index('ix_transcripts_interview_id', table_name='transcripts')
    op.drop_table('transcripts')

    op.drop_index('ix_technical_evaluation_interview_id', table_name='technical_evaluation')
    op.drop_table('technical_evaluation')

    op.drop_index('ix_strengths_interview_id', table_name='strengths')
    op.drop_table('strengths')

    op.drop_index('ix_speech_analysis_interview_id', table_name='speech_analysis')
    op.drop_table('speech_analysis')

    op.drop_index('ix_sentiment_analysis_interview_id', table_name='sentiment_analysis')
    op.drop_table('sentiment_analysis')

    op.drop_index('ix_recommendations_interview_id', table_name='recommendations')
    op.drop_table('recommendations')

    op.drop_index('ix_interview_scores_interview_id', table_name='interview_scores')
    op.drop_table('interview_scores')

    op.drop_index('ix_interview_reports_interview_id', table_name='interview_reports')
    op.drop_table('interview_reports')

    op.drop_index('ix_interview_files_interview_id', table_name='interview_files')
    op.drop_table('interview_files')

    op.drop_index('ix_generated_pdfs_interview_id', table_name='generated_pdfs')
    op.drop_table('generated_pdfs')

    op.drop_table('jobs')

    op.drop_index('ix_interviews_candidate_id', table_name='interviews')
    op.drop_table('interviews')

    op.drop_table('candidate_profiles')

    op.drop_index('ix_activity_logs_user_id', table_name='activity_logs')
    op.drop_table('activity_logs')

    op.drop_index('ix_users_auth_uid', table_name='users')
    op.drop_index('ix_users_email', table_name='users')
    op.drop_table('users')

