"use client";

import { useEffect, useRef, useState } from "react";
import { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

type Role = "caller" | "callee";
type CallType = "audio" | "video";

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

function useQuery() {
  const [params, setParams] = useState<URLSearchParams | null>(null);
  useEffect(() => {
    setParams(new URLSearchParams(window.location.search));
  }, []);
  return params;
}

export default function CallPage() {
  const params = useQuery();
  const dialogId = params?.get("d");
  const userId = params?.get("u");
  const role = (params?.get("r") as Role | null) ?? "callee";
  const callType = (params?.get("t") as CallType | null) ?? "audio";

  const [status, setStatus] = useState("Подключение…");
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteJoinedRef = useRef(false);

  useEffect(() => {
    if (!dialogId || !userId) return;

    try { window.Telegram?.WebApp?.ready?.(); } catch {}
    try { window.Telegram?.WebApp?.expand?.(); } catch {}

    let aborted = false;

    const init = async () => {
      try {
        const constraints: MediaStreamConstraints = {
          audio: true,
          video: callType === "video" ? { facingMode: "user" } : false,
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (aborted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        localStreamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;

        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        pcRef.current = pc;

        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        pc.ontrack = (event) => {
          const [remote] = event.streams;
          if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remote;
          setStatus("В разговоре");
        };

        pc.onconnectionstatechange = () => {
          const state = pc.connectionState;
          if (state === "connected") setStatus("В разговоре");
          else if (state === "disconnected") setStatus("Разрыв связи…");
          else if (state === "failed") {
            setStatus("Не удалось установить соединение");
            setError("Возможно, NAT блокирует соединение. Попробуйте Wi-Fi.");
          } else if (state === "closed") setStatus("Звонок завершён");
        };

        const channel = supabase.channel(`call:${dialogId}`, {
          config: { broadcast: { ack: false, self: false } },
        });
        channelRef.current = channel;

        pc.onicecandidate = (e) => {
          if (e.candidate) {
            channel.send({ type: "broadcast", event: "ice", payload: { from: userId, candidate: e.candidate } });
          }
        };

        channel.on("broadcast", { event: "sdp" }, async ({ payload }) => {
          if (payload.from === userId) return;
          const desc = new RTCSessionDescription(payload.sdp);
          if (desc.type === "offer") {
            await pc.setRemoteDescription(desc);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            channel.send({ type: "broadcast", event: "sdp", payload: { from: userId, sdp: pc.localDescription } });
          } else if (desc.type === "answer") {
            await pc.setRemoteDescription(desc);
          }
        });

        channel.on("broadcast", { event: "ice" }, async ({ payload }) => {
          if (payload.from === userId) return;
          try { await pc.addIceCandidate(payload.candidate); } catch {}
        });

        channel.on("broadcast", { event: "ready" }, async ({ payload }) => {
          if (payload.from === userId || remoteJoinedRef.current) return;
          remoteJoinedRef.current = true;
          if (role === "caller") {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            channel.send({ type: "broadcast", event: "sdp", payload: { from: userId, sdp: pc.localDescription } });
          }
        });

        await new Promise<void>((resolve, reject) => {
          channel.subscribe((status, err) => {
            console.log("Realtime status:", status, err);
            if (status === "SUBSCRIBED") resolve();
            else if (status === "CHANNEL_ERROR") reject(new Error(`Realtime CHANNEL_ERROR: ${err?.message || "проверьте ключ Supabase"}`));
            else if (status === "TIMED_OUT") reject(new Error("Realtime TIMED_OUT — не дождались ответа Supabase"));
            else if (status === "CLOSED") reject(new Error("Realtime CLOSED"));
          });
        });

        channel.send({ type: "broadcast", event: "ready", payload: { from: userId, role } });
        setStatus(role === "caller" ? "Ожидаем собеседника…" : "Готово, ждём соединения…");
      } catch (e: any) {
        console.error(e);
        setError(e?.message || "Ошибка инициализации звонка");
        setStatus("Ошибка");
      }
    };

    init();

    return () => {
      aborted = true;
      try { pcRef.current?.close(); } catch {}
      try { channelRef.current?.unsubscribe(); } catch {}
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialogId, userId]);

  const endCall = () => {
    try { pcRef.current?.close(); } catch {}
    try { channelRef.current?.unsubscribe(); } catch {}
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    try { window.Telegram?.WebApp?.close?.(); } catch {}
  };

  const toggleMute = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getAudioTracks().forEach((t) => (t.enabled = !t.enabled));
    setMuted((m) => !m);
  };

  const toggleVideo = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getVideoTracks().forEach((t) => (t.enabled = !t.enabled));
    setVideoOff((v) => !v);
  };

  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", flexDirection: "column", background: "#000" }}>
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        style={{
          flex: 1,
          width: "100%",
          objectFit: "cover",
          background: callType === "video" ? "#111" : "transparent",
        }}
      />
      {callType === "video" && (
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            width: 110,
            height: 150,
            objectFit: "cover",
            borderRadius: 12,
            border: "2px solid #fff",
            background: "#222",
          }}
        />
      )}
      <div style={{ position: "absolute", top: 12, left: 12, right: callType === "video" ? 140 : 12 }}>
        <div style={{ padding: "8px 14px", background: "rgba(0,0,0,0.45)", borderRadius: 999, display: "inline-block" }}>
          <span style={{ fontSize: 14 }}>{status}</span>
        </div>
        {error && (
          <div style={{ marginTop: 8, padding: "8px 12px", background: "rgba(180,30,30,0.7)", borderRadius: 10, fontSize: 13 }}>
            ⚠️ {error}
          </div>
        )}
      </div>

      <div
        style={{
          padding: "18px 14px calc(18px + env(safe-area-inset-bottom))",
          display: "flex",
          gap: 14,
          justifyContent: "center",
          background: "linear-gradient(180deg, transparent, rgba(0,0,0,0.65))",
        }}
      >
        <CircleBtn onClick={toggleMute} label={muted ? "🔇" : "🎙"} />
        {callType === "video" && <CircleBtn onClick={toggleVideo} label={videoOff ? "📷❌" : "📹"} />}
        <CircleBtn onClick={endCall} label="📞" red />
      </div>
    </div>
  );
}

function CircleBtn({ onClick, label, red }: { onClick: () => void; label: string; red?: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 64,
        height: 64,
        borderRadius: "50%",
        border: "none",
        background: red ? "#d92f3e" : "rgba(255,255,255,0.18)",
        color: "#fff",
        fontSize: 22,
      }}
    >
      {label}
    </button>
  );
}
