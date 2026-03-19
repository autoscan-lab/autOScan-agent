"""Paramiko SSH/SFTP helper functions."""

import logging
from contextlib import contextmanager
from pathlib import Path

import paramiko

from app.config import settings

logger = logging.getLogger(__name__)


@contextmanager
def ssh_connection():
    """Context manager for an SSH connection to the university server."""
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        key_path = Path(settings.SSH_KEY_PATH).expanduser()
        client.connect(
            hostname=settings.SSH_HOST,
            username=settings.SSH_USER,
            key_filename=str(key_path),
        )
        logger.info("SSH connected to %s@%s", settings.SSH_USER, settings.SSH_HOST)
        yield client
    finally:
        client.close()
        logger.info("SSH connection closed")


def run_command(command: str) -> tuple[str, str, int]:
    """Run a command over SSH. Returns (stdout, stderr, exit_code)."""
    with ssh_connection() as client:
        stdin, stdout, stderr = client.exec_command(command)
        exit_code = stdout.channel.recv_exit_status()
        out = stdout.read().decode()
        err = stderr.read().decode()
        logger.info("SSH command '%s' exited with %d", command, exit_code)
        return out, err, exit_code


def upload_file(local_path: str, remote_path: str) -> None:
    """Upload a file via SFTP."""
    with ssh_connection() as client:
        sftp = client.open_sftp()
        try:
            sftp.put(local_path, remote_path)
            logger.info("Uploaded %s -> %s", local_path, remote_path)
        finally:
            sftp.close()


def download_file(remote_path: str, local_path: str) -> None:
    """Download a file via SFTP."""
    with ssh_connection() as client:
        sftp = client.open_sftp()
        try:
            sftp.get(remote_path, local_path)
            logger.info("Downloaded %s -> %s", remote_path, local_path)
        finally:
            sftp.close()
