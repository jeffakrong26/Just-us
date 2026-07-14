import { DurableObject } from "cloudflare:workers";

// The Durable Object is a relay/coordinator only — each client simulates its
// own vehicle locally (hold-to-go physics, checkpoints, hairpin detection)
// and just reports state for the room to broadcast to the other player. This
// keeps the room simple: connection bookkeeping, ready/countdown handshake,
// state relay, and first-to-finish arbitration.
export class RaceRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sockets = new Map(); // "jeff"|"natali" -> WebSocket
    this.ready = new Set();
    this.playerCars = {};
    this.trackId = null;
    this.raceStarted = false;
    this.raceEnded = false;
    this.finishTimes = {};
    this.lightTimer = null;
  }

  broadcast(msg, exceptWho) {
    const data = JSON.stringify(msg);
    for (const [who, ws] of this.sockets) {
      if (who === exceptWho) continue;
      try {
        ws.send(data);
      } catch {
        // socket already gone; the close handler will clean it up
      }
    }
  }

  resetForNewRace() {
    this.ready.clear();
    this.playerCars = {};
    this.trackId = null;
    this.raceStarted = false;
    this.raceEnded = false;
    this.finishTimes = {};
    if (this.lightTimer) {
      clearTimeout(this.lightTimer);
      this.lightTimer = null;
    }
  }

  startLightSequence() {
    this.raceStarted = true;
    const stages = ["red", "yellow", "green"];
    let i = 0;
    const fire = () => {
      this.broadcast({ type: "lights", stage: stages[i] });
      i += 1;
      this.lightTimer = i < stages.length ? setTimeout(fire, 1000) : null;
    };
    fire();
  }

  handleMessage(who, msg) {
    switch (msg.type) {
      case "select_track": {
        this.trackId = msg.trackId;
        this.broadcast({ type: "track_selected", trackId: msg.trackId });
        break;
      }
      case "ready": {
        this.ready.add(who);
        if (msg.car) this.playerCars[who] = msg.car;
        this.broadcast({ type: "player_ready", who, car: msg.car });
        if (this.ready.size === 2 && this.trackId != null && !this.raceStarted) {
          this.startLightSequence();
        }
        break;
      }
      case "unready": {
        this.ready.delete(who);
        this.broadcast({ type: "player_unready", who });
        break;
      }
      case "state": {
        this.broadcast({ type: "opponent_state", who, state: msg.state }, who);
        break;
      }
      case "finish": {
        if (this.raceEnded) break;
        this.finishTimes[who] = msg.finishTimeMs;
        this.raceEnded = true;
        this.broadcast({ type: "race_finished", finishTimes: { ...this.finishTimes }, winner: who });
        break;
      }
      case "rematch": {
        this.resetForNewRace();
        this.broadcast({ type: "rematch" });
        break;
      }
      default:
        break;
    }
  }

  async fetch(request) {
    const url = new URL(request.url);
    const who = url.searchParams.get("who");
    if (who !== "jeff" && who !== "natali") {
      return new Response("who must be jeff or natali", { status: 400 });
    }
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("expected websocket upgrade", { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();

    const existing = this.sockets.get(who);
    if (existing) {
      try {
        existing.close();
      } catch {
        // already closed
      }
    }
    this.sockets.set(who, server);
    this.ready.delete(who); // reconnecting means re-confirm readiness

    server.send(
      JSON.stringify({
        type: "joined",
        you: who,
        players: [...this.sockets.keys()],
        trackId: this.trackId,
        playerCars: this.playerCars,
        readyPlayers: [...this.ready],
      })
    );
    this.broadcast({ type: "player_joined", who }, who);

    server.addEventListener("message", (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }
      this.handleMessage(who, msg);
    });

    server.addEventListener("close", () => {
      if (this.sockets.get(who) !== server) return;
      this.sockets.delete(who);
      this.ready.delete(who);
      this.broadcast({ type: "player_left", who });
      if (this.raceStarted && !this.raceEnded) {
        this.resetForNewRace();
        this.broadcast({ type: "race_aborted" });
      }
    });

    return new Response(null, { status: 101, webSocket: client });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/ws") {
      const id = env.RACE_ROOM.idFromName("jeff-natali");
      const stub = env.RACE_ROOM.get(id);
      return stub.fetch(request);
    }
    return new Response("just-us race room is up", { status: 200 });
  },
};
