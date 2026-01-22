# Quality Check (QA) Management System

A full-stack application for managing textile quality inspections, generating reports, and tracking analytics.

## Tech Stack

- **Backend**: Django, Django REST Framework, SQLite (Local), ReportLab (PDF), SimpleJWT (Auth).
- **Frontend**: React, TypeScript, Vite, TailwindCSS, ShadCN UI, React Query.

## Prerequisites

- Python 3.10+
- Node.js 18+

## Setup Instructions

### 1. Backend Setup

1.  Navigate to the project root:
    ```bash
    cd quality_check_project
    ```
2.  Create a virtual environment:
    ```bash
    python -m venv venv
    source venv/bin/activate  # On Windows: venv\Scripts\activate
    ```
3.  Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```
4.  Run migrations:
    ```bash
    python manage.py migrate
    ```
5.  Create a superuser:
    ```bash
    python manage.py createsuperuser
    ```
6.  Start the server:
    ```bash
    python manage.py runserver
    ```

### 2. Frontend Setup

1.  Navigate to the frontend directory:
    ```bash
    cd frontend
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Start the development server:
    ```bash
    npm run dev
    ```

## Usage

1.  Open `http://localhost:5173` in your browser.
2.  Login with your superuser credentials.
3.  **Dashboard**: View high-level analytics.
4.  **Customers**: Add customers and their email addresses.
5.  **Templates**: Create inspection templates with Points of Measure (POM), tolerances, and standard values.
6.  **Inspections**:
    - Create a new inspection.
    - Select a customer and template.
    - Enter measurements (Pass/Fail is auto-calculated).
    - Upload images.
    - Submit to generate the report.
7.  **Reports**:
    - Click the PDF icon to download the inspection report.
    - Click the Mail icon to email the report to a recipient.

## Project Structure

- `qc/`: Django app for Quality Control logic (Models, Views, Serializers).
- `quality_check/`: Main Django project settings.
- `frontend/src/`: React source code.
    - `components/`: Reusable UI components (ShadCN).
    - `pages/`: Main application pages (Login, Dashboard, etc.).
    - `lib/`: Utilities and API client.
