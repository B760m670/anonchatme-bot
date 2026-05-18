"use client";

import { useEffect, useRef, useState } from "react";
import { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

type Role = "caller" | "callee";
type CallType = "audio" | "video";

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  // Free public TURN servers — relay used when direct P2P fails (most home/mobile NATs)
  {
    urls: "turn:openrelay.metered.ca:80",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
  {
    urls: "turn:openrelay.metered.ca:443",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
  {
    urls: "turn:openrelay.metered.ca:443?transport=tcp",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
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
  const [debug, setDebug] = useState({ rt: "—", sig: "—", ice: "—", conn: "—" });

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
        setStatus(`Параметры: d=${dialogId}, u=${userId}, r=${role}, t=${callType}`);
        await new Promise((r) => setTimeout(r, 400));

        if (!navigator?.mediaDevices?.getUserMedia) {
          setError("В этом браузере нет API доступа к камере/микрофону. Откройте звонок в обычном браузере (Chrome/Safari).");
          setStatus("getUserMedia недоступен");
          return;
        }

        setStatus(callType === "video" ? "Запрашиваю камеру и микрофон…" : "Запрашиваю микрофон…");

        const constraints: MediaStreamConstraints = {
          audio: true,
          video: callType === "video" ? { facingMode: "user" } : false,
        };

        const mediaPromise = navigator.mediaDevices.getUserMedia(constraints);
        const timeoutPromise = new Promise<MediaStream>((_, reject) =>
          setTimeout(() => reject(new Error("getUserMedia не ответил за 25 секунд — Telegram WebView может блокировать. Попробуй открыть звонок в обычном браузере.")), 25000),
        );
        const stream = await Promise.race([mediaPromise, timeoutPromise]);

        if (aborted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        localStreamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
        setStatus("Доступ получен, подключаюсь к серверу…");

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
          console.log("[pc] connectionState:", state);
          setDebug((d) => ({ ...d, conn: state }));
          if (state === "connected") setStatus("В разговоре");
          else if (state === "connecting") setStatus("Устанавливаем соединение…");
          else if (state === "disconnected") setStatus("Разрыв связи…");
          else if (state === "failed") {
            setStatus("Не удалось установить соединение");
            setError("Возможно, NAT блокирует соединение. Попробуйте Wi-Fi.");
          } else if (state === "closed") setStatus("Звонок завершён");
        };

        pc.oniceconnectionstatechange = () => {
          console.log("[pc] iceConnectionState:", pc.iceConnectionState);
          setDebug((d) => ({ ...d, ice: pc.iceConnectionState }));
          if (pc.iceConnectionState === "checking") setStatus("Пробуем соединиться…");
          else if (pc.iceConnectionState === "failed") {
            setStatus("ICE failed");
            setError("Сеть блокирует звонок (симметричный NAT). Попробуйте другую сеть.");
          }
        };

        pc.onsignalingstatechange = () => {
          console.log("[pc] signalingState:", pc.signalingState);
          setDebug((d) => ({ ...d, sig: pc.signalingState }));
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
            setDebug((d) => ({ ...d, rt: status }));
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

  const isConnected = status === "В разговоре";
  const showAvatar = callType === "audio" || !isConnected;

  return (
    <div
      className={isConnected && callType === "video" ? "tg-bg-video" : "tg-bg"}
      style={{ position: "fixed", inset: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}
    >
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          background: "transparent",
          opacity: isConnected && callType === "video" ? 1 : 0,
          transition: "opacity 0.4s ease",
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
            top: "calc(12px + env(safe-area-inset-top))",
            right: 12,
            width: 100,
            height: 140,
            objectFit: "cover",
            borderRadius: 14,
            border: "2px solid rgba(255,255,255,0.7)",
            background: "#1a1a1a",
            boxShadow: "0 10px 30px rgba(0,0,0,0.45)",
            zIndex: 5,
          }}
        />
      )}

      {showAvatar && (
        <div style={{
          position: "absolute",
          top: 0, left: 0, right: 0,
          paddingTop: "calc(48px + env(safe-area-inset-top))",
          display: "flex", flexDirection: "column", alignItems: "center",
          zIndex: 2,
        }}>
          <div style={{ position: "relative", width: 140, height: 140 }}>
            <div style={{
              position: "absolute", inset: 0, borderRadius: "50%",
              background: "linear-gradient(135deg, #ffffff33, #ffffff10)",
              border: "1px solid rgba(255,255,255,0.18)",
              display: "flex", alignItems: "center", justifyContent: "center",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              fontSize: 64,
            }}>
              👤
            </div>
            {!isConnected && <div className="tg-avatar-pulse" />}
          </div>

          <div style={{ marginTop: 22, fontSize: 24, fontWeight: 600, textShadow: "0 2px 8px rgba(0,0,0,0.4)" }}>
            Анонимный собеседник
          </div>
          <div key={status} className="tg-status" style={{
            marginTop: 8, fontSize: 15, opacity: 0.85,
            textShadow: "0 1px 6px rgba(0,0,0,0.5)",
            padding: "0 32px", textAlign: "center",
          }}>
            {status}
          </div>
        </div>
      )}

      {isConnected && callType === "video" && (
        <div style={{
          position: "absolute",
          top: "calc(14px + env(safe-area-inset-top))",
          left: 14,
          zIndex: 4,
          padding: "8px 14px",
          background: "rgba(0,0,0,0.45)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderRadius: 999,
          fontSize: 14,
        }}>
          🟢 В разговоре
        </div>
      )}

      {error && (
        <div style={{
          position: "absolute",
          left: 14, right: 14,
          bottom: 130,
          padding: "10px 14px",
          background: "rgba(220,40,60,0.85)",
          borderRadius: 12,
          fontSize: 13,
          textAlign: "center",
          zIndex: 6,
        }}>
          ⚠️ {error}
        </div>
      )}

      {process.env.NEXT_PUBLIC_DEBUG !== "off" && (
        <div style={{
          position: "absolute",
          bottom: "calc(120px + env(safe-area-inset-bottom))",
          left: 14,
          padding: "5px 10px",
          background: "rgba(0,0,0,0.4)",
          borderRadius: 6,
          fontSize: 10,
          fontFamily: "ui-monospace, SFMono-Regular, monospace",
          opacity: 0.7,
          zIndex: 3,
        }}>
          rt:{debug.rt} · sig:{debug.sig} · ice:{debug.ice} · conn:{debug.conn}
        </div>
      )}

      <div style={{
        marginTop: "auto",
        padding: "26px 22px calc(28px + env(safe-area-inset-bottom))",
        display: "flex",
        gap: 18,
        justifyContent: "center",
        background: "linear-gradient(180deg, transparent, rgba(0,0,0,0.55))",
        zIndex: 5,
      }}>
        <button
          className={`tg-ctrl ${muted ? "on" : ""}`}
          onClick={toggleMute}
          aria-label={muted ? "Включить микрофон" : "Выключить микрофон"}
        >
          {muted ? "🔇" : "🎙"}
        </button>
        {callType === "video" && (
          <button
            className={`tg-ctrl ${videoOff ? "on" : ""}`}
            onClick={toggleVideo}
            aria-label={videoOff ? "Включить камеру" : "Выключить камеру"}
          >
            {videoOff ? "📷" : "📹"}
          </button>
        )}
        <button
          className="tg-ctrl danger"
          onClick={endCall}
          aria-label="Завершить звонок"
        >
          📞
        </button>
      </div>
    </div>
  );
}
