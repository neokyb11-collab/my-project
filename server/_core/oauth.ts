import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

export function registerOAuthRoutes(app: Express) {
  app.get("/api/oauth/google", (req: Request, res: Response) => {
    const clientId = process.env.GOOGLE_CLIENT_ID!;
    const redirectUri = `${process.env.OAUTH_SERVER_URL}/api/oauth/google/callback`;
    const scope = "openid email profile";
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}`;
    res.redirect(url);
  });

  app.get("/api/oauth/google/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    if (!code) {
      res.status(400).json({ error: "code is required" });
      return;
    }
    try {
      const clientId = process.env.GOOGLE_CLIENT_ID!;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
      const redirectUri = `${process.env.OAUTH_SERVER_URL}/api/oauth/google/callback`;

      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }),
      });
      const tokenData = await tokenRes.json() as any;
      const idToken = tokenData.id_token;
      const payload = JSON.parse(Buffer.from(idToken.split(".")[1], "base64").toString());
      const openId = payload.sub;
      const email = payload.email;
      const name = payload.name;

      await db.upsertUser({
        openId,
        name: name || null,
        email: email || null,
        loginMethod: "google",
        lastSignedIn: new Date(),
      });

      const cookieOptions = getSessionCookieOptions(req);
const cookieOptions = getSessionCookieOptions(req);
res.cookie(COOKIE_NAME, openId, { 
  ...cookieOptions, 
  maxAge: ONE_YEAR_MS,
  httpOnly: true,
  secure: true,
  sameSite: 'lax'
});

      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Google callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}