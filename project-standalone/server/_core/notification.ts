// Manus 알림 서비스 제거 - 콘솔 로그로 대체
export type NotificationPayload = {
  title: string;
  content: string;
};

export async function notifyOwner(payload: NotificationPayload): Promise<boolean> {
  console.log("[Notification]", payload.title, payload.content);
  return true;
}
