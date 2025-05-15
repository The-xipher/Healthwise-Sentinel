# Healthwise Hub

## Overview
Healthwise Sentinel is a connected care platform designed to enhance proactive healthcare management through AI-driven insights and efficient communication between patients, doctors, and administrators. Built with modern web technologies, the platform ensures a seamless user experience tailored to the needs of each role.

---

## Getting Started

1.  **Install Dependencies:**
    ```bash
    npm install
    # or
    yarn install
    # or
    pnpm install
    ```

2.  **Configure Environment Variables:**
    *   Create a file named `.env.local` in the root of your project. If it already exists, update it.
    *   Add or update the following environment variables:

        ```dotenv
        # MongoDB Connection URI
        # Replace with you mongodb URI
        MONGODB_URI=[ Your mongodb uri here ]
        # Optional: Specify a database name, or it defaults to 'healthwisehub'
        MONGODB_DB_NAME=healthwisehub_db

        # If using GenAI features with Google AI
        GOOGLE_GENAI_API_KEY=YOUR_GOOGLE_AI_API_KEY_HERE

        # Brevo (Sendinblue) SMTP Credentials for Email Sending
        BREVO_SMTP_HOST=smtp-relay.brevo.com
        BREVO_SMTP_PORT=587 # Or your configured port
        BREVO_SMTP_USER=YOUR_BREVO_SMTP_LOGIN_EMAIL # e.g., 8d02ed001@smtp-brevo.com
        BREVO_SMTP_PASS=YOUR_BREVO_SMTP_PASSWORD_OR_API_KEY # e.g., vH8IykmhV4dzQXqg
        BREVO_SMTP_FROM_EMAIL="Your App Name <noreply@yourdomain.com>" # The "From" address for emails

        # Firebase (Optional - if using Firebase Auth or other Firebase services)
        # NEXT_PUBLIC_FIREBASE_API_KEY=YOUR_API_KEY
        # NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=YOUR_AUTH_DOMAIN
        # NEXT_PUBLIC_FIREBASE_PROJECT_ID=YOUR_PROJECT_ID
        # NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=YOUR_STORAGE_BUCKET # If using Firebase Storage
        # NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=YOUR_MESSAGING_SENDER_ID # If using Firebase Messaging
        # NEXT_PUBLIC_FIREBASE_APP_ID=YOUR_APP_ID
        # NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=YOUR_MEASUREMENT_ID # Optional
        ```
    *   **Important:**
        *   The application relies on `MONGODB_URI` for database connectivity.
        *   Ensure `GOOGLE_GENAI_API_KEY` is set if you intend to use AI features.
        *   Update `BREVO_SMTP_USER`, `BREVO_SMTP_PASS`, and `BREVO_SMTP_FROM_EMAIL` with your actual Brevo credentials for email sending functionality.

3.  **Seed the Database (Optional, for initial mock data):**
    If you want to populate your database with mock data for testing:
    ```bash
    npm run db:seed
    # or
    yarn db:seed
    # or
    pnpm db:seed
    ```
    This script will clear existing data in the specified collections and insert new mock data.

4.  **Run the Development Server:**
    ```bash
    npm run dev
    # or
    yarn dev
    # or
    pnpm dev
    ```
    The application will be available at `http://localhost:9002` (or the specified port).

5.  **Run Genkit Dev Server (Optional - for AI features):**
    If you are working with the GenAI features, run the Genkit development server in a separate terminal:
    ```bash
    npm run genkit:dev
    # or for auto-reloading on changes:
    npm run genkit:watch
    ```

## Features

### I. Core System & User Management

#### User Roles & Authentication
- **Three Distinct Roles**: Patient, Doctor, and Admin, each with tailored dashboards and permissions.
- **Secure Login**: Custom email/password authentication system.
- **Forced Password Change**: New users created by an admin must change their temporary password on first login.
- **Session Management**: Cookie-based sessions.
- **Logout Functionality**.
- **Profile Management**: Users can view and edit their profile information (display name, contact email, emergency contact details, and role-specific info).

#### Landing Page
- An introductory page for the application, highlighting its purpose and key features.

#### Navigation & UI
- **Responsive Sidebar**: Main navigation, dynamically adjusting based on user role.
- **Header**: Displays app logo, user avatar, and a notification system.
- **Modern UI**: Built with Next.js, React, ShadCN UI components, and Tailwind CSS.
- **Pop-up Chat Interface**: For patient-doctor communication, accessible via a floating button.
- **Toaster Notifications**: For feedback on actions (e.g., success/error messages).

---

### II. Patient-Specific Features

