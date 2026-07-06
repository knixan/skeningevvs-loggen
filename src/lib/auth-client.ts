import { createAuthClient } from "better-auth/react";

// Ingen baseURL behövs – klienten pratar med /api/auth på samma origin.
export const authClient = createAuthClient();

export const { signIn, signUp, signOut, useSession } = authClient;

export default authClient;
