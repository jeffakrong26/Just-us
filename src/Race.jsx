import React, { useState, useEffect, useRef, useCallback } from "react";
import { Trophy, RotateCcw } from "lucide-react";
import { CORAL, GOLD, TEAL, CREAM, SectionCard } from "./theme.jsx";
import { useRaceRoom } from "./useRaceRoom.js";
import { TRACKS, VIEWBOX, roundedPolygonPath, measureCornerFractions, pickRaceCars, CAR_COLOR_POOL } from "./raceTracks.js";

// Canvas 2D fillStyle/strokeStyle cannot resolve CSS custom properties the
// way DOM inline styles and SVG presentation attributes can — CORAL from
// theme.js is `var(--accent, ...)`, which is fine for JSX style props but
// silently fails as a canvas color. Canvas drawing uses this literal instead.
const DEFAULT_CAR_HEX = "#FF6F5E";

const LAPS = 3;
const LAP_SECONDS_AT_TOP_SPEED = 14;
const ACCEL_PER_SEC = 0.8;
const DECEL_PER_SEC = 0.35; // slower than accel on purpose — coasting, not braking
const HAIRPIN_WARN_LEAD = 0.05;
const SPIN_DURATION_MS = 1000;
const SHAKE_DURATION_MS = 500;
const BOOST_DURATION_MS = 2200;
const BOOST_MULTIPLIER = 1.3;
const SOFT_TURN_REHOLD_WINDOW_MS = 700;
const STATE_SEND_INTERVAL_MS = 100;
const OPPONENT_LERP_RATE = 8;

function pointAndAngleAt(pathEl, totalLength, frac) {
  const len = Math.max(0, Math.min(totalLength, frac * totalLength));
  const p = pathEl.getPointAtLength(len);
  const eps = Math.min(2, totalLength * 0.002);
  const p2 = pathEl.getPointAtLength(Math.min(totalLength, len + eps));
  const angle = Math.atan2(p2.y - p.y, p2.x - p.x);
  return { x: p.x, y: p.y, angle };
}

function useTrackGeometry(track) {
  const pathRef = useRef(null);
  const [geometry, setGeometry] = useState(null);

  useEffect(() => {
    if (!track || !pathRef.current) {
      setGeometry(null);
      return;
    }
    const { d } = roundedPolygonPath(track.corners, track.radii);
    pathRef.current.setAttribute("d", d);
    const totalLength = pathRef.current.getTotalLength();
    const { entryFractions, exitFractions } = measureCornerFractions(pathRef.current, track.corners, track.radii);
    // Checkpoints exclude the hairpin's own entry point — otherwise crossing
    // the hairpin at speed "resets" you right back to where you crossed,
    // which defeats the whole point of the time penalty.
    const checkpointFractions = entryFractions.filter((_, idx) => idx !== track.hairpinIndex);
    setGeometry({ d, totalLength, entryFractions, exitFractions, checkpointFractions });
  }, [track]);

  return { pathRef, geometry };
}

function createFreshSim() {
  return {
    progress: 0,
    speed: 0,
    holding: false,
    spinning: false,
    spinUntil: 0,
    boostUntil: 0,
    lastCheckpointFraction: 0,
    softTurnArmed: {},
    finished: false,
  };
}
function createFreshOpponentSim() {
  return { displayedProgress: 0, targetProgress: 0, spinning: false };
}

