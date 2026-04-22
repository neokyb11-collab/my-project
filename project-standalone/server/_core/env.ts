export const ENV = {
  cookieSecret: process.env.JWT_SECRET ?? "standalone-secret-change-me",
  databaseUrl: process.env.DATABASE_URL ?? "",
  isProduction: process.env.NODE_ENV === "production",
  uploadDir: process.env.UPLOAD_DIR ?? "uploads",
};
