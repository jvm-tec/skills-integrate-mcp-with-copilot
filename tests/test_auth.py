import hashlib
import hmac
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi import HTTPException, Response
from starlette.requests import Request

from src import app


def make_password_hash(password: str, salt: bytes, iterations: int) -> str:
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt, iterations
    )
    return f"pbkdf2_sha256${iterations}${salt.hex()}${digest.hex()}"


def make_request(cookie: str | None = None) -> Request:
    headers = []
    if cookie is not None:
        headers.append((b"cookie", cookie.encode("ascii")))
    return Request(
        {
            "type": "http",
            "method": "GET",
            "path": "/",
            "headers": headers,
            "query_string": b"",
            "server": ("testserver", 80),
            "client": ("testclient", 50000),
            "scheme": "http",
        }
    )


class TeacherAuthTests(unittest.TestCase):
    def setUp(self):
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.credentials_file = Path(self.temporary_directory.name) / "teachers.json"
        self.password_hash = make_password_hash(
            "correct horse", b"test-salt-16byte", 100_000
        )
        self.credentials_file.write_text(
            json.dumps(
                {
                    "teachers": [
                        {
                            "username": "teacher",
                            "password_hash": self.password_hash,
                        }
                    ]
                }
            ),
            encoding="utf-8",
        )
        self.credentials_path_patch = patch.object(
            app, "TEACHER_CREDENTIALS_FILE", self.credentials_file
        )
        self.credentials_path_patch.start()
        self.secure_cookie_patch = patch.object(app, "SESSION_COOKIE_SECURE", False)
        self.secure_cookie_patch.start()

    def tearDown(self):
        self.secure_cookie_patch.stop()
        self.credentials_path_patch.stop()
        self.temporary_directory.cleanup()

    def test_password_hash_verification(self):
        self.assertTrue(
            app.verify_teacher_password("correct horse", self.password_hash)
        )
        self.assertFalse(
            app.verify_teacher_password("wrong password", self.password_hash)
        )
        self.assertFalse(app.verify_teacher_password("anything", "invalid"))

    def test_login_creates_teacher_session(self):
        response = Response()
        result = app.login(
            app.TeacherCredentials(username="teacher", password="correct horse"),
            response,
        )

        self.assertEqual(result, {"authenticated": True, "username": "teacher"})
        cookie_header = response.headers["set-cookie"]
        token = cookie_header.split(";", 1)[0].split("=", 1)[1]
        self.assertEqual(
            app.get_teacher_username(
                make_request(f"{app.SESSION_COOKIE_NAME}={token}")
            ),
            "teacher",
        )

    def test_invalid_login_is_rejected(self):
        with self.assertRaises(HTTPException) as error:
            app.login(
                app.TeacherCredentials(
                    username="teacher", password="wrong password"
                ),
                Response(),
            )
        self.assertEqual(error.exception.status_code, 401)

    def test_activity_management_requires_teacher_session(self):
        with self.assertRaises(HTTPException) as error:
            app.require_teacher(make_request())
        self.assertEqual(error.exception.status_code, 401)

        response = Response()
        app.login(
            app.TeacherCredentials(username="teacher", password="correct horse"),
            response,
        )
        token = response.headers["set-cookie"].split(";", 1)[0].split("=", 1)[1]
        username = app.require_teacher(
            make_request(f"{app.SESSION_COOKIE_NAME}={token}")
        )
        email = "admin-mode-test@mergington.edu"
        app.signup_for_activity("Chess Club", email, username)
        app.unregister_from_activity("Chess Club", email, username)

    def test_missing_credentials_file_reports_configuration_error(self):
        missing_file = self.credentials_file.parent / "missing.json"
        with patch.object(app, "TEACHER_CREDENTIALS_FILE", missing_file):
            with self.assertRaises(HTTPException) as error:
                app.load_teacher_credentials()
        self.assertEqual(error.exception.status_code, 503)


if __name__ == "__main__":
    unittest.main()
