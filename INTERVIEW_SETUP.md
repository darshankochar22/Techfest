# Interview Setup Feature

## Overview

The AI interviewer can now use your resume and job description to ask targeted, relevant interview questions!

## How to Use

### 1. Prepare Your Files

Create two `.txt` files:

- **resume.txt**: Your resume in plain text format
- **job_description.txt**: The job description in plain text format

### 2. Start Interview with Context

1. Visit the homepage
2. Click "Start Interview" button
3. Upload your resume and/or job description (.txt files only)
4. Click "Start Interview"
5. The AI will now ask questions based on your uploaded context!

### 3. Quick Start (Without Context)

If you want to skip the setup:

1. Click "Quick Start" on the homepage, OR
2. Click "Skip Setup" on the setup page
3. The AI will conduct a general interview without specific context

## API Endpoint

### Upload Context

```
POST /interview/upload-context
```

**Form Data:**

- `session_id` (required): Session identifier
- `resume` (optional): .txt file containing resume
- `job_description` (optional): .txt file containing job description

**Response:**

```json
{
  "sessionId": "session-123",
  "hasResume": true,
  "hasJobDescription": true
}
```

## How It Works

1. When you upload files, they're stored in the backend session
2. The AI system prompt is enhanced with your resume and job description
3. The AI uses this context to ask relevant questions throughout the interview
4. The context persists for the entire session until you reset or start a new interview

## Example Files

### resume.txt

```
John Doe
Software Engineer

Experience:
- 5 years of Python development
- Expertise in FastAPI and Django
- Built scalable microservices
- Led team of 3 developers

Skills:
- Python, JavaScript, React
- AWS, Docker, Kubernetes
- PostgreSQL, MongoDB
```

### job_description.txt

```
Senior Backend Engineer

Requirements:
- 5+ years Python experience
- Experience with FastAPI or Django
- Microservices architecture
- Cloud platforms (AWS/GCP)
- Team leadership experience

Responsibilities:
- Design and implement backend services
- Mentor junior developers
- Collaborate with frontend team
```

## Notes

- Only `.txt` files are accepted
- You can upload just a resume, just a job description, or both
- The context is session-specific and doesn't persist across browser sessions
- Use the reset button to clear the session and start fresh
