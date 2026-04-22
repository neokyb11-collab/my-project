import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import * as db from "../db";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

const GUEST_USER: User = {
  id: 1,
  openId: "guest",
  name: "Guest",
  email: null,
  loginMethod: "guest",
  role: "user",
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  // Ensure guest user exists in DB
  try {
    await db.upsertUser({
      openId: "guest",
      name: "Guest",
      email: null,
      loginMethod: "guest",
      lastSignedIn: new Date(),
    });
  } catch (e) {}

  return {
    req: opts.req,
    res: opts.res,
    user: GUEST_USER,
  };
}