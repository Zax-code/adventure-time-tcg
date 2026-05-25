import { Socket, type Channel } from "phoenix";

function socketUrlForBaseUrl(baseUrl: string) {
  const url = new URL(baseUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/socket";
  url.search = "";
  url.hash = "";
  return url.toString();
}

let socket: Socket | null = null;
let channel: Channel | null = null;
let currentKey: string | null = null;

export function connectQuestRealtime(opts: {
  baseUrl: string;
  token: string;
  userId: string;
  onQuestReset: (payload: unknown) => void;
}) {
  const key = `${opts.baseUrl}:${opts.userId}:${opts.token}`;

  if (currentKey === key && socket && channel) {
    return () => disconnectQuestRealtime();
  }

  disconnectQuestRealtime();

  socket = new Socket(socketUrlForBaseUrl(opts.baseUrl), {
    params: { token: opts.token },
  });
  socket.connect();

  channel = socket.channel(`quests:${opts.userId}`);
  channel.on("quest_reset", opts.onQuestReset);
  channel.join();

  currentKey = key;

  return () => disconnectQuestRealtime();
}

export function disconnectQuestRealtime() {
  channel?.leave();
  channel = null;
  socket?.disconnect();
  socket = null;
  currentKey = null;
}
