# Lawnova Web Client

This directory contains the React + Tailwind CSS frontend for the Lawnova web application. It provides a complete user management interface for both students and administrators.

## Tech Stack

- **Framework**: [React.js](https://reactjs.org/) (via [Vite](https://vitejs.dev/))
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Routing**: [React Router](https://reactrouter.com/)
- **API Communication**: [Axios](https://axios-http.com/)
- **Form Management**: [React Hook Form](https://react-hook-form.com/)
- **Schema Validation**: [Zod](https://zod.dev/)
- **State Management**: React Context API (`AuthContext`)
- **UI Components**: Custom, reusable components built with Tailwind CSS.
- **Icons**: [Lucide React](https://lucide.dev/)
- **Notifications**: [React Hot Toast](https://react-hot-toast.com/)

## Features

### Authentication
- [x] User Login (`/login`)
- [x] User Registration (`/register`)
- [x] JWT-based authentication with automated token refresh.
- [x] Persistent session using `localStorage` for refresh tokens.
- [ ] Forgot/Reset Password flow (UI placeholders needed).

### Student Role
- [x] Protected dashboard (`/dashboard`) with placeholder stats.
- [x] Profile management page (`/profile`) to update user details.
- [x] Change password functionality.

### Admin Role
- [x] Protected admin dashboard (`/admin/dashboard`) with user statistics.
- [x] User management table (`/admin/users`) with:
  - [x] Search by name/email.
  - [x] Filter by user status (All, Active, Inactive).
  - [x] Activate/Deactivate users.
- [ ] User detail view (`/admin/users/:id`).
- [ ] Admin ability to reset user passwords.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18.x or later recommended)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)
- A running instance of the Lawnova backend services (specifically `user-service` and `api-gateway`).

### Installation

1.  **Navigate to the web-client directory:**
    ```bash
    cd web-client
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```
    or
    ```bash
    yarn install
    ```

### Environment Variables

The application requires a `.env` file in the `web-client` root directory to connect to the backend API gateway.

1.  Create a file named `.env`:
    ```bash
    touch .env
    ```

2.  Add the following environment variable. This should point to your running API gateway.
    ```
    VITE_API_BASE_URL=http://localhost:5000
    ```

### Running the Development Server

Once dependencies are installed and the environment is configured, you can start the Vite development server:

```bash
npm run dev
```

The application will be available at `http://localhost:3000`.

## Project Structure

```
web-client/
 ├── src/
 │   ├── components/      # Reusable UI components (Button, Input) and layouts
 │   ├── pages/           # Top-level page components for each route
 │   ├── services/        # API service (Axios instance and interceptors)
 │   ├── context/         # React Context for global state (AuthContext)
 │   ├── hooks/           # Custom React hooks
 │   ├── routes/          # Routing configuration and protected route logic
 │   ├── lib/             # Utility functions
 │   ├── App.jsx          # Main application component with routing
 │   └── main.jsx         # Application entry point
 ├── tailwind.config.js   # Tailwind CSS configuration
 ├── package.json         # Project dependencies and scripts
 └── .env                 # Environment variables (local, not committed)
```
