import { clockTime, dayLabel } from "@/lib/format";
import type { MessageResponse } from "@/lib/types/api";

interface Props {
  messages: MessageResponse[];
  myId: string;
  otherName: string;
}

/**
 * The thread's messages in order, with a heading for each new day. Each
 * bubble says who sent it for screen readers; sighted members get the side.
 */
export function MessageList({ messages, myId, otherName }: Props) {
  const items: React.ReactNode[] = [];
  let currentDay = "";

  for (const message of messages) {
    const day = dayLabel(message.created_at);
    if (day !== currentDay) {
      currentDay = day;
      items.push(
        <li key={`day-${message.id}`} className="thread__day">
          {day}
        </li>,
      );
    }
    const mine = message.sender_id === myId;
    items.push(
      <li key={message.id} className={mine ? "bubble bubble--mine" : "bubble bubble--other"}>
        <span className="sr-only">{mine ? "You" : otherName}: </span>
        <p className="bubble__text">{message.body}</p>
        <time className="bubble__time" dateTime={message.created_at}>
          {clockTime(message.created_at)}
        </time>
      </li>,
    );
  }

  return <ol className="thread__messages">{items}</ol>;
}
