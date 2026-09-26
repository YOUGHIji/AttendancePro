import bcrypt from "bcryptjs";

const PASSWORD_ROUNDS = 12;

/** The temporary password issued for a new account, e.g. "Geeta1455". */
export function createTemporaryPassword(name: string, mobileNumber: string): string {
  const firstName = name.trim().split(/\s+/)[0]?.replace(/[^a-zA-Z]/g, "") || "User";
  const lastFourDigits = mobileNumber.replace(/\D/g, "").slice(-4);
  return `${firstName}${lastFourDigits}`;
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, PASSWORD_ROUNDS);
}

export function comparePassword(password: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}
