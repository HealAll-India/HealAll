import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import { relativeTime } from "@/lib/format";
import type { ConversationResponse } from "@/lib/types/api";

interface Props {
  conversation: ConversationResponse;
  myId: string;
}

/** One conversation in the list: who it's with, the latest message, and when. */
export function ConversationRow({ conversation, myId }: Props) {
  const name = conversation.other_member?.name ?? "HealAll member";
  const last = conversation.last_message;
  const when = last?.created_at ?? conversation.created_at;

  let preview: string;
  if (conversation.blocked) preview = "This conversation is no longer available.";
  else if (last) preview = last.sender_id === myId ? `You: ${last.body}` : last.body;
  else if (conversation.ended_at) preview = "Conversation ended";
  else preview = "No messages yet. Say hello!";

  const content = (
    <>
      <Avatar name={name} src={conversation.other_member?.avatar_url} />
      <span className="conv-row__body">
        <span className="conv-row__top">
          <span className="conv-row__name">{name}</span>
          <time className="conv-row__time" dateTime={when}>
            {relativeTime(when)}
          </time>
        </span>
        <span className={last ? "conv-row__preview" : "conv-row__preview conv-row__preview--muted"}>{preview}</span>
        {conversation.ended_at && last ? <span className="conv-row__ended">Ended</span> : null}
      </span>
    </>
  );

  // The API refuses the thread across a block, so there is nothing to open.
  if (conversation.blocked) {
    return (
      <li>
        <div className="conv-row conv-row--unavailable">{content}</div>
      </li>
    );
  }

  return (
    <li>
      <Link href={`/messages/${conversation.id}`} className="conv-row">
        {content}
        <ChevronRight className="conv-row__chevron" size={18} aria-hidden="true" />
      </Link>
    </li>
  );
}
