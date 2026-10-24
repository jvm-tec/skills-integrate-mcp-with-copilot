# Mergington High School Activities API

A super simple FastAPI application that allows students to view and sign up for extracurricular activities.

## Features

- View all available extracurricular activities
- Teacher login for registering and unregistering students
- Students can view activities and participants without logging in

## Getting Started

1. Install the dependencies:

   ```
   pip install fastapi uvicorn
   ```

2. Create a private teacher credentials file from the example:

   ```
   cp src/teachers.example.json src/teachers.json
   ```

   Generate a password hash for each assigned teacher password:

   ```python
   import getpass
   import hashlib
   import secrets

   iterations = 600_000
   salt = secrets.token_bytes(16)
   password = getpass.getpass("Teacher password: ").encode("utf-8")
   digest = hashlib.pbkdf2_hmac("sha256", password, salt, iterations)
   print(f"pbkdf2_sha256${iterations}${salt.hex()}${digest.hex()}")
   ```

   Add each username and generated hash to the `teachers` array in
   `src/teachers.json`, using `password_hash` for the hash field. This private
   file is ignored by Git. Never commit teacher passwords or hashes. The
   backend also accepts an alternate file path through
   `TEACHER_CREDENTIALS_FILE`.

3. Run the application:

   ```
   uvicorn src.app:app --reload
   ```

   Set `SESSION_COOKIE_SECURE=false` only when accessing the app over plain HTTP
   during local development. The default requires HTTPS.

4. Open your browser and go to:
   - API documentation: http://localhost:8000/docs
   - Alternative documentation: http://localhost:8000/redoc

## API Endpoints

| Method | Endpoint                                                          | Description                                                         |
| ------ | ----------------------------------------------------------------- | ------------------------------------------------------------------- |
| GET    | `/activities`                                                     | Get all activities with their details and current participant count |
| GET    | `/auth/status`                                                    | Check whether the current browser has a teacher session              |
| POST   | `/auth/login`                                                     | Start a teacher session using a JSON username and password           |
| POST   | `/auth/logout`                                                    | End the current teacher session                                      |
| POST   | `/activities/{activity_name}/signup?email=student@mergington.edu` | (Teacher only) Sign up a student for an activity                     |
| DELETE | `/activities/{activity_name}/unregister?email=student@mergington.edu` | (Teacher only) Remove a student from an activity                 |

Teacher sessions use an HTTP-only, SameSite=Strict cookie and expire after
eight hours. The cookie is Secure by default, so production deployments must
use HTTPS. Login and logout sessions are stored in memory and are invalidated
when the application restarts.
## Data Model

The application uses a simple data model with meaningful identifiers:

1. **Activities** - Uses activity name as identifier:

   - Description
   - Schedule
   - Maximum number of participants allowed
   - List of student emails who are signed up

2. **Students** - Uses email as identifier:
   - Name
   - Grade level

All data is stored in memory, which means data will be reset when the server restarts.