function TrackThumbnail({ track, onClick, selected }) {
  const { d } = roundedPolygonPath(track.corners, track.radii);
  const hp = track.corners[track.hairpinIndex];
  return (
    <button
      onClick={onClick}
      className="rounded-xl p-2 text-left"
      style={{ background: selected ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.05)", border: selected ? `1px solid ${CORAL}` : "1px solid transparent" }}
    >
      <svg viewBox={`0 0 ${VIEWBOX.w} ${VIEWBOX.h}`} className="w-full h-16">
        <path d={d} fill="none" stroke="rgba(245,239,230,0.4)" strokeWidth="40" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={hp.x} cy={hp.y} r="34" fill="rgba(255,90,70,0.55)" />
      </svg>
      <p className="text-xs mt-1 text-center" style={{ color: CREAM }}>{track.name}</p>
    </button>
  );
}

function CarSwatch({ car, selected, disabled, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={car.name}
      className="w-12 h-12 rounded-full flex items-center justify-center text-lg"
      style={{ background: car.hex, outline: selected ? "2px solid white" : "none", outlineOffset: 2, opacity: disabled && !selected ? 0.4 : 1 }}
    >
      🏎️
    </button>
  );
}

function StartLights({ stage }) {
  const order = ["red", "yellow", "green"];
  const idx = order.indexOf(stage);
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="flex gap-4 rounded-2xl p-4" style={{ background: "rgba(15,27,51,0.7)" }}>
        {order.map((s, i) => (
          <div
            key={s}
            className="w-10 h-10 rounded-full"
            style={{
              background: i <= idx ? { red: "#FF4136", yellow: "#FFC15E", green: "#3ECF6B" }[s] : "rgba(255,255,255,0.15)",
              boxShadow: i === idx ? `0 0 24px ${{ red: "#FF4136", yellow: "#FFC15E", green: "#3ECF6B" }[s]}` : "none",
            }}
          />
        ))}
      </div>
    </div>
  );
}

function ResultsScreen({ me, partner, partnerName, result, onRematch, onExit }) {
  const myTime = result.finishTimes[me];
  const theirTime = result.finishTimes[partner];
  const iWon = result.winner === me;
  return (
    <div className="absolute inset-0 flex items-center justify-center px-4">
      <div className="w-full max-w-xs rounded-2xl p-5 text-center" style={{ background: "#14213D" }}>
        <Trophy className="mx-auto mb-2" size={28} color={GOLD} />
        <p className="font-display text-xl mb-4" style={{ color: CREAM }}>
          {iWon ? "You won! 🏆" : `${partnerName} won`}
        </p>
        <div className="flex justify-between text-sm mb-1" style={{ color: CREAM }}>
          <span>You</span>
          <span className="font-mono">{myTime != null ? `${(myTime / 1000).toFixed(1)}s` : "DNF"}</span>
        </div>
        <div className="flex justify-between text-sm mb-5" style={{ color: CREAM }}>
          <span>{partnerName}</span>
          <span className="font-mono">{theirTime != null ? `${(theirTime / 1000).toFixed(1)}s` : "DNF"}</span>
        </div>
        <button onClick={onRematch} className="w-full rounded-lg py-2.5 text-sm font-semibold mb-2 flex items-center justify-center gap-2" style={{ background: CORAL, color: "#14213D" }}>
          <RotateCcw size={14} /> Rematch
        </button>
        <button onClick={onExit} className="w-full rounded-lg py-2 text-sm" style={{ background: "rgba(255,255,255,0.08)", color: CREAM }}>
          Back to menu
        </button>
      </div>
    </div>
  );
}

