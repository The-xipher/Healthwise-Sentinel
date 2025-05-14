
# HealthWise Hub

This is a Next.js application designed for post-discharge patient care management using AI-driven insights.

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
        # Replace 'your_mongodb_password' with your actual MongoDB Atlas password for the 'amithxipher' user.
        # Example: MONGODB_URI=mongodb+srv://amithxipher:Password@55555@health.bqy9gqs.mongodb.net/?appName=Health
        MONGODB_URI=mongodb+srv://amithxipher:Password%4055555@health.bqy9gqs.mongodb.net/?appName=Health
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


## Key Features

*   **Patient Dashboard:** View health trends, medication adherence, report symptoms, chat with doctor.
*   **Doctor Dashboard:** Manage assigned patients, view summaries, monitor health data, review AI suggestions, chat with patients, view appointments.
*   **Admin Dashboard:** User management (view, add new users with email notifications), system audit logs (simulated).
*   **AI Integration (Genkit):**
    *   Summarize patient history.
    *   Generate suggested interventions based on patient data.
    *   Generate initial care plans.
*   **MongoDB:** Data persistence for users, health data, medications, etc.
*   **Email Notifications (Brevo):** Welcome emails for new users.
*   **Firebase (Potentially for Auth):** User authentication (currently custom, Firebase can be re-enabled).

## Project Structure

*   `src/app/`: Next.js App Router pages and layouts.
*   `src/components/`: React components, including UI elements (`ui/`) and feature-specific components (dashboards).
*   `src/lib/`: Utility functions, including Firebase setup (`firebase.ts`), MongoDB setup (`mongodb.ts`), database seeding (`seed-db.ts`), and email service (`email.ts`).
*   `src/hooks/`: Custom React hooks (`useToast`, `useMobile`).
*   `src/ai/`: Genkit AI flows and configuration.
*   `public/`: Static assets.

## Technologies Used

*   Next.js (App Router)
*   React
*   TypeScript
*   Tailwind CSS
*   Shadcn/ui
*   MongoDB (via `mongodb` driver)
*   Brevo (for SMTP email)
*   Nodemailer
*   Genkit (for AI features)
*   Recharts (for charts)
*   Zod (for schema validation)
*   Faker.js (for mock data generation)
*   tsx (for running TS scripts like seeding)

