"""Gunicorn configuration for production deployment.

Based on 2026 best practices for FastAPI/Uvicorn/Gunicorn stack.
Optimized for async I/O-bound trading platform workloads.
"""

import multiprocessing
import os

# Server socket
bind = f"0.0.0.0:{os.getenv('PORT', '8000')}"
backlog = 2048

# Worker processes
# Formula: (2 x CPU cores) + 1 is a good default for I/O-bound apps
workers = int(os.getenv("WORKERS", multiprocessing.cpu_count() * 2 + 1))
worker_class = "uvicorn.workers.UvicornWorker"
worker_connections = 1000
max_requests = 1000  # Restart workers after N requests to prevent memory leaks
max_requests_jitter = 50  # Add jitter to prevent thundering herd

# Timeouts
timeout = 120  # 120s for slow/complex endpoints (backtests, strategy scans)
keepalive = 5
graceful_timeout = 30

# Logging
loglevel = os.getenv("LOG_LEVEL", "info")
accesslog = "-"  # stdout
errorlog = "-"  # stderr
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(D)s'

# Process naming
proc_name = "sentinel-engine"

# Server mechanics
daemon = False
pidfile = None
umask = 0
user = None
group = None
tmp_upload_dir = None

# Worker lifecycle
preload_app = True  # Load app before forking workers for better memory efficiency

# SSL (if needed in production)
# keyfile = None
# certfile = None


def on_starting(server):
    """Called just before the master process is initialized."""
    server.log.info("Sentinel Engine starting with Gunicorn+Uvicorn")


def on_reload(server):
    """Called to recycle workers during a reload via SIGHUP."""
    server.log.info("Reloading Sentinel Engine workers")


def when_ready(server):
    """Called just after the server is started."""
    server.log.info(f"Sentinel Engine ready with {workers} workers")


def pre_fork(server, worker):
    """Called just before a worker is forked."""
    pass


def post_fork(server, worker):
    """Called just after a worker has been forked."""
    server.log.info(f"Worker spawned (pid: {worker.pid})")


def pre_exec(server):
    """Called just before a new master process is forked."""
    server.log.info("Forking new master process")


def on_exit(server):
    """Called just before exiting Gunicorn."""
    server.log.info("Sentinel Engine shutting down")
