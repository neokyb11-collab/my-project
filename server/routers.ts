import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import z from "zod";
import {
  createSubtitleProject,
  getSubtitleProject,
  addAudioFile,
  getUserSettings,
  upsertUserSettings,
} from "./db";
import { storagePut } from "./storage";
import { generateSubtitlesForProject } from "./subtitleService";

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ─── Settings ───────────────────────────────────────────────────────────────
  settings: router({
    getSettings: protectedProcedure.query(async ({ ctx }) => {
      const settings = await getUserSettings(ctx.user.id);
      return (
        settings ?? {
          userId: ctx.user.id,
          claudeApiKey: null,
          geminiApiKey: null,
          deepgramApiKey: null,
          preferredLlm: "claude",
          preferredTranscriber: "whisper",
        }
      );
    }),

    updateSettings: protectedProcedure
      .input(
        z.object({
          claudeApiKey: z.string().optional(),
          geminiApiKey: z.string().optional(),
          deepgramApiKey: z.string().optional(),
          preferredLlm: z.enum(["claude", "gemini"]).optional(),
          preferredTranscriber: z.enum(["whisper", "deepgram"]).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await upsertUserSettings(
          ctx.user.id,
          input.claudeApiKey,
          input.geminiApiKey,
          input.deepgramApiKey,
          input.preferredLlm,
          input.preferredTranscriber
        );
        return { success: true };
      }),
  }),

  // ─── Subtitles ───────────────────────────────────────────────────────────────
  subtitles: router({
    createProject: protectedProcedure
      .input(z.object({ projectName: z.string().min(1), script: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const projectId = await createSubtitleProject(
          ctx.user.id,
          input.projectName.trim(),
          input.script.trim()
        );
        return { projectId };
      }),

    getProject: protectedProcedure
      .input(z.object({ projectId: z.string() }))
      .query(async ({ ctx, input }) => {
        const project = await getSubtitleProject(input.projectId, ctx.user.id);
        if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
        return project;
      }),

    /**
     * Upload a single audio file (base64-encoded) to S3 and record it in DB.
     * Returns the storage key so the client can confirm the upload.
     */
    uploadAudioFile: protectedProcedure
      .input(
        z.object({
          projectId: z.string(),
          fileName: z.string(),
          fileData: z.string(), // base64
          fileOrder: z.number().int().min(0),
          mimeType: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        try {
          const buffer = Buffer.from(input.fileData, "base64");
          const contentType = input.mimeType ?? "audio/mpeg";
          const storageKey = `projects/${input.projectId}/audio/${input.fileOrder}_${Date.now()}_${input.fileName}`;

          const { key } = await storagePut(storageKey, buffer, contentType);

          await addAudioFile(
            ctx.user.id,
            input.projectId,
            input.fileName,
            buffer.length,
            input.fileOrder,
            key
          );

          return { success: true, storageKey: key };
        } catch (error) {
          console.error("[routers] uploadAudioFile failed:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `파일 업로드 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}`,
          });
        }
      }),

    /**
     * Trigger subtitle generation for a project.
     * This is a synchronous mutation – it waits for the full pipeline to finish.
     * The client should show a progress overlay while waiting.
     */
    generateSubtitles: protectedProcedure
      .input(z.object({ projectId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const result = await generateSubtitlesForProject(input.projectId, ctx.user.id);

        if (!result.success) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: result.error ?? "자막 생성에 실패했습니다",
          });
        }

        return {
          success: true,
          projectId: input.projectId,
          srtContent: result.srtContent,
        };
      }),
  }),
});

export type AppRouter = typeof appRouter;
