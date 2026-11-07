export function register() {
  const s = process.env.SESSION_SECRET;
  if (process.env.NODE_ENV === "production" && !(s && s.length >= 16)) {
    throw new Error("SESSION_SECRET must be set (16+ characters) in production");
  }
}
