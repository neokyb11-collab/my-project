// 인증 제거 - 항상 게스트 유저로 처리
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

// 인증 없이 사용할 고정 게스트 유저
const GUEST_USER: User = {
  id: 1,
  openId: "guest",
  name: "Guest",
  email: null,
  loginMethod: null,
  role: "admin",
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  return {
    req: opts.req,
    res: opts.res,
    user: GUEST_USER,
  };
}
