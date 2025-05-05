# Firebase Studio - HealthWise Hub

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

2.  **Configure Firebase:**
    *   Create a Firebase project at [https://console.firebase.google.com/](https://console.firebase.google.com/).
    *   Enable Firestore Database in your Firebase project.
    *   Go to Project settings > General > Your apps.
    *   If you don't have a Web app, create one.
    *   Find the "SDK setup and configuration" section and copy the `firebaseConfig` values.
    *   Create a file named `.env.local` in the root of your project.
    *   Add the following environment variables to your `.env.local` file, replacing the placeholder values with your actual Firebase project credentials:

        ```dotenv
        NEXT_PUBLIC_FIREBASE_API_KEY=YOUR_API_KEY
        NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=YOUR_AUTH_DOMAIN
        NEXT_PUBLIC_FIREBASE_PROJECT_ID=YOUR_PROJECT_ID
        NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=YOUR_STORAGE_BUCKET
        NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=YOUR_MESSAGING_SENDER_ID
        NEXT_PUBLIC_FIREBASE_APP_ID=YOUR_APP_ID
        # NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=YOUR_MEASUREMENT_ID # Optional

        # If using GenAI features with Google AI
        GOOGLE_GENAI_API_KEY=YOUR_GOOGLE_AI_API_KEY
        ```
    *   **Important:** The application relies on these Firebase credentials. Without valid configuration in `.env.local`, Firebase features (including database access and seeding) will be disabled. Firebase offers a generous free tier ("Spark Plan") suitable for development and small applications.

3.  **Seed Database (Optional but Recommended for Development):**
    *   Ensure your Firebase configuration in `.env.local` is correct.
    *   Run the application (`npm run dev`).
    *   Navigate to the `/seed` page in your browser (e.g., `http://localhost:9002/seed`).
    *   Click the "Seed Database" button. This will populate your Firestore with mock data for patients, doctors, health data, etc., using placeholder IDs (`test-patient-id`, `test-doctor-id`).

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

*   **Patient Dashboard:** View health trends, medication adherence, report symptoms.
*   **Doctor Dashboard:** Manage assigned patients, view summaries, monitor health data, review AI suggestions, chat with patients.
*   **Admin Dashboard:** User management, system audit logs (simulated).
*   **AI Integration (Genkit):**
    *   Summarize patient history.
    *   Generate suggested interventions based on patient data.
    *   Generate initial care plans.
*   **Firebase Firestore:** Data persistence for users, health data, medications, etc.

## Project Structure

*   `src/app/`: Next.js App Router pages and layouts.
*   `src/components/`: React components, including UI elements (`ui/`) and feature-specific components (dashboards).
*   `src/lib/`: Utility functions, including Firebase setup (`firebase.ts`).
*   `src/hooks/`: Custom React hooks (`useToast`, `useMobile`).
*   `src/ai/`: Genkit AI flows and configuration.
*   `public/`: Static assets.

## Technologies Used

*   Next.js (App Router)
*   React
*   TypeScript
*   Tailwind CSS
*   Shadcn/ui
*   Firebase (Firestore, Auth - currently disabled)
*   Genkit (for AI features)
*   Recharts (for charts)
*   Zod (for schema validation)
*   Faker.js (for data seeding)
