"""initial_schema

Revision ID: 0001_initial_schema
Revises: 
Create Date: 2026-10-23 21:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '0001_initial_schema'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Incidents Table
    op.create_table(
        'incidents',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('category', sa.String(length=50), nullable=False),
        sa.Column('severity', sa.String(length=50), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=False),
        sa.Column('latitude', sa.Float(), nullable=False),
        sa.Column('longitude', sa.Float(), nullable=False),
        sa.Column('location_name', sa.String(length=255), nullable=False),
        sa.Column('corridor', sa.String(length=100), nullable=True),
        sa.Column('speed_limit_kmh', sa.Float(), nullable=True),
        sa.Column('current_speed_kmh', sa.Float(), nullable=True),
        sa.Column('congestion_level_pct', sa.Float(), nullable=True, server_default='0.0'),
        sa.Column('affected_lanes', sa.Integer(), nullable=True, server_default='1'),
        sa.Column('is_simulated', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('data_source', sa.String(length=100), nullable=False, server_default='SIMULATED DEMO DATA'),
        sa.Column('tags', sa.String(length=255), nullable=True, server_default=''),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_incidents_id'), 'incidents', ['id'], unique=False)
    op.create_index(op.f('ix_incidents_category'), 'incidents', ['category'], unique=False)
    op.create_index(op.f('ix_incidents_severity'), 'incidents', ['severity'], unique=False)
    op.create_index(op.f('ix_incidents_status'), 'incidents', ['status'], unique=False)
    op.create_index(op.f('ix_incidents_latitude'), 'incidents', ['latitude'], unique=False)
    op.create_index(op.f('ix_incidents_longitude'), 'incidents', ['longitude'], unique=False)

    # 2. Vision Analyses Table
    op.create_table(
        'vision_analyses',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('filename', sa.String(length=255), nullable=False),
        sa.Column('media_type', sa.String(length=50), nullable=False),
        sa.Column('file_size_bytes', sa.Integer(), nullable=False),
        sa.Column('duration_seconds', sa.Float(), nullable=True),
        sa.Column('frame_count_sampled', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('frame_timestamp_sec', sa.Float(), nullable=True),
        sa.Column('source_video_name', sa.String(length=255), nullable=True),
        sa.Column('session_id', sa.String(length=36), nullable=True),
        sa.Column('video_hash', sa.String(length=64), nullable=True),
        sa.Column('status', sa.String(length=30), nullable=False, server_default='COMPLETED'),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('adapter_name', sa.String(length=150), nullable=False),
        sa.Column('is_simulated', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('data_source', sa.String(length=150), nullable=False),
        sa.Column('total_vehicles', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('total_pedestrians', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('unique_vehicles_tracked', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('total_frame_detections', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('vehicle_breakdown_json', sa.Text(), nullable=False, server_default='{}'),
        sa.Column('detections_json', sa.Text(), nullable=False, server_default='[]'),
        sa.Column('representative_frame_base64', sa.Text(), nullable=True),
        sa.Column('tracking_summary_json', sa.Text(), nullable=False, server_default='{}'),
        sa.Column('time_buckets_json', sa.Text(), nullable=False, server_default='[]'),
        sa.Column('events_json', sa.Text(), nullable=False, server_default='[]'),
        sa.Column('evaluation_summary_json', sa.Text(), nullable=True),
        sa.Column('fps_processed', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('inference_config_json', sa.Text(), nullable=False, server_default='{}'),
        sa.Column('processing_time_ms', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_vision_analyses_id'), 'vision_analyses', ['id'], unique=False)
    op.create_index(op.f('ix_vision_analyses_session_id'), 'vision_analyses', ['session_id'], unique=False)
    op.create_index(op.f('ix_vision_analyses_video_hash'), 'vision_analyses', ['video_hash'], unique=False)
    op.create_index(op.f('ix_vision_analyses_status'), 'vision_analyses', ['status'], unique=False)
    op.create_index(op.f('ix_vision_analyses_is_simulated'), 'vision_analyses', ['is_simulated'], unique=False)
    op.create_index(op.f('ix_vision_analyses_created_at'), 'vision_analyses', ['created_at'], unique=False)


def downgrade() -> None:
    op.drop_table('vision_analyses')
    op.drop_table('incidents')