#### Patient Dashboard
- Overview of key health metrics (steps, heart rate, blood glucose - simulated).
- Chart displaying recent health trends.

#### Symptom Reporting
- Form to report symptoms with manual severity selection (mild, moderate, severe) and description.
- Submitted reports trigger AI analysis and alerts.

#### Medication Management (Patient View)
- View prescribed medication list with dosage, frequency, and reminder times.
- **"Mark as Taken" Button**: Allows patients to indicate they've taken a specific dose, updating lastTaken timestamp.
- Visual medication reminders displayed in the header notification dropdown if a scheduled dose for the day is missed.

#### AI-Generated & Doctor-Approved Recommendations
- View AI-generated self-care tips (related to mild symptom reports) with a disclaimer "Awaiting Doctor Review."
- View doctor-approved recommendations (which could be general interventions or approved self-care tips).

#### Communication
- Chat with their assigned doctor through the pop-up chat interface.

---

### III. Doctor-Specific Features

#### Doctor Dashboard
- View a list of assigned patients, searchable by name, with visual risk badges.

#### Detailed Patient View (on selecting a patient)
- **Patient Information Card**: Basic details and risk level.
- **AI Patient History Summary**: Quick overview.
- **AI Draft Care Plan**: Initial care plan generated by AI (can be edited/approved).
- **Approved Care Plan Display**: Shows the current doctor-approved care plan, who approved it, and when.
- **Care Plan Management**: Ability to edit and approve care plans.
- **Recent Health Data**: List of recent vital signs and activity.
- **Full Health Data View**: Dialog to view a more extensive history of health data.
- **Medication Overview**: View patient's medications, adherence percentages (mocked), and lastTaken status.

#### Medication Management
- Add new medications for a patient (name, dosage, frequency, reminder times).
- Edit existing medications.
- Delete medications (with confirmation).

#### AI Health Trend Analysis
- Proactively analyzes patient data for concerning trends, provides a summary, and suggests actions for the doctor.

#### AI Suggested Interventions Review
- View AI-generated suggestions (including self-care tips from patients) and approve or reject them.

#### Appointments
- View a schedule of upcoming appointments.

#### Communication
- Chat with the selected patient through the pop-up chat interface.
- Receive "System Alerts" and "System Info" messages regarding patient-reported symptoms and AI analysis.

---

### IV. Admin-Specific Features

#### Admin Dashboard

#### User Management
- View a table of all system users (patients, doctors, admins).
- **Add New Users**: Form to create new patient, doctor, or admin accounts. Includes fields for role-specific details (e.g., specialty for doctors, emergency contacts for patients).
- **Edit Existing Users**: Modify details like display name, contact email, and role-specific information.
- **Delete Users**: Remove user accounts (with confirmation).

#### System Alert Simulation
- Ability to simulate a critical health alert for any patient to test the alerting workflow (emergency email, doctor notification).

#### System Audit Logs
- Simulated display of recent system activity.

---

### V. AI-Driven Features (Integrated Across Roles)

#### Symptom Severity Analysis
- Analyzes patient-reported symptoms, their risk profile, and latest vitals.
- Determines an objective severity level and provides justification.
- Recommends if a critical alert is needed.
- Suggests follow-up actions:
  - Self-care tips for patients (for mild AI-determined severity), saved as 'pending' suggestions.
  - Specific questions for doctors to ask patients (for moderate AI-determined severity), sent as info to the doctor.

#### AI Health Trend Analysis (for Doctors)
- Identifies concerning patterns in patient health data, medication adherence, and risk profile.
- Provides a summary of the trend and a suggested actionable step for the doctor.

#### Patient History Summarization (for Doctors)

#### Care Plan Generation (AI Draft for Doctors)

#### General Intervention Suggestions (for Doctors)

---

### VI. Notification & Alerting System

#### Header Notifications
- Bell icon with a badge indicating the count of unread messages and important alerts.
- Dropdown displays a list of unread messages, system alerts (critical/info), and medication reminders.
- Notifications link to the relevant dashboard/patient view.

#### Email Alerts
- Automated email sent to a patient's emergencyContactEmail when they (or an admin simulating for them) report severe symptoms or if the AI analysis deems the situation critical.

#### Doctor Notifications
- "System Alert" or "System Info" messages appear in the doctor's chat queue and notification dropdown for critical patient events, new symptom reports, and AI insights.

---

## Media

### Demo Video
[Placeholder for Demo Video]

### Architecture Diagram
[Placeholder for Architecture Image]

---

## Goal
Showcase a connected care loop involving AI, a patient, a doctor, and an admin, highlighting proactive care and efficiency.