export default function RaceGame({ me, partner }) {
  const partnerName = partner === "jeff" ? "Jeff" : "Natali";
  const room = useRaceRoom(me, true);

  const [carOptions] = useState(() => pickRaceCars(5));
  const [myCar, setMyCar] = useState(null);
  const [raceActive, setRaceActive] = useState(false);
  const [dismissedFinished, setDismissedFinished] = useState(false);

  const track = TRACKS.find((t) => t.id === room.trackId) || null;
  const { pathRef, geometry } = useTrackGeometry(track);

  const canvasRef = useRef(null);
  const simRef = useRef(createFreshSim());
  const opponentSimRef = useRef(createFreshOpponentSim());
  const raceStartRef = useRef(0);
  const rafRef = useRef(null);
  const lastFrameRef = useRef(0);
  const lastSendRef = useRef(0);
  const shakeUntilRef = useRef(0);
  const audioCtxRef = useRef(null);

  const amReady = room.readyPlayers.has(me);
  const partnerJoined = room.players.includes(partner);
  const partnerReady = room.readyPlayers.has(partner);
  const opponentCar = CAR_COLOR_POOL.find((c) => c.id === room.playerCars[partner])?.hex || TEAL;

  useEffect(() => {
    if (room.lightStage === "green") {
      simRef.current = createFreshSim();
      opponentSimRef.current = createFreshOpponentSim();
      raceStartRef.current = performance.now();
      setDismissedFinished(false);
      setRaceActive(true);
    }
  }, [room.lightStage]);

  useEffect(() => {
    if (room.raceFinished || room.raceAborted) setRaceActive(false);
  }, [room.raceFinished, room.raceAborted]);

  useEffect(() => {
    if (!room.opponentState) return;
    opponentSimRef.current.targetProgress = room.opponentState.progress ?? opponentSimRef.current.targetProgress;
    opponentSimRef.current.spinning = !!room.opponentState.spinning;
  }, [room.opponentState]);

  const playBoostFeedback = useCallback(() => {
    try {
      if (!audioCtxRef.current) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        audioCtxRef.current = new Ctx();
      }
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.setValueAtTime(320, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.16, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.22);
    } catch {
      // audio isn't critical to the mechanic — ignore failures
    }
    if (navigator.vibrate) navigator.vibrate(60);
  }, []);

  const setHolding = useCallback(
    (next) => {
      const sim = simRef.current;
      if (!sim || sim.holding === next || !track || !geometry) {
        if (sim) sim.holding = next;
        return;
      }
      const now = performance.now();
      const frac = sim.progress - Math.floor(sim.progress);
      if (!next) {
        for (const idx of track.softTurnIndices) {
          const entry = geometry.entryFractions[idx];
          const exit = geometry.exitFractions[idx];
          if (frac >= entry && frac <= exit) sim.softTurnArmed[idx] = now;
        }
      } else {
        for (const idx of track.softTurnIndices) {
          const armedAt = sim.softTurnArmed[idx];
          if (armedAt == null) continue;
          const entry = geometry.entryFractions[idx];
          const exit = geometry.exitFractions[idx];
          if (frac >= entry && frac <= exit && now - armedAt < SOFT_TURN_REHOLD_WINDOW_MS) {
            sim.boostUntil = now + BOOST_DURATION_MS;
            playBoostFeedback();
          }
          sim.softTurnArmed[idx] = null;
        }
      }
      sim.holding = next;
    },
    [track, geometry, playBoostFeedback]
  );

  const triggerShake = (now) => {
    shakeUntilRef.current = now + SHAKE_DURATION_MS;
  };

  const updateSim = useCallback(
    (dt, now) => {
      const sim = simRef.current;
      if (!sim || sim.finished || !track || !geometry) return;
      if (window.__RACE_TEST__ && window.__raceForceFinish) {
        sim.progress = LAPS;
        window.__raceForceFinish = false;
      }

      if (sim.spinning) {
        if (now >= sim.spinUntil) sim.spinning = false;
      } else {
        sim.speed = sim.holding
          ? Math.min(1, sim.speed + ACCEL_PER_SEC * dt)
          : Math.max(0, sim.speed - DECEL_PER_SEC * dt);

        const boostActive = now < sim.boostUntil;
        const distMultiplier = boostActive ? BOOST_MULTIPLIER : 1;
        const prevLap = Math.floor(sim.progress);
        const prevFrac = sim.progress - prevLap;

        sim.progress += ((sim.speed * distMultiplier) / LAP_SECONDS_AT_TOP_SPEED) * dt;

        const newLap = Math.floor(sim.progress);
        const newFrac = sim.progress - newLap;

        if (newLap > prevLap) {
          sim.lastCheckpointFraction = 0;
        }
        for (const ef of geometry.checkpointFractions) {
          if (ef <= newFrac && ef > sim.lastCheckpointFraction) sim.lastCheckpointFraction = ef;
        }

        const hpEntry = geometry.entryFractions[track.hairpinIndex];
        const crossedHairpin = newLap === prevLap && prevFrac < hpEntry && newFrac >= hpEntry;
        if (crossedHairpin && sim.speed > track.maxSafeSpeed) {
          sim.spinning = true;
          sim.spinUntil = now + SPIN_DURATION_MS;
          sim.speed = 0;
          sim.progress = prevLap + sim.lastCheckpointFraction;
          triggerShake(now);
        }

        for (const idx of track.softTurnIndices) {
          const armedAt = sim.softTurnArmed[idx];
          if (armedAt == null) continue;
          const exit = geometry.exitFractions[idx];
          if (newFrac > exit || newLap > prevLap) sim.softTurnArmed[idx] = null;
        }

        if (sim.progress >= LAPS) {
          sim.finished = true;
          room.sendFinish(Math.round(now - raceStartRef.current));
        }
      }

      const osim = opponentSimRef.current;
      const lerpAmt = Math.min(1, dt * OPPONENT_LERP_RATE);
      osim.displayedProgress += (osim.targetProgress - osim.displayedProgress) * lerpAmt;
    },
    [track, geometry, room]
  );

  const render = useCallback(
    (ctx, w, h, now) => {
      ctx.clearRect(0, 0, w, h);
      if (!track || !geometry || !pathRef.current) return;
      ctx.save();

      if (now < shakeUntilRef.current) {
        const remaining = shakeUntilRef.current - now;
        const mag = 8 * (remaining / SHAKE_DURATION_MS);
        ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag);
      }

      const scale = Math.min(w / VIEWBOX.w, h / VIEWBOX.h) * 0.92;
      const offsetX = (w - VIEWBOX.w * scale) / 2;
      const offsetY = (h - VIEWBOX.h * scale) / 2;
      ctx.translate(offsetX, offsetY);
      ctx.scale(scale, scale);

      const hp = track.corners[track.hairpinIndex];
      ctx.fillStyle = "rgba(255,90,70,0.35)";
      ctx.beginPath();
      ctx.arc(hp.x, hp.y, 70, 0, Math.PI * 2);
      ctx.fill();

      const p2d = new Path2D(geometry.d);
      ctx.strokeStyle = "rgba(255,255,255,0.14)";
      ctx.lineWidth = 90;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke(p2d);
      ctx.strokeStyle = "rgba(245,239,230,0.3)";
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 14]);
      ctx.stroke(p2d);
      ctx.setLineDash([]);

      const hpFrac = geometry.entryFractions[track.hairpinIndex];
      for (const lead of [0.04, 0.026, 0.012]) {
        const f = hpFrac - lead;
        if (f < 0) continue;
        const { x, y, angle } = pointAndAngleAt(pathRef.current, geometry.totalLength, f);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.fillStyle = "#FFB020";
        ctx.beginPath();
        ctx.moveTo(-10, -16);
        ctx.lineTo(10, 0);
        ctx.lineTo(-10, 16);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      const sim = simRef.current;
      const myFrac = sim.progress - Math.floor(sim.progress);
      drawVehicle(ctx, pathRef.current, geometry.totalLength, myFrac, myCar?.hex || DEFAULT_CAR_HEX, "🏎️", sim.spinning, now);

      const osim = opponentSimRef.current;
      const oppFrac = osim.displayedProgress - Math.floor(osim.displayedProgress);
      drawVehicle(ctx, pathRef.current, geometry.totalLength, oppFrac, opponentCar, "🏎️", osim.spinning, now);

      ctx.restore();

      drawSpeedLines(ctx, w, h, sim.speed);
      drawHUD(ctx, w, h, sim);
    },
    [track, geometry, myCar, opponentCar]
  );

  useEffect(() => {
    if (!raceActive || !geometry || !track) return;
    let running = true;
    lastFrameRef.current = performance.now();
    const loop = () => {
      if (!running) return;
      const now = performance.now();
      const dt = Math.min(0.05, (now - lastFrameRef.current) / 1000);
      lastFrameRef.current = now;
      updateSim(dt, now);
      if (window.__RACE_TEST__) window.__raceDebug = { ...simRef.current, opponent: { ...opponentSimRef.current } };

      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        if (canvas.width !== Math.round(rect.width) || canvas.height !== Math.round(rect.height)) {
          canvas.width = Math.round(rect.width);
          canvas.height = Math.round(rect.height);
        }
        const ctx = canvas.getContext("2d");
        render(ctx, canvas.width, canvas.height, now);
      }

      if (now - lastSendRef.current > STATE_SEND_INTERVAL_MS) {
        lastSendRef.current = now;
        room.sendState({ progress: simRef.current.progress, spinning: simRef.current.spinning });
      }

      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [raceActive, geometry, track, updateSim, render, room]);

  const handleReadyClick = () => {
    if (amReady) {
      room.setReady(false);
      return;
    }
    if (!myCar || room.trackId == null) return;
    room.setReady(true, myCar.id);
  };

  const inCountdown = room.lightStage != null && room.lightStage !== "green";
  const showOverlay = inCountdown || raceActive || (room.raceFinished != null && !dismissedFinished);

  return (
    <div>
      <svg style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }} aria-hidden="true">
        <path ref={pathRef} />
      </svg>

      {room.status !== "connected" && !showOverlay && (
        <SectionCard>
          <p className="text-sm text-center" style={{ color: CREAM }}>
            {room.status === "connecting" ? "Connecting to the race server…" : "Connection issue — trying again…"}
          </p>
        </SectionCard>
      )}

      {room.status === "connected" && !showOverlay && (
        <div>
          {room.trackId == null ? (
            <SectionCard>
              <p className="text-xs uppercase tracking-wide opacity-50 mb-3" style={{ color: CREAM }}>Pick a track</p>
              <div className="grid grid-cols-2 gap-2">
                {TRACKS.map((t) => (
                  <TrackThumbnail key={t.id} track={t} onClick={() => room.selectTrack(t.id)} selected={false} />
                ))}
              </div>
            </SectionCard>
          ) : (
            <SectionCard>
              <p className="text-xs uppercase tracking-wide opacity-50 mb-3" style={{ color: CREAM }}>Track</p>
              <TrackThumbnail track={track} onClick={() => {}} selected />
            </SectionCard>
          )}

          <SectionCard>
            <p className="text-xs uppercase tracking-wide opacity-50 mb-3" style={{ color: CREAM }}>Pick your car</p>
            <div className="flex gap-3 flex-wrap">
              {carOptions.map((c) => (
                <CarSwatch key={c.id} car={c} selected={myCar?.id === c.id} disabled={amReady} onClick={() => setMyCar(c)} />
              ))}
            </div>
          </SectionCard>

          <SectionCard>
            {!partnerJoined ? (
              <p className="text-sm text-center opacity-70" style={{ color: CREAM }}>Waiting for {partnerName} to join…</p>
            ) : (
              <>
                {amReady && (
                  <p className="text-sm text-center opacity-70 mb-3" style={{ color: CREAM }}>
                    {partnerReady ? "Starting…" : `You're ready — waiting for ${partnerName}…`}
                  </p>
                )}
                <button
                  onClick={handleReadyClick}
                  disabled={!amReady && (!myCar || room.trackId == null)}
                  className="w-full rounded-lg py-2.5 text-sm font-semibold"
                  style={{
                    background: amReady ? "rgba(255,255,255,0.08)" : CORAL,
                    color: amReady ? CREAM : "#14213D",
                    opacity: !amReady && (!myCar || room.trackId == null) ? 0.5 : 1,
                  }}
                >
                  {amReady ? "Change car / unready" : "Ready to race"}
                </button>
              </>
            )}
          </SectionCard>
        </div>
      )}

      {showOverlay && (
        <div className="fixed inset-0 z-40" style={{ background: "#0F1B33" }}>
          <canvas ref={canvasRef} className="w-full h-full block" style={{ touchAction: "none" }} />

          {inCountdown && <StartLights stage={room.lightStage} />}

          {raceActive && (
            <button
              onPointerDown={(e) => { e.preventDefault(); setHolding(true); }}
              onPointerUp={() => setHolding(false)}
              onPointerLeave={() => setHolding(false)}
              onPointerCancel={() => setHolding(false)}
              onContextMenu={(e) => e.preventDefault()}
              className="absolute bottom-8 left-1/2 -translate-x-1/2 w-24 h-24 rounded-full select-none"
              style={{ background: "rgba(255,255,255,0.12)", border: `3px solid ${CORAL}`, touchAction: "none" }}
              aria-label="Hold to accelerate"
            />
          )}

          {room.raceFinished && !dismissedFinished && (
            <ResultsScreen
              me={me}
              partner={partner}
              partnerName={partnerName}
              result={room.raceFinished}
              onRematch={() => { setMyCar(null); room.sendRematch(); }}
              onExit={() => setDismissedFinished(true)}
            />
          )}

          {room.raceAborted && !room.raceFinished && (
            <div className="absolute inset-0 flex items-center justify-center px-6">
              <div className="text-center">
                <p className="text-sm mb-3" style={{ color: CREAM }}>{partnerName} disconnected — race cancelled.</p>
                <button onClick={() => setDismissedFinished(true)} className="rounded-lg px-4 py-2 text-sm" style={{ background: CORAL, color: "#14213D" }}>
                  Back to menu
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function drawVehicle(ctx, pathEl, totalLength, frac, color, emoji, spinning, now) {
  const { x, y, angle } = pointAndAngleAt(pathEl, totalLength, frac);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(spinning ? (now / 80) % (Math.PI * 2) : angle);
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.35;
  ctx.beginPath();
  ctx.arc(0, 0, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.font = "28px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(emoji, 0, 2);
  ctx.restore();
}

function drawSpeedLines(ctx, w, h, speed) {
  if (speed < 0.55) return;
  const intensity = (speed - 0.55) / 0.45;
  const count = Math.round(6 + intensity * 14);
  const cx = w / 2;
  const cy = h / 2;
  ctx.save();
  ctx.strokeStyle = `rgba(255,255,255,${0.05 + intensity * 0.18})`;
  ctx.lineWidth = 2;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const rInner = Math.max(w, h) * 0.35;
    const rOuter = rInner + 40 + intensity * 60;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * rInner, cy + Math.sin(a) * rInner);
    ctx.lineTo(cx + Math.cos(a) * rOuter, cy + Math.sin(a) * rOuter);
    ctx.stroke();
  }
  ctx.restore();
}

function drawHUD(ctx, w, h, sim) {
  const lap = Math.min(LAPS, Math.floor(sim.progress) + 1);
  ctx.save();
  ctx.fillStyle = "rgba(15,27,51,0.6)";
  ctx.fillRect(16, 16, 96, 32);
  ctx.fillStyle = CREAM;
  ctx.font = "600 15px sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(`Lap ${lap}/${LAPS}`, 28, 32);

  const barX = 16;
  const barY = h - 24;
  const barW = 140;
  const barH = 8;
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  ctx.fillRect(barX, barY, barW, barH);
  const boostActive = performance.now() < sim.boostUntil;
  ctx.fillStyle = boostActive ? "#FFC15E" : "#FF6F5E";
  ctx.fillRect(barX, barY, barW * Math.min(1, sim.speed), barH);

  if (boostActive) {
    ctx.fillStyle = "#FFC15E";
    ctx.font = "700 13px sans-serif";
    ctx.fillText("BOOST!", barX, barY - 10);
  }
  if (sim.spinning) {
    ctx.fillStyle = "rgba(255,80,60,0.9)";
    ctx.font = "700 16px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("SPIN OUT", w / 2, h / 2 - 60);
  }
  ctx.restore();
}

