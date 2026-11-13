import { SeverityNumber } from "@opentelemetry/api-logs";
import { loggerProvider } from "../../instrumentation";

const logger = loggerProvider?.getLogger("su-manager");

export function logNotificationDispatchSkipped(kind: "morning" | "evening") {
  logger?.emit({
    body: "notification_dispatch_skipped_no_devices",
    severityNumber: SeverityNumber.INFO,
    attributes: { notification_kind: kind },
  });
}

export function logNotificationDispatchCompleted({
  kind,
  notificationCount,
  deviceCount,
}: {
  kind: "morning" | "evening";
  notificationCount: number;
  deviceCount: number;
}) {
  logger?.emit({
    body: "notification_dispatch_completed",
    severityNumber: SeverityNumber.INFO,
    attributes: {
      notification_kind: kind,
      notification_count: notificationCount,
      device_count: deviceCount,
    },
  });
}

export async function flushPostHogLogs() {
  await loggerProvider?.forceFlush();
}
