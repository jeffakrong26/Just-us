import { useState, useEffect, useRef, useCallback } from "react";

const RACE_ROOM_URL = "wss://just-us-race-room.jeffakrong26.workers.dev/ws";
const MAX_RECONNECT_DELAY_MS = 10000;

// Thin client for the RaceRoom Durable Object: connection lifecycle (with
// backoff reconnect), and the small message protocol the room speaks. The
// room is a relay/coordinator only — physics live entirely on the client
// (see raceTracks.js + Race.jsx), this hook just gets state in and out.
export function useRaceRoom(me, enabled) {
  const [status, setStatus] = useState("idle"); // idle | connecting | connected | error
  const [players, setPlayers] = useState([]);
  const [trackId, setTrackId] = useState(null);
  const [readyPlayers, setReadyPlayers] = useState(() => new Set());
  const [playerCars, setPlayerCars] = useState({});
  const [lightStage, setLightStage] = useState(null); // null | red | yellow | green
  const [opponentState, setOpponentState] = useState(null);
  const [raceFinished, setRaceFinished] = useState(null); // { finishTimes, winner }
  const [raceAborted, setRaceAborted] = useState(false);

  const wsRef = useRef(null);
  const reconnectDelayRef = useRef(1000);
  const reconnectTimerRef = useRef(null);
  const shouldConnectRef = useRef(false);

  const connect = useCallback(() => {
    if (!me) return;
    setStatus("connecting");
    const ws = new WebSocket(`${RACE_ROOM_URL}?who=${me}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus("connected");
      reconnectDelayRef.current = 1000;
    };

    ws.onmessage = (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }
      switch (msg.type) {
        case "joined":
          setPlayers(msg.players);
          setTrackId(msg.trackId);
          setPlayerCars(msg.playerCars || {});
          setReadyPlayers(new Set(msg.readyPlayers || []));
          break;
        case "player_joined":
          setPlayers((p) => (p.includes(msg.who) ? p : [...p, msg.who]));
          break;
        case "player_left":
          setPlayers((p) => p.filter((w) => w !== msg.who));
          setReadyPlayers((r) => {
            const next = new Set(r);
            next.delete(msg.who);
            return next;
          });
          break;
        case "track_selected":
          setTrackId(msg.trackId);
          break;
        case "player_ready":
          setReadyPlayers((r) => new Set(r).add(msg.who));
          if (msg.car) setPlayerCars((c) => ({ ...c, [msg.who]: msg.car }));
          break;
        case "player_unready":
          setReadyPlayers((r) => {
            const next = new Set(r);
            next.delete(msg.who);
            return next;
          });
          break;
        case "lights":
          setLightStage(msg.stage);
          break;
        case "opponent_state":
          setOpponentState(msg.state);
          break;
        case "race_finished":
          setRaceFinished({ finishTimes: msg.finishTimes, winner: msg.winner });
          break;
        case "race_aborted":
          setRaceAborted(true);
          break;
        case "rematch":
          setLightStage(null);
          setOpponentState(null);
          setRaceFinished(null);
          setRaceAborted(false);
          setReadyPlayers(new Set());
          setPlayerCars({});
          break;
        default:
          break;
      }
    };

    ws.onclose = () => {
      if (wsRef.current !== ws) return; // superseded by a newer connection already
      wsRef.current = null;
      if (!shouldConnectRef.current) return;
      setStatus("error");
      reconnectTimerRef.current = setTimeout(() => {
        reconnectDelayRef.current = Math.min(reconnectDelayRef.current * 2, MAX_RECONNECT_DELAY_MS);
        connect();
      }, reconnectDelayRef.current);
    };
  }, [me]);

  useEffect(() => {
    if (!enabled) return;
    shouldConnectRef.current = true;
    connect();
    return () => {
      shouldConnectRef.current = false;
      clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [enabled, connect]);

  const send = useCallback((msg) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }, []);

  const selectTrack = useCallback((id) => send({ type: "select_track", trackId: id }), [send]);
  const setReady = useCallback(
    (ready, car) => send(ready ? { type: "ready", car } : { type: "unready" }),
    [send]
  );
  const sendState = useCallback((state) => send({ type: "state", state }), [send]);
  const sendFinish = useCallback((finishTimeMs) => send({ type: "finish", finishTimeMs }), [send]);
  const sendRematch = useCallback(() => send({ type: "rematch" }), [send]);

  return {
    status,
    players,
    trackId,
    readyPlayers,
    playerCars,
    lightStage,
    opponentState,
    raceFinished,
    raceAborted,
    selectTrack,
    setReady,
    sendState,
    sendFinish,
    sendRematch,
  };
}
