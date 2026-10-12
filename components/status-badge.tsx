import { Badge, type Tone } from "@/components/ui/badge";
import type { DocumentStatus, RecipientStatus } from "@/lib/domain/types";
import { t } from "@/lib/i18n";

const documentTones: Record<DocumentStatus, Tone> = {
  draft: "neutral",
  in_progress: "accent",
  completed: "success",
  declined: "danger",
  cancelled: "neutral",
  expired: "warning",
};

const recipientTones: Record<RecipientStatus, Tone> = {
  waiting: "neutral",
  sent: "accent",
  viewed: "accent",
  signed: "success",
  declined: "danger",
};

export function DocumentStatusBadge({ status }: { status: DocumentStatus }) {
  return <Badge tone={documentTones[status]}>{t(`documentStatus.${status}`)}</Badge>;
}

export function RecipientStatusBadge({ status }: { status: RecipientStatus }) {
  return <Badge tone={recipientTones[status]}>{t(`recipientStatus.${status}`)}</Badge>;
}
