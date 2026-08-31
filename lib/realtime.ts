import type Echo from "laravel-echo";
import { getToken } from "./api";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;
const REVERB_APP_KEY = process.env.NEXT_PUBLIC_REVERB_APP_KEY;
const REVERB_HOST = process.env.NEXT_PUBLIC_REVERB_HOST;
const REVERB_PORT = process.env.NEXT_PUBLIC_REVERB_PORT;
const REVERB_SCHEME = process.env.NEXT_PUBLIC_REVERB_SCHEME ?? "https";

type EchoInstance = Echo<"reverb">;

let echoPromise: Promise<EchoInstance | null> | null = null;

async function loadEcho(): Promise<EchoInstance | null> {
  if (typeof window === "undefined") return null;
  if (!REVERB_APP_KEY || !REVERB_HOST || !REVERB_PORT) return null;

  if (!echoPromise) {
    echoPromise = (async () => {
      const [{ default: EchoClass }, { default: Pusher }] = await Promise.all([
        import("laravel-echo"),
        import("pusher-js"),
      ]);

      // Reverb speaks the Pusher protocol; laravel-echo needs the Pusher
      // client attached to window for its 'reverb'/'pusher' broadcaster.
      (window as unknown as { Pusher: typeof Pusher }).Pusher = Pusher;

      const port = Number(REVERB_PORT);
      const forceTLS = REVERB_SCHEME === "https";

      return new EchoClass({
        broadcaster: "reverb",
        key: REVERB_APP_KEY,
        wsHost: REVERB_HOST,
        wsPort: port,
        wssPort: port,
        forceTLS,
        enabledTransports: forceTLS ? ["wss"] : ["ws"],
        // Bearer-token auth (this app has no Sanctum SPA cookie session) —
        // Echo's default authorizer assumes cookies/axios, so it's replaced
        // with a plain fetch carrying the same Authorization header used
        // everywhere else (see lib/api.ts's getToken()).
        authorizer: (channel: { name: string }) => ({
          authorize: (
            socketId: string,
            callback: (error: Error | null, data: { auth: string } | null) => void
          ) => {
            fetch(`${API_BASE}/broadcasting/auth`, {
              method: "POST",
              headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                Accept: "application/json",
                ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
              },
              body: new URLSearchParams({
                socket_id: socketId,
                channel_name: channel.name,
              }),
            })
              .then((res) => {
                if (!res.ok) throw new Error(`auth failed: ${res.status}`);
                return res.json();
              })
              .then((data) => callback(null, data))
              .catch((error: Error) => callback(error, null));
          },
        }),
      }) as EchoInstance;
    })();
  }

  return echoPromise;
}

export async function subscribeToUserNotifications(
  userId: string | number,
  onEvent: (data: { notification_id: number }) => void
): Promise<() => void> {
  const echo = await loadEcho();
  if (!echo) return () => {};

  const channelName = `notifications.${userId}`;
  echo.private(channelName).listen(".notification.created", onEvent);

  return () => {
    echo.leave(channelName);
  };
}
