import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
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

// 인증 없이 사용 - 항상 userId=1 (게스트)
const GUEST_USER_ID = 1;

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query(() => ({
      id: GUEST_USER_ID,
      name: "Guest",
      email: null,
      role: "admin",
    })),
    logout: publicProcedure.mutation(() => ({ success: true } as const)),
  }),

  // ─── Settings ───────────────────────────────────────────────────────────────
  settings: router({
    getSettings: publicProcedure.query(async () => {
      const settings = await getUserSettings(GUEST_USER_ID);
      return (
        settings ?? {
          userId: GUEST_USER_ID,
          claudeApiKey: null,
          geminiApiKey: null,
          deepgramApiKey: null,
          preferredLlm: "gemini",
          preferredTranscriber: "whisper",
        }
      );
    }),

    updateSettings: publicProcedure
      .input(
        z.object({
          claudeApiKey: z.string().optional(),
          geminiApiKey: z.string().optional(),
          deepgramApiKey: z.string().optional(),
          preferredLlm: z.enum(["claude", "gemini"]).optional(),
          preferredTranscriber: z.enum(["whisper", "deepgram"]).optional(),
        })
      )
      .mutation(async ({ input }) => {
        await upsertUserSettings(
          GUEST_USER_ID,
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
    createProject: publicProcedure
      .input(z.object({ projectName: z.string().min(1), script: z.string().min(1) }))
      .mutation(async ({ input }) => {
        const projectId = await createSubtitleProject(
          GUEST_USER_ID,
          input.projectName.trim(),
          input.script.trim()
        );
        return { projectId };
      }),

    getProject: publicProcedure
      .input(z.object({ projectId: z.string() }))
      .query(async ({ input }) => {
        const project = await getSubtitleProject(input.projectId, GUEST_USER_ID);
        if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "프로젝트를 찾을 수 없습니다" });
        return project;
      }),

    uploadAudioFile: publicProcedure
      .input(
        z.object({
          projectId: z.string(),
          fileName: z.string(),
          fileData: z.string(), // base64
          fileOrder: z.number().int().min(0),
          mimeType: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        try {
          const buffer = Buffer.from(input.fileData, "base64");
          const contentType = input.mimeType ?? "audio/mpeg";
          const storageKey = `projects/${input.projectId}/audio/${input.fileOrder}_${Date.now()}_${input.fileName}`;

          const { key } = await storagePut(storageKey, buffer, contentType);

          await addAudioFile(
            GUEST_USER_ID,
            input.projectId,
            input.fileName,
            buffer.length,
            input.fileOrder,
            key
          );

          return { success: true, storageKey: key };
        } catch (error) {
          console.error("[routers] uploadAudioFile 실패:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `파일 업로드 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}`,
          });
        }
      }),

    generateSubtitles: publicProcedure
      .input(z.object({ projectId: z.string() }))
      .mutation(async ({ input }) => {
        const result = await generateSubtitlesForProject(input.projectId, GUEST_USER_ID);

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
