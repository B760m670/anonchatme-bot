"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

type Role = "caller" | "callee";
type CallType = "audio" | "video";
type Quality = "good" | "fair" | "poor" | "unknown";
type Facing = "user" | "environment";

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" },
  { urls: "turn:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" },
  { urls: "turn:openrelay.metered.ca:443?transport=tcp", username: "openrelayproject", credential: "openrelayproject" },
];

const REALTIME_TIMEOUT_MS = 30_000;

function useQuery() {
  const [params, setParams] = useState<URLSearchParams | null>(null);
  useEffect(() => {
    setParams(new URLSearchParams(window.location.search));
  }, []);
  return params;
}

function playConnectTone() {
  // Single soft tone played once when partner connects — Telegram-style.
  try {
    const AC: typeof AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(720, ctx.currentTime);
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.22);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  } catch {}
}

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
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
  const [facing, setFacing] = useState<Facing>("user");
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [quality, setQuality] = useState<Quality>("unknown");
  const [isConnected, setIsConnected] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteJoinedRef = useRef(false);
  const startedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (!dialogId || !userId) return;

    try { window.Telegram?.WebApp?.ready?.(); } catch {}
    try { window.Telegram?.WebApp?.expand?.(); } catch {}

    let aborted = false;

    const init = async () => {
      try {
        if (!navigator?.mediaDevices?.getUserMedia) {
          setError("Браузер не поддерживает доступ к камере/микрофону. Откройте звонок в обычном Chrome/Safari.");
          setStatus("getUserMedia недоступен");
          return;
        }

        setStatus(callType === "video" ? "Запрашиваю камеру и микрофон…" : "Запрашиваю микрофон…");

        const constraints: MediaStreamConstraints = {
          audio: true,
          video: callType === "video" ? { facingMode: "user" } : false,
        };

        const mediaPromise = navigator.mediaDevices.getUserMedia(constraints);
        const mediaTimeout = new Promise<MediaStream>((_, reject) =>
          setTimeout(() => reject(new Error("Доступ к микрофону не получен. Откройте в обычном браузере.")), 25_000),
        );
        const stream = await Promise.race([mediaPromise, mediaTimeout]);

        if (aborted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        localStreamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
        setStatus("Подключаюсь к серверу…");

        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        pcRef.current = pc;
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        pc.ontrack = (event) => {
          const [remote] = event.streams;
          if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remote;
        };

        pc.onconnectionstatechange = () => {
          const state = pc.connectionState;
          if (state === "connected") {
            if (!startedAtRef.current) {
              startedAtRef.current = Date.now();
              playConnectTone();
            }
            setIsConnected(true);
            setStatus("Соединение установлено");
            setTimeout(() => setStatus("В разговоре"), 900);
          } else if (state === "connecting") {
            setStatus("Устанавливаем соединение…");
          } else if (state === "disconnected") {
            setStatus("Разрыв связи…");
          } else if (state === "failed") {
            setStatus("Не удалось установить соединение");
            setError("Сеть блокирует звонок. Попробуйте Wi-Fi или мобильную сеть.");
          } else if (state === "closed") {
            setStatus("Звонок завершён");
          }
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

        // tolerate TIMED_OUT during initial connection — Supabase will retry
        await new Promise<void>((resolve, reject) => {
          const giveUp = setTimeout(
            () => reject(new Error("Realtime не отвечает 30 сек — проверь интернет/Supabase Realtime")),
            REALTIME_TIMEOUT_MS,
          );
          channel.subscribe((subStatus, err) => {
            if (subStatus === "SUBSCRIBED") {
              clearTimeout(giveUp);
              resolve();
            } else if (subStatus === "CHANNEL_ERROR") {
              clearTimeout(giveUp);
              reject(new Error(`Realtime CHANNEL_ERROR: ${err?.message || "проверьте ключ Supabase"}`));
            }
            // не валим на TIMED_OUT/CLOSED — Supabase сам переподключится
          });
        });

        channel.send({ type: "broadcast", event: "ready", payload: { from: userId, role } });
        setStatus(role === "caller" ? "Ожидаем собеседника…" : "Подключаемся…");
      } catch (e: any) {
        if (aborted) return;
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

  // Call timer
  useEffect(() => {
    if (!isConnected) return;
    const interval = setInterval(() => {
      if (startedAtRef.current) {
        setDuration(Math.floor((Date.now() - startedAtRef.current) / 1000));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isConnected]);

  // Quality monitor
  useEffect(() => {
    if (!isConnected) return;
    const interval = setInterval(async () => {
      const pc = pcRef.current;
      if (!pc) return;
      try {
        const stats = await pc.getStats();
        let lost = 0;
        let received = 0;
        let rttSum = 0;
        let rttCount = 0;
        stats.forEach((report: any) => {
          if (report.type === "inbound-rtp" && report.kind === "audio") {
            lost += report.packetsLost || 0;
            received += report.packetsReceived || 0;
          }
          if (report.type === "candidate-pair" && report.state === "succeeded" && report.currentRoundTripTime != null) {
            rttSum += report.currentRoundTripTime;
            rttCount++;
          }
        });
        const lossRate = received + lost > 0 ? lost / (received + lost) : 0;
        const rtt = rttCount > 0 ? rttSum / rttCount : 0;
        let q: Quality = "good";
        if (lossRate > 0.08 || rtt > 0.6) q = "poor";
        else if (lossRate > 0.02 || rtt > 0.25) q = "fair";
        setQuality(q);
      } catch {}
    }, 3000);
    return () => clearInterval(interval);
  }, [isConnected]);

  const endCall = useCallback(() => {
    try { pcRef.current?.close(); } catch {}
    try { channelRef.current?.unsubscribe(); } catch {}
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    try { window.Telegram?.WebApp?.close?.(); } catch {}
  }, []);

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getAudioTracks().forEach((t) => (t.enabled = !t.enabled));
    setMuted((m) => !m);
  }, []);

  const toggleVideo = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getVideoTracks().forEach((t) => (t.enabled = !t.enabled));
    setVideoOff((v) => !v);
  }, []);

  const switchCamera = useCallback(async () => {
    if (callType !== "video") return;
    const newFacing: Facing = facing === "user" ? "environment" : "user";
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: newFacing },
      });
      const newTrack = newStream.getVideoTracks()[0];
      const pc = pcRef.current;
      const sender = pc?.getSenders().find((s) => s.track?.kind === "video");
      if (sender) await sender.replaceTrack(newTrack);

      const oldStream = localStreamRef.current;
      if (oldStream) {
        oldStream.getVideoTracks().forEach((t) => { t.stop(); oldStream.removeTrack(t); });
        oldStream.addTrack(newTrack);
        if (localVideoRef.current) localVideoRef.current.srcObject = oldStream;
      }
      setFacing(newFacing);
    } catch (e) {
      console.warn("switchCamera failed", e);
    }
  }, [callType, facing]);

  const qualityColor = quality === "good" ? "#23c45f" : quality === "fair" ? "#e9a83c" : quality === "poor" ? "#e44a4a" : "#888";
  const qualityLabel = quality === "good" ? "Отличная связь" : quality === "fair" ? "Связь нестабильна" : quality === "poor" ? "Плохая связь" : "";

  const showAvatar = callType === "audio" || !isConnected;
  const mirrorLocal = facing === "user" ? "scaleX(-1)" : "none";

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
          position: "absolute", inset: 0, width: "100%", height: "100%",
          objectFit: "cover", background: "transparent",
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
            width: 100, height: 140,
            objectFit: "cover", borderRadius: 14,
            border: "2px solid rgba(255,255,255,0.7)",
            background: "#1a1a1a",
            boxShadow: "0 10px 30px rgba(0,0,0,0.45)",
            transform: mirrorLocal,
            zIndex: 5,
          }}
        />
      )}

      {showAvatar && (
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0,
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
          {isConnected && (
            <div className="tg-status" style={{
              marginTop: 18, fontSize: 28, fontWeight: 300,
              fontFamily: "ui-monospace, SFMono-Regular, monospace",
              opacity: 0.95, letterSpacing: 1,
            }}>
              {formatDuration(duration)}
            </div>
          )}
        </div>
      )}

      {isConnected && callType === "video" && (
        <div style={{
          position: "absolute",
          top: "calc(14px + env(safe-area-inset-top))",
          left: 14,
          zIndex: 4,
          display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start",
        }}>
          <div style={{
            padding: "8px 14px",
            background: "rgba(0,0,0,0.45)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            borderRadius: 999,
            fontSize: 14, display: "flex", alignItems: "center", gap: 8,
          }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: qualityColor, boxShadow: `0 0 8px ${qualityColor}` }} />
            <span style={{ fontFamily: "ui-monospace, SFMono-Regular, monospace" }}>{formatDuration(duration)}</span>
          </div>
          {qualityLabel && (
            <div style={{
              padding: "4px 10px", background: "rgba(0,0,0,0.4)", borderRadius: 999, fontSize: 12,
            }}>
              {qualityLabel}
            </div>
          )}
        </div>
      )}

      {error && (
        <div style={{
          position: "absolute", left: 14, right: 14, bottom: 130,
          padding: "10px 14px", background: "rgba(220,40,60,0.85)",
          borderRadius: 12, fontSize: 13, textAlign: "center", zIndex: 6,
        }}>
          ⚠️ {error}
        </div>
      )}

      <div style={{
        marginTop: "auto",
        padding: "26px 22px calc(28px + env(safe-area-inset-bottom))",
        display: "flex", gap: 18, justifyContent: "center",
        background: "linear-gradient(180deg, transparent, rgba(0,0,0,0.55))",
        zIndex: 5,
      }}>
        <button className={`tg-ctrl ${muted ? "on" : ""}`} onClick={toggleMute} aria-label="mute">
          {muted ? "🔇" : "🎙"}
        </button>
        {callType === "video" && (
          <>
            <button className={`tg-ctrl ${videoOff ? "on" : ""}`} onClick={toggleVideo} aria-label="video">
              {videoOff ? "📷" : "📹"}
            </button>
            <button className="tg-ctrl" onClick={switchCamera} aria-label="switch camera">
              🔄
            </button>
          </>
        )}
        <button className="tg-ctrl danger" onClick={endCall} aria-label="hang up">
          📞
        </button>
      </div>
    </div>
  );
}
