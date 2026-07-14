import React, { useState, useEffect, useCallback } from "react";
import { Heart, Lock, Car, Cat as CatIcon, Dog as DogIcon, Send, Sparkles, MapPin, Clock, Plus, Check, MessageCircleHeart, Target, Gamepad2, Camera, Shuffle, X, Eraser, Trophy, RotateCcw, Image as ImageIcon, Download } from "lucide-react";

// ---- CONFIG: change this to whatever PIN you two want ----
const PIN_CODE = "0705";

// ---- Cities & timezones ----
const HOUSTON_TZ = "America/Chicago";
const DANANG_TZ = "Asia/Ho_Chi_Minh";
const DISTANCE_MILES = 8788;
const ANNIVERSARY_DATE = "2026-05-07"; // full date, so "days together" can be counted

const AVATARS = ["🏎️", "🧑", "👩", "🌙", "☀️", "🎧", "✈️", "☕"];
const MOOD_TAGS = ["Missing you", "Working", "Chilling", "Traveling", "Sleepy", "Excited"];

// Original set of connection-deepening questions, written in plain English on purpose.
const QUESTION_BANK = [
  "What's a small thing I did recently that made you feel loved?",
  "If we could teleport for one hour right now, what would we do first?",
  "What's a memory of us that you think about when you're having a hard day?",
  "What's something about your day that I probably don't know enough about?",
  "What is one thing you're proud of yourself for this month?",
  "What's a fear you have about us that you rarely say out loud?",
  "If we lived in the same city right now, what would our Sunday look like?",
  "What's a habit of mine you secretly love?",
  "What did your family teach you about love, for better or worse?",
  "What's a place you want us to go together, and why that one?",
  "What's something small I can do this week that would mean a lot to you?",
  "When do you feel most understood by me?",
  "What's a song that reminds you of us right now?",
  "What's a dream for your future that has changed since we met?",
  "What's something you're grateful for today, even a tiny thing?",
  "What does 'home' mean to you right now?",
  "What's a way you show love that you wish I noticed more?",
  "What's the hardest part of the distance for you this week?",
  "What's something you admire about how I handle stress?",
  "If you could freeze one day we've spent together, which one, and why?",
  "What's a tradition you want us to start once we're in the same place?",
  "What's something you learned about yourself since we started long distance?",
  "What's a compliment you've gotten that you never really believed?",
  "What's one thing you want me to ask you more often?",
  "What's a small comfort that gets you through a lonely day?",
  "What's something about Da Nang or Houston you wish the other person could see right now?",
  "What's a promise you want us to make to each other?",
  "What's something you're looking forward to more than you're willing to admit?",
  "What's a way I could support your goals better?",
  "What's a moment recently you wished I was there for, even something small?",
];

const MISSION_BANK = [
  { text: "Send a voice message reading your favorite memory of us out loud.", tag: "sweet" },
  { text: "Take a mirror selfie and send it with one thing you like about yourself today.", tag: "sweet" },
  { text: "Write a 3-line poem about missing me and send it as a photo of your handwriting.", tag: "sweet" },
  { text: "Send a photo of something in your day that made you think of me.", tag: "sweet" },
  { text: "Text me like we just matched and you're trying to impress me.", tag: "flirty" },
  { text: "Send a voice note saying goodnight in the softest, most tender voice you have.", tag: "flirty" },
  { text: "Tell me the first thing you'd do if I walked through your door right now.", tag: "flirty" },
  { text: "Describe, in detail, your favorite outfit I've worn.", tag: "flirty" },
  { text: "Send me a slow, close-up video of you saying my name.", tag: "flirty" },
  { text: "Tell me one thing you want to do to me the next time we're alone together.", tag: "flirty" },
  { text: "Cook or order your favorite comfort food and video call me while you eat it.", tag: "adventurous" },
  { text: "Go outside, find something beautiful, and send it with no caption — let me guess why you picked it.", tag: "adventurous" },
  { text: "Learn one new phrase in my language and send me a video saying it.", tag: "adventurous" },
  { text: "Plan our next date night down to the last detail and send me the full itinerary.", tag: "adventurous" },
  { text: "Recreate our first date as closely as you can wherever you are, and send proof.", tag: "adventurous" },
  { text: "Send a photo of your hands and tell me what you wish they were doing right now.", tag: "flirty" },
  { text: "Give me a compliment you've never said out loud before.", tag: "sweet" },
  { text: "Send a playlist of 3 songs that describe how you feel about me right now.", tag: "sweet" },
  { text: "Tell me your favorite thing about my body, no holding back.", tag: "flirty" },
  { text: "Write down a promise for our future and send a photo of it.", tag: "sweet" },
];

const RACE_CHARACTERS = { jeff: "🏎️", natali: null };
const NATALI_CHARACTER_OPTIONS = ["🚲", "🏍️", "🛵", "⛵️", "🚗"];

function todayKey(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function dayIndex(dateStr) {
  const d = new Date(dateStr + "T00:00:00Z");
  const start = new Date(Date.UTC(d.getUTCFullYear(), 0, 0));
  const diff = (d - start) / 86400000;
  return Math.floor(diff);
}

function useClock(tz) {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000 * 30);
    return () => clearInterval(id);
  }, []);
  const hour = parseInt(
    new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: tz }).format(time),
    10
  );
  const label = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz }).format(time);
  const isDay = hour >= 6 && hour < 19;
  return { label, isDay };
}

// Shared keys (shared === true) are persisted in D1 via the Pages Functions API.
// Personal keys (shared === false) live in localStorage — the browser/device is
// the identity boundary now that there's no Claude account to key off of.
async function safeGet(key, shared) {
  try {
    if (!shared) {
      return localStorage.getItem(key);
    }
    const res = await fetch(`/api/kv/${encodeURIComponent(key)}`);
    const data = await res.json();
    return data.value ?? null;
  } catch {
    return null;
  }
}
async function safeSet(key, value, shared) {
  try {
    const serialized = typeof value === "string" ? value : JSON.stringify(value);
    if (!shared) {
      localStorage.setItem(key, serialized);
      return;
    }
    await fetch(`/api/kv/${encodeURIComponent(key)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: serialized }),
    });
  } catch {
    // ignore
  }
}
// Batch read (one round trip) via the prefix endpoint — used by the hug poller
// since it needs both presence and hold state on every ~1s tick. Returns
// serverNow alongside entries so freshness checks can diff two timestamps
// from the same clock rather than a local device clock against a remote one.
async function safeGetPrefix(prefix) {
  try {
    const res = await fetch(`/api/kv?prefix=${encodeURIComponent(prefix)}`);
    const data = await res.json();
    return { entries: data.entries || [], serverNow: data.serverNow || null };
  } catch {
    return { entries: [], serverNow: null };
  }
}
// D1's datetime('now') returns "YYYY-MM-DD HH:MM:SS" (UTC, no offset marker) —
// needs an explicit "Z" or JS parses it as local time.
function parseServerTime(sqlTimestamp) {
  return new Date(sqlTimestamp.replace(" ", "T") + "Z").getTime();
}

// ---------- Hug button: presence + simultaneous-hold state ----------
const HUG_HOLD_MS = 30000;
const PRESENCE_HEARTBEAT_MS = 15000;
const PRESENCE_ONLINE_WINDOW_MS = 40000;
const HUG_POLL_MS = 1000;

function useHug(me, partner, enabled) {
  const [partnerOnline, setPartnerOnline] = useState(false);
  const [meHolding, setMeHolding] = useState(false);
  const [partnerHolding, setPartnerHolding] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showBurst, setShowBurst] = useState(false);
  const [hugCount, setHugCount] = useState(0);
  const [banner, setBanner] = useState(null);

  const bothStartRef = React.useRef(null);
  const seenPartnerSinceRef = React.useRef(null);
  const completedRef = React.useRef(false);
  const meHoldingRef = React.useRef(false);
  useEffect(() => { meHoldingRef.current = meHolding; }, [meHolding]);

  useEffect(() => {
    if (!enabled) return;
    const beat = () => safeSet(`hug:${me}:presence`, "online", true);
    beat();
    const id = setInterval(beat, PRESENCE_HEARTBEAT_MS);
    return () => clearInterval(id);
  }, [enabled, me]);

  useEffect(() => {
    if (!enabled) return;
    (async () => {
      const raw = await safeGet("hugs-count", true);
      setHugCount(raw ? parseInt(raw, 10) || 0 : 0);
    })();
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const poll = async () => {
      const { entries, serverNow } = await safeGetPrefix(`hug:${partner}:`);
      if (cancelled) return;
      const map = Object.fromEntries(entries.map((e) => [e.key, e]));
      const presEntry = map[`hug:${partner}:presence`];
      const holdRaw = map[`hug:${partner}:hold`]?.value;
      const online = !!(
        presEntry &&
        serverNow &&
        parseServerTime(serverNow) - parseServerTime(presEntry.updatedAt) < PRESENCE_ONLINE_WINDOW_MS
      );
      setPartnerOnline(online);
      const hold = holdRaw ? JSON.parse(holdRaw) : null;
      const holding = !!(hold && hold.holding);
      setPartnerHolding(holding);
      if (holding && hold.since !== seenPartnerSinceRef.current) {
        seenPartnerSinceRef.current = hold.since;
        if (!meHoldingRef.current) setBanner({ id: hold.since });
      }
      if (!holding) seenPartnerSinceRef.current = null;
    };
    poll();
    const id = setInterval(poll, HUG_POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, [enabled, partner]);

  const completeHug = useCallback(async () => {
    setShowBurst(true);
    setTimeout(() => setShowBurst(false), 2600);
    setMeHolding(false);
    await safeSet(`hug:${me}:hold`, { holding: false }, true);
    if (me === "jeff") {
      const raw = await safeGet("hugs-count", true);
      const next = (raw ? parseInt(raw, 10) || 0 : 0) + 1;
      await safeSet("hugs-count", String(next), true);
      setHugCount(next);
      const petRaw = await safeGet("pet-state", true);
      if (petRaw) {
        const pet = JSON.parse(petRaw);
        await safeSet("pet-state", { ...pet, xp: (pet.xp || 0) + 10 }, true);
      }
    } else {
      setTimeout(async () => {
        const raw = await safeGet("hugs-count", true);
        setHugCount(raw ? parseInt(raw, 10) || 0 : 0);
      }, 1500);
    }
  }, [me]);

  useEffect(() => {
    if (!(meHolding && partnerHolding)) {
      bothStartRef.current = null;
      completedRef.current = false;
      setProgress(0);
      return;
    }
    if (!bothStartRef.current) bothStartRef.current = Date.now();
    const id = setInterval(() => {
      const elapsed = Date.now() - bothStartRef.current;
      if (elapsed >= HUG_HOLD_MS) {
        setProgress(100);
        if (!completedRef.current) {
          completedRef.current = true;
          completeHug();
        }
        clearInterval(id);
      } else {
        setProgress((elapsed / HUG_HOLD_MS) * 100);
      }
    }, 100);
    return () => clearInterval(id);
  }, [meHolding, partnerHolding, completeHug]);

  const holdDown = async () => {
    if (!enabled || !partnerOnline) return;
    const since = Date.now();
    setMeHolding(true);
    await safeSet(`hug:${me}:hold`, { holding: true, since }, true);
  };

  const holdUp = async () => {
    setMeHolding((was) => {
      if (was) safeSet(`hug:${me}:hold`, { holding: false }, true);
      return false;
    });
  };

  const dismissBanner = () => setBanner(null);

  return { partnerOnline, meHolding, partnerHolding, progress, showBurst, hugCount, holdDown, holdUp, banner, dismissBanner };
}

export default function App() {
  const [unlocked, setUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState(false);

  const [identity, setIdentity] = useState(null);
  const [loadingIdentity, setLoadingIdentity] = useState(true);

  const [tab, setTab] = useState("status");

  useEffect(() => {
    (async () => {
      const id = await safeGet("identity", false);
      if (id === "jeff" || id === "natali") setIdentity(id);
      setLoadingIdentity(false);
    })();
  }, []);

  const chooseIdentity = async (who) => {
    setIdentity(who);
    await safeSet("identity", who, false);
  };

  const partner = identity === "jeff" ? "natali" : identity === "natali" ? "jeff" : null;
  const hug = useHug(identity, partner, unlocked && !!identity);

  if (!unlocked) {
    return (
      <PinGate
        pinInput={pinInput}
        setPinInput={setPinInput}
        pinError={pinError}
        onSubmit={() => {
          if (pinInput === PIN_CODE) setUnlocked(true);
          else {
            setPinError(true);
            setPinInput("");
          }
        }}
      />
    );
  }

  if (loadingIdentity) {
    return <div style={{ background: BG }} className="min-h-screen flex items-center justify-center text-white">Loading…</div>;
  }

  if (!identity) {
    return <IdentityGate onChoose={chooseIdentity} />;
  }

  return (
    <div style={{ background: BG }} className="min-h-screen text-white font-body">
      <GlobalStyle />
      {hug.banner && (
        <HugBanner
          partnerName={partner === "jeff" ? "Jeff" : "Natali"}
          onOpen={() => { setTab("status"); hug.dismissBanner(); }}
          onDismiss={hug.dismissBanner}
        />
      )}
      <Header />
      <main className="max-w-md mx-auto px-4 pb-28 pt-4">
        {tab === "status" && <StatusTab me={identity} partner={partner} hug={hug} />}
        {tab === "pet" && <PetTab me={identity} partner={partner} />}
        {tab === "question" && <QuestionTab me={identity} partner={partner} />}
        {tab === "missions" && <MissionsTab me={identity} partner={partner} />}
        {tab === "play" && <PlayTab me={identity} partner={partner} />}
      </main>
      <BottomNav tab={tab} setTab={setTab} me={identity} />
      {hug.showBurst && <HugBurst />}
    </div>
  );
}

// ---------- Design tokens ----------
const BG = "linear-gradient(180deg, #0F1B33 0%, #14213D 55%, #1B2A4A 100%)";
const CORAL = "#FF6F5E";
const GOLD = "#FFC15E";
const TEAL = "#35C9C1";
const CREAM = "#F5EFE6";

function GlobalStyle() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,700&family=Manrope:wght@400;600;700&family=Space+Mono:wght@400;700&display=swap');
      .font-display { font-family: 'Fraunces', serif; }
      .font-body { font-family: 'Manrope', sans-serif; }
      .font-mono { font-family: 'Space Mono', monospace; }
      @keyframes pulseDot { 0%,100% { opacity:.3; transform: translateX(0);} 50% { opacity:1; transform: translateX(6px);} }
      @keyframes blink { 0%,90%,100% { transform: scaleY(1);} 95% { transform: scaleY(0.1);} }
      @keyframes breathe { 0%,100% { transform: scale(1);} 50% { transform: scale(1.04);} }
      @keyframes hugPulseRing { 0%,100% { box-shadow: 0 0 0 0 rgba(255,111,94,0.35);} 50% { box-shadow: 0 0 0 14px rgba(255,111,94,0);} }
      @keyframes heartPop { 0% { transform: translate(-50%,-50%) scale(0.3) rotate(var(--rot,0deg)); opacity:0; } 15% { opacity:1; } 100% { transform: translate(calc(-50% + var(--dx,0px)), calc(-50% + var(--dy,0px))) scale(1.15) rotate(var(--rot,0deg)); opacity:0; } }
      .signal-dot { animation: pulseDot 2.2s ease-in-out infinite; }
      .pet-eye { animation: blink 4s infinite; transform-origin: center; }
      .pet-body { animation: breathe 3s ease-in-out infinite; }
      .hug-pulse { animation: hugPulseRing 1.6s ease-in-out infinite; }
    `}</style>
  );
}

function PinGate({ pinInput, setPinInput, pinError, onSubmit }) {
  return (
    <div style={{ background: BG }} className="min-h-screen flex items-center justify-center px-6 font-body">
      <GlobalStyle />
      <div className="w-full max-w-xs text-center">
        <div className="mx-auto mb-5 w-14 h-14 rounded-full flex items-center justify-center" style={{ background: CORAL }}>
          <Lock size={22} color={BG === BG ? "#14213D" : "#fff"} />
        </div>
        <h1 className="font-display text-2xl mb-1" style={{ color: CREAM }}>Just Us</h1>
        <p className="text-sm opacity-60 mb-6" style={{ color: CREAM }}>Enter the code only you two know</p>
        <input
          value={pinInput}
          onChange={(e) => setPinInput(e.target.value.replace(/\D/g, "").slice(0, 4))}
          onKeyDown={(e) => e.key === "Enter" && onSubmit()}
          inputMode="numeric"
          placeholder="••••"
          className="w-full text-center text-2xl tracking-[0.5em] font-mono rounded-xl py-3 mb-3 bg-white/10 outline-none focus:ring-2"
          style={{ color: CREAM, caretColor: CORAL }}
        />
        {pinError && <p className="text-xs mb-3" style={{ color: CORAL }}>Wrong code, try again</p>}
        <button
          onClick={onSubmit}
          className="w-full rounded-xl py-3 font-semibold"
          style={{ background: CORAL, color: "#14213D" }}
        >
          Unlock
        </button>
      </div>
    </div>
  );
}

function IdentityGate({ onChoose }) {
  return (
    <div style={{ background: BG }} className="min-h-screen flex items-center justify-center px-6 font-body">
      <GlobalStyle />
      <div className="w-full max-w-xs text-center">
        <Heart className="mx-auto mb-4" size={28} color={CORAL} fill={CORAL} />
        <h1 className="font-display text-2xl mb-6" style={{ color: CREAM }}>Who's opening this?</h1>
        <div className="space-y-3">
          <button onClick={() => onChoose("jeff")} className="w-full rounded-xl py-4 font-semibold" style={{ background: TEAL, color: "#0F1B33" }}>
            🏎️ I'm Jeff — Houston
          </button>
          <button onClick={() => onChoose("natali")} className="w-full rounded-xl py-4 font-semibold" style={{ background: GOLD, color: "#0F1B33" }}>
            🌸 I'm Natali — Da Nang
          </button>
        </div>
        <p className="text-xs opacity-50 mt-5" style={{ color: CREAM }}>This is remembered on this device only.</p>
      </div>
    </div>
  );
}

function Header() {
  const houston = useClock(HOUSTON_TZ);
  const danang = useClock(DANANG_TZ);
  return (
    <div className="pt-6 pb-4 px-4 max-w-md mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <Heart size={20} color={CORAL} fill={CORAL} />
        <h1 className="font-display text-xl" style={{ color: CREAM }}>Just Us</h1>
      </div>
      <div className="rounded-2xl p-4 bg-white/5 border border-white/10">
        <div className="flex items-center justify-between">
          <CityClock label="Houston" clock={houston} icon="🏎️" />
          <div className="flex-1 flex items-center justify-center relative h-6 mx-2">
            <div className="w-full border-t border-dashed border-white/25" />
            <div className="signal-dot absolute w-2 h-2 rounded-full" style={{ background: CORAL, left: "10%" }} />
          </div>
          <CityClock label="Da Nang" clock={danang} icon="🌸" align="right" />
        </div>
        <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-center gap-2">
          <MapPin size={14} color={TEAL} />
          <span className="font-mono text-lg tracking-tight" style={{ color: TEAL }}>{DISTANCE_MILES.toLocaleString()}</span>
          <span className="text-xs opacity-60" style={{ color: CREAM }}>miles apart</span>
        </div>
      </div>
      <AnniversaryLine />
    </div>
  );
}

function AnniversaryLine() {
  const now = new Date();
  const anniv = new Date(ANNIVERSARY_DATE + "T00:00:00");
  const daysTogether = Math.max(0, Math.floor((now - anniv) / 86400000));
  const monthDay = `${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const annivMonthDay = ANNIVERSARY_DATE.slice(5);
  const isToday = monthDay === annivMonthDay;
  const monthName = anniv.toLocaleString("en-US", { month: "long" });
  const day = anniv.getDate();
  let years = now.getFullYear() - anniv.getFullYear();
  if (monthDay < annivMonthDay) years -= 1;

  if (isToday) {
    return (
      <div className="mt-3 rounded-xl py-2.5 text-center" style={{ background: CORAL }}>
        <span className="text-sm font-semibold" style={{ color: "#14213D" }}>
          💕 {years > 0 ? `Happy ${years}-Year Anniversary` : "Happy Anniversary"} — today's the day
        </span>
      </div>
    );
  }
  return (
    <div className="mt-3 flex items-center justify-center gap-1.5 opacity-60">
      <Heart size={11} color={CREAM} fill={CREAM} />
      <span className="text-[11px]" style={{ color: CREAM }}>
        Together since {monthName} {day} · {daysTogether.toLocaleString()} days and counting
      </span>
    </div>
  );
}

function CityClock({ label, clock, icon, align }) {
  return (
    <div className={align === "right" ? "text-right" : "text-left"}>
      <div className="text-xs opacity-60 flex items-center gap-1" style={{ color: CREAM }}>
        {align !== "right" && <span>{icon}</span>}
        {label}
        {align === "right" && <span>{icon}</span>}
      </div>
      <div className="font-mono text-lg" style={{ color: CREAM }}>{clock.label}</div>
      <div className="text-[10px] opacity-50" style={{ color: clock.isDay ? GOLD : "#8FA3D9" }}>
        {clock.isDay ? "daytime" : "nighttime"}
      </div>
    </div>
  );
}

function SectionCard({ children }) {
  return <div className="rounded-2xl p-4 bg-white/5 border border-white/10 mb-4">{children}</div>;
}

// ---------- Status Tab ----------
function StatusTab({ me, partner, hug }) {
  const [myStatus, setMyStatus] = useState({ emoji: "🏎️", text: "", tag: "", updatedAt: null });
  const [theirStatus, setTheirStatus] = useState(null);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const mine = await safeGet(`status:${me}`, true);
    const theirs = await safeGet(`status:${partner}`, true);
    if (mine) setMyStatus(JSON.parse(mine));
    if (theirs) setTheirStatus(JSON.parse(theirs));
  }, [me, partner]);

  useEffect(() => { load(); }, [load]);

  const save = async (updates) => {
    setSaving(true);
    const next = { ...myStatus, ...updates, updatedAt: new Date().toISOString() };
    setMyStatus(next);
    await safeSet(`status:${me}`, next, true);
    setSaving(false);
  };

  return (
    <div>
      <HugButton me={me} partner={partner} hug={hug} />
      <SectionCard>
        <p className="text-xs uppercase tracking-wide opacity-50 mb-3" style={{ color: CREAM }}>Your status</p>
        <div className="flex gap-2 flex-wrap mb-3">
          {AVATARS.map((a) => (
            <button key={a} onClick={() => save({ emoji: a })}
              className={`w-9 h-9 rounded-full flex items-center justify-center text-lg ${myStatus.emoji === a ? "ring-2" : "bg-white/10"}`}
              style={myStatus.emoji === a ? { background: CORAL, ringColor: CORAL } : {}}>
              {a}
            </button>
          ))}
        </div>
        <div className="flex gap-2 flex-wrap mb-3">
          {MOOD_TAGS.map((t) => (
            <button key={t} onClick={() => save({ tag: t })}
              className="px-3 py-1 rounded-full text-xs"
              style={myStatus.tag === t ? { background: TEAL, color: "#0F1B33" } : { background: "rgba(255,255,255,0.08)", color: CREAM }}>
              {t}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What are you up to?"
            className="flex-1 rounded-lg px-3 py-2 bg-white/10 text-sm outline-none"
            style={{ color: CREAM }}
          />
          <button onClick={() => { save({ text }); setText(""); }} className="px-3 rounded-lg" style={{ background: CORAL }}>
            <Send size={16} color="#14213D" />
          </button>
        </div>
        {myStatus.text && <p className="text-sm mt-3 opacity-80" style={{ color: CREAM }}>"{myStatus.text}"</p>}
      </SectionCard>

      <SectionCard>
        <p className="text-xs uppercase tracking-wide opacity-50 mb-3" style={{ color: CREAM }}>
          {partner === "jeff" ? "Jeff" : "Natali"}'s status
        </p>
        {theirStatus ? (
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl" style={{ background: "rgba(255,255,255,0.1)" }}>
              {theirStatus.emoji}
            </div>
            <div>
              {theirStatus.tag && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: GOLD, color: "#14213D" }}>{theirStatus.tag}</span>}
              <p className="text-sm mt-1" style={{ color: CREAM }}>{theirStatus.text || "No note yet"}</p>
              <p className="text-[10px] opacity-40 mt-1" style={{ color: CREAM }}>
                {theirStatus.updatedAt ? new Date(theirStatus.updatedAt).toLocaleString() : ""}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm opacity-50" style={{ color: CREAM }}>Nothing set yet</p>
        )}
        <button onClick={load} className="text-xs mt-3 opacity-60 underline" style={{ color: CREAM }}>refresh</button>
      </SectionCard>
    </div>
  );
}

function HugButton({ me, partner, hug }) {
  const { partnerOnline, meHolding, partnerHolding, progress, holdDown, holdUp, hugCount } = hug;
  const partnerName = partner === "jeff" ? "Jeff" : "Natali";
  const bothHolding = meHolding && partnerHolding;

  if (!partnerOnline) {
    return (
      <SectionCard>
        <div className="flex flex-col items-center py-3 text-center">
          <div className="w-24 h-24 rounded-full flex items-center justify-center mb-3" style={{ background: "rgba(255,255,255,0.05)" }}>
            <Heart size={28} color="rgba(245,239,230,0.25)" />
          </div>
          <p className="text-xs opacity-50" style={{ color: CREAM }}>Available when you're both online</p>
        </div>
      </SectionCard>
    );
  }

  const ringPct = Math.min(100, progress);
  const circumference = 2 * Math.PI * 54;
  const dashOffset = circumference * (1 - ringPct / 100);

  let label = "Press & hold together";
  if (bothHolding) label = `${Math.max(1, Math.ceil((100 - ringPct) / 100 * 30))}s to go…`;
  else if (meHolding) label = `Waiting for ${partnerName}…`;
  else if (partnerHolding) label = `${partnerName} is waiting — hold to join!`;

  return (
    <SectionCard>
      <p className="text-xs uppercase tracking-wide opacity-50 mb-3 text-center" style={{ color: CREAM }}>Hug button</p>
      <div className="flex flex-col items-center py-2">
        <button
          onPointerDown={(e) => { e.preventDefault(); holdDown(); }}
          onPointerUp={holdUp}
          onPointerLeave={holdUp}
          onPointerCancel={holdUp}
          onContextMenu={(e) => e.preventDefault()}
          className={`relative w-32 h-32 rounded-full flex items-center justify-center select-none ${(meHolding || partnerHolding) && !bothHolding ? "hug-pulse" : ""}`}
          style={{ background: bothHolding ? "rgba(255,111,94,0.18)" : "rgba(255,255,255,0.08)", touchAction: "none" }}
        >
          <svg className="absolute inset-0 -rotate-90" width="128" height="128" viewBox="0 0 128 128">
            <circle cx="64" cy="64" r="54" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
            {bothHolding && (
              <circle
                cx="64" cy="64" r="54" fill="none" stroke={CORAL} strokeWidth="8" strokeLinecap="round"
                strokeDasharray={circumference} strokeDashoffset={dashOffset}
                style={{ transition: "stroke-dashoffset 0.1s linear" }}
              />
            )}
          </svg>
          <Heart size={40} color={CORAL} fill={meHolding || bothHolding ? CORAL : "none"} />
        </button>
        <p className="text-xs mt-3 text-center" style={{ color: CREAM, opacity: 0.7 }}>{label}</p>
        <p className="text-[10px] mt-1 opacity-40" style={{ color: CREAM }}>Hugs: {hugCount}</p>
      </div>
    </SectionCard>
  );
}

function HugBanner({ partnerName, onOpen, onDismiss }) {
  return (
    <div className="fixed top-0 left-0 right-0 z-40 px-4 pt-3">
      <div className="max-w-md mx-auto rounded-xl px-4 py-3 flex items-center justify-between gap-3 shadow-lg" style={{ background: CORAL }}>
        <button onClick={onOpen} className="text-sm font-semibold text-left flex-1" style={{ color: "#14213D" }}>
          {partnerName} wants to hug 🫂 — hold the button on Status
        </button>
        <button onClick={onDismiss} aria-label="Dismiss"><X size={16} color="#14213D" /></button>
      </div>
    </div>
  );
}

function HugBurst() {
  const hearts = React.useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => ({
        id: i,
        dx: (Math.random() - 0.5) * 320,
        dy: (Math.random() - 0.5) * 480,
        rot: Math.random() * 360,
        delay: Math.random() * 0.3,
        size: 16 + Math.random() * 22,
      })),
    []
  );
  return (
    <div className="fixed inset-0 pointer-events-none flex items-center justify-center z-50">
      {hearts.map((h) => (
        <span
          key={h.id}
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            "--dx": `${h.dx}px`,
            "--dy": `${h.dy}px`,
            "--rot": `${h.rot}deg`,
            animation: `heartPop 1.4s ease-out ${h.delay}s forwards`,
            fontSize: h.size,
          }}
        >
          💕
        </span>
      ))}
    </div>
  );
}

// ---------- Pet Tab ----------
function PetTab({ me, partner }) {
  const [petState, setPetState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fedToday, setFedToday] = useState({ jeff: false, natali: false });
  const [adding, setAdding] = useState(false);
  const [newSpecies, setNewSpecies] = useState("cat");
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");

  const load = useCallback(async () => {
    const raw = await safeGet("pet-state", true);
    const myStatusRaw = await safeGet(`status:${me}`, true);
    const theirStatusRaw = await safeGet(`status:${partner}`, true);
    const myQ = await safeGet(`dailyq:${todayKey()}`, true);

    const isToday = (iso) => iso && iso.slice(0, 10) === todayKey();
    const mineStatus = myStatusRaw ? JSON.parse(myStatusRaw) : null;
    const theirsStatus = theirStatusRaw ? JSON.parse(theirStatusRaw) : null;
    const qData = myQ ? JSON.parse(myQ) : null;

    const jeffFed = isToday(mineStatus?.updatedAt && me === "jeff" ? mineStatus.updatedAt : (partner === "jeff" ? theirsStatus?.updatedAt : null)) ||
      isToday(qData?.answers?.jeff?.submittedAt);
    const nataliFed = isToday(mineStatus?.updatedAt && me === "natali" ? mineStatus.updatedAt : (partner === "natali" ? theirsStatus?.updatedAt : null)) ||
      isToday(qData?.answers?.natali?.submittedAt);

    setFedToday({ jeff: jeffFed, natali: nataliFed });

    let state = raw ? JSON.parse(raw) : null;
    if (state && !state.pets && state.species) {
      // migrate old single-pet shape
      state = { pets: [{ id: "legacy", species: state.species, name: state.species === "cat" ? "Cat" : "Dog" }], xp: state.xp || 0, streak: state.streak || 0 };
    }
    setPetState(state);
    setLoading(false);
  }, [me, partner]);

  useEffect(() => { load(); }, [load]);

  const persist = async (next) => {
    setPetState(next);
    await safeSet("pet-state", next, true);
  };

  const addPet = async () => {
    const name = newName.trim() || (newSpecies === "cat" ? "Cat" : "Dog");
    const pet = { id: `${Date.now()}`, species: newSpecies, name };
    const next = petState ? { ...petState, pets: [...petState.pets, pet] } : { pets: [pet], xp: 0, streak: 0 };
    await persist(next);
    setAdding(false);
    setNewName("");
  };

  const saveRename = async (id) => {
    const next = { ...petState, pets: petState.pets.map((p) => (p.id === id ? { ...p, name: editName.trim() || p.name } : p)) };
    await persist(next);
    setEditingId(null);
  };

  if (loading) return <p className="text-sm opacity-60 text-center py-10" style={{ color: CREAM }}>Loading your pets…</p>;

  if (!petState || !petState.pets || petState.pets.length === 0) {
    return (
      <SectionCard>
        <p className="text-sm mb-4 text-center" style={{ color: CREAM }}>Add your first pet — name it, cat or dog.</p>
        <div className="flex gap-2 mb-3 justify-center">
          <button onClick={() => setNewSpecies("cat")} className="flex-1 rounded-lg py-3 flex flex-col items-center gap-1" style={newSpecies === "cat" ? { background: TEAL } : { background: "rgba(255,255,255,0.08)" }}>
            <CatIcon size={22} color={newSpecies === "cat" ? "#0F1B33" : GOLD} /><span className="text-xs" style={{ color: newSpecies === "cat" ? "#0F1B33" : CREAM }}>Cat</span>
          </button>
          <button onClick={() => setNewSpecies("dog")} className="flex-1 rounded-lg py-3 flex flex-col items-center gap-1" style={newSpecies === "dog" ? { background: TEAL } : { background: "rgba(255,255,255,0.08)" }}>
            <DogIcon size={22} color={newSpecies === "dog" ? "#0F1B33" : TEAL} /><span className="text-xs" style={{ color: newSpecies === "dog" ? "#0F1B33" : CREAM }}>Dog</span>
          </button>
        </div>
        <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Name your pet…"
          className="w-full rounded-lg px-3 py-2 bg-white/10 text-sm outline-none mb-3" style={{ color: CREAM }} />
        <button onClick={addPet} className="w-full rounded-lg py-2.5 text-sm font-semibold" style={{ background: CORAL, color: "#14213D" }}>Add pet</button>
      </SectionCard>
    );
  }

  const bothFedToday = fedToday.jeff && fedToday.natali;
  const mood = bothFedToday ? "happy" : petState.streak > 0 ? "waiting" : "hungry";
  const moodLabel = { happy: "content & full", waiting: "getting hungry", hungry: "needs you both" }[mood];

  return (
    <div>
      <SectionCard>
        <div className={`grid ${petState.pets.length > 1 ? "grid-cols-2" : "grid-cols-1"} gap-3 py-2`}>
          {petState.pets.map((pet) => (
            <div key={pet.id} className="flex flex-col items-center">
              <PetSprite species={pet.species} mood={mood} />
              {editingId === pet.id ? (
                <div className="flex items-center gap-1 mt-2">
                  <input value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus
                    className="w-20 rounded px-1 py-0.5 bg-white/10 text-xs text-center outline-none" style={{ color: CREAM }} />
                  <button onClick={() => saveRename(pet.id)}><Check size={12} color={TEAL} /></button>
                </div>
              ) : (
                <button onClick={() => { setEditingId(pet.id); setEditName(pet.name); }} className="font-display text-base mt-2" style={{ color: CREAM }}>
                  {pet.name}
                </button>
              )}
            </div>
          ))}
        </div>
        <p className="text-xs opacity-60 text-center mt-1" style={{ color: CREAM }}>{moodLabel} · tap a name to rename</p>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <Stat label="streak" value={`${petState.streak || 0} days`} />
          <Stat label="xp" value={petState.xp || 0} />
        </div>
        {!adding ? (
          <button onClick={() => setAdding(true)} className="w-full mt-3 rounded-lg py-2 text-xs flex items-center justify-center gap-1" style={{ background: "rgba(255,255,255,0.08)", color: CREAM }}>
            <Plus size={12} /> Add another pet
          </button>
        ) : (
          <div className="mt-3 pt-3 border-t border-white/10">
            <div className="flex gap-2 mb-2">
              <button onClick={() => setNewSpecies("cat")} className="flex-1 rounded-lg py-2 text-xs" style={newSpecies === "cat" ? { background: TEAL, color: "#0F1B33" } : { background: "rgba(255,255,255,0.08)", color: CREAM }}>Cat</button>
              <button onClick={() => setNewSpecies("dog")} className="flex-1 rounded-lg py-2 text-xs" style={newSpecies === "dog" ? { background: TEAL, color: "#0F1B33" } : { background: "rgba(255,255,255,0.08)", color: CREAM }}>Dog</button>
            </div>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Name…"
              className="w-full rounded-lg px-3 py-2 bg-white/10 text-sm outline-none mb-2" style={{ color: CREAM }} />
            <div className="flex gap-2">
              <button onClick={addPet} className="flex-1 rounded-lg py-2 text-sm font-semibold" style={{ background: CORAL, color: "#14213D" }}>Add</button>
              <button onClick={() => setAdding(false)} className="flex-1 rounded-lg py-2 text-sm" style={{ background: "rgba(255,255,255,0.08)", color: CREAM }}>Cancel</button>
            </div>
          </div>
        )}
      </SectionCard>
      <SectionCard>
        <p className="text-xs uppercase tracking-wide opacity-50 mb-3" style={{ color: CREAM }}>Today's feeding</p>
        <FeedRow name="Jeff" done={fedToday.jeff} />
        <FeedRow name="Natali" done={fedToday.natali} />
        <p className="text-xs opacity-50 mt-3" style={{ color: CREAM }}>
          Update your status or answer today's question to feed your pets. They need both of you.
        </p>
        <button onClick={load} className="text-xs mt-3 opacity-60 underline" style={{ color: CREAM }}>refresh</button>
      </SectionCard>
    </div>
  );
}

function FeedRow({ name, done }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm" style={{ color: CREAM }}>{name}</span>
      <span className={`w-6 h-6 rounded-full flex items-center justify-center ${done ? "" : "opacity-30"}`} style={{ background: done ? TEAL : "rgba(255,255,255,0.1)" }}>
        {done && <Check size={14} color="#0F1B33" />}
      </span>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-lg py-2 text-center bg-white/5">
      <div className="font-mono text-lg" style={{ color: GOLD }}>{value}</div>
      <div className="text-[10px] opacity-50 uppercase" style={{ color: CREAM }}>{label}</div>
    </div>
  );
}

function PetSprite({ species, mood }) {
  const bodyColor = species === "cat" ? "#FFC15E" : "#D9A066";
  return (
    <div className="pet-body relative" style={{ width: 76, height: 76 }}>
      <div className="absolute rounded-full" style={{ width: 58, height: 58, background: bodyColor, left: 9, top: 12 }} />
      {species === "cat" ? (
        <>
          <div className="absolute" style={{ width: 0, height: 0, left: 10, top: 3, borderLeft: "8px solid transparent", borderRight: "8px solid transparent", borderBottom: `15px solid ${bodyColor}` }} />
          <div className="absolute" style={{ width: 0, height: 0, right: 10, top: 3, borderLeft: "8px solid transparent", borderRight: "8px solid transparent", borderBottom: `15px solid ${bodyColor}` }} />
        </>
      ) : (
        <>
          <div className="absolute rounded-full" style={{ width: 13, height: 20, background: bodyColor, left: 5, top: 15, transform: "rotate(-15deg)" }} />
          <div className="absolute rounded-full" style={{ width: 13, height: 20, background: bodyColor, right: 5, top: 15, transform: "rotate(15deg)" }} />
        </>
      )}
      <div className="pet-eye absolute rounded-full bg-[#14213D]" style={{ width: 5, height: 5, left: 27, top: 37 }} />
      <div className="pet-eye absolute rounded-full bg-[#14213D]" style={{ width: 5, height: 5, right: 27, top: 37 }} />
      <div className="absolute rounded-full" style={{ width: 7, height: 5, background: "#14213D", left: 34, top: 46, opacity: 0.6 }} />
      {mood === "hungry" && <div className="absolute text-xs" style={{ top: -6, right: 0 }}>💭</div>}
      {mood === "happy" && <div className="absolute text-xs" style={{ top: -6, right: 0 }}>✨</div>}
    </div>
  );
}

// ---------- Daily Question Tab ----------
function QuestionTab({ me, partner }) {
  const [data, setData] = useState(null);
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(true);
  const [customMode, setCustomMode] = useState(false);
  const [customText, setCustomText] = useState("");

  const key = `dailyq:${todayKey()}`;

  const load = useCallback(async () => {
    const raw = await safeGet(key, true);
    const customRaw = await safeGet(`dailyq:custom:${todayKey()}`, true);
    let d = raw ? JSON.parse(raw) : null;
    if (!d) {
      const custom = customRaw ? JSON.parse(customRaw) : null;
      const question = custom ? custom.text : QUESTION_BANK[dayIndex(todayKey()) % QUESTION_BANK.length];
      d = { question, isCustom: !!custom, author: custom ? custom.author : null, answers: {} };
      await safeSet(key, d, true);
    }
    setData(d);
    setLoading(false);
  }, [key]);

  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    if (!answer.trim() || !data) return;
    const next = {
      ...data,
      answers: { ...data.answers, [me]: { text: answer.trim(), submittedAt: new Date().toISOString() } },
    };
    setData(next);
    await safeSet(key, next, true);
    setAnswer("");
  };

  const submitCustom = async () => {
    if (!customText.trim()) return;
    await safeSet(`dailyq:custom:${todayKey(1)}`, { text: customText.trim(), author: me }, true);
    setCustomText("");
    setCustomMode(false);
  };

  if (loading || !data) return <p className="text-sm opacity-60 text-center py-10" style={{ color: CREAM }}>Loading today's question…</p>;

  const myAnswer = data.answers?.[me];
  const theirAnswer = data.answers?.[partner];
  const bothAnswered = myAnswer && theirAnswer;

  return (
    <div>
      <SectionCard>
        <div className="flex items-center gap-2 mb-2">
          <MessageCircleHeart size={16} color={CORAL} />
          <p className="text-xs uppercase tracking-wide opacity-50" style={{ color: CREAM }}>
            {data.isCustom ? `${data.author === "jeff" ? "Jeff's" : "Natali's"} question for today` : "Today's question"}
          </p>
        </div>
        <p className="font-display text-lg mb-4" style={{ color: CREAM }}>{data.question}</p>

        {!myAnswer ? (
          <div>
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              rows={3}
              placeholder="Type your honest answer…"
              className="w-full rounded-lg px-3 py-2 bg-white/10 text-sm outline-none resize-none"
              style={{ color: CREAM }}
            />
            <button onClick={submit} className="w-full mt-2 rounded-lg py-2 text-sm font-semibold" style={{ background: CORAL, color: "#14213D" }}>
              Submit answer
            </button>
          </div>
        ) : bothAnswered ? (
          <div className="space-y-3">
            <RevealCard who="You" text={myAnswer.text} color={TEAL} />
            <RevealCard who={partner === "jeff" ? "Jeff" : "Natali"} text={theirAnswer.text} color={GOLD} />
          </div>
        ) : (
          <div className="rounded-lg p-3 bg-white/5 text-center">
            <p className="text-sm" style={{ color: CREAM }}>Your answer is locked in ✅</p>
            <p className="text-xs opacity-50 mt-1" style={{ color: CREAM }}>
              Waiting on {partner === "jeff" ? "Jeff" : "Natali"} — answers reveal once you both submit.
            </p>
            <button onClick={load} className="text-xs mt-2 opacity-60 underline" style={{ color: CREAM }}>check again</button>
          </div>
        )}
      </SectionCard>

      <SectionCard>
        {!customMode ? (
          <button onClick={() => setCustomMode(true)} className="w-full flex items-center justify-center gap-2 text-sm py-2 opacity-70" style={{ color: CREAM }}>
            <Plus size={14} /> Write tomorrow's question instead
          </button>
        ) : (
          <div>
            <p className="text-xs uppercase tracking-wide opacity-50 mb-2" style={{ color: CREAM }}>Write tomorrow's question</p>
            <textarea
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              rows={2}
              placeholder="Ask something you're curious about…"
              className="w-full rounded-lg px-3 py-2 bg-white/10 text-sm outline-none resize-none"
              style={{ color: CREAM }}
            />
            <div className="flex gap-2 mt-2">
              <button onClick={submitCustom} className="flex-1 rounded-lg py-2 text-sm font-semibold" style={{ background: TEAL, color: "#0F1B33" }}>Save</button>
              <button onClick={() => setCustomMode(false)} className="flex-1 rounded-lg py-2 text-sm" style={{ background: "rgba(255,255,255,0.08)", color: CREAM }}>Cancel</button>
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function RevealCard({ who, text, color }) {
  return (
    <div className="rounded-lg p-3" style={{ background: "rgba(255,255,255,0.06)", borderLeft: `3px solid ${color}` }}>
      <p className="text-xs opacity-60 mb-1" style={{ color: CREAM }}>{who}</p>
      <p className="text-sm" style={{ color: CREAM }}>{text}</p>
    </div>
  );
}

// ---------- Missions Tab ----------
function MissionsTab({ me, partner }) {
  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [picking, setPicking] = useState(false);
  const [customText, setCustomText] = useState("");
  const [noteDrafts, setNoteDrafts] = useState({});

  const load = useCallback(async () => {
    const raw = await safeGet("missions", true);
    let list = raw ? JSON.parse(raw) : [];
    // Mark my sent-and-completed missions as seen now that I've opened this tab
    const hasUnseen = list.some((m) => m.assignedBy === me && m.status === "done" && !m.seenByAssigner);
    if (hasUnseen) {
      list = list.map((m) => (m.assignedBy === me && m.status === "done" && !m.seenByAssigner ? { ...m, seenByAssigner: true } : m));
      await safeSet("missions", list, true);
    }
    setMissions(list);
    setLoading(false);
  }, [me]);

  useEffect(() => { load(); }, [load]);

  const persist = async (next) => {
    setMissions(next);
    await safeSet("missions", next, true);
  };

  const send = async (text) => {
    const next = [
      { id: `${Date.now()}`, text, assignedBy: me, assignedTo: partner, status: "pending", note: "", seenByAssigner: true, createdAt: new Date().toISOString() },
      ...missions,
    ];
    await persist(next);
    setPicking(false);
    setCustomText("");
  };

  const complete = async (id) => {
    const note = noteDrafts[id] || "";
    const next = missions.map((m) => (m.id === id ? { ...m, status: "done", note, seenByAssigner: false, completedAt: new Date().toISOString() } : m));
    await persist(next);
  };

  if (loading) return <p className="text-sm opacity-60 text-center py-10" style={{ color: CREAM }}>Loading missions…</p>;

  const forMe = missions.filter((m) => m.assignedTo === me && m.status === "pending");
  const sentByMe = missions.filter((m) => m.assignedBy === me);
  const doneForPartner = missions.filter((m) => m.assignedTo === me && m.status === "done").slice(0, 5);

  return (
    <div>
      <SectionCard>
        <div className="rounded-lg p-3 mb-4 bg-white/5">
          <p className="text-xs opacity-70" style={{ color: CREAM }}>
            💡 There's no push notification for this — the only way you'll know a mission was sent or finished is by opening the app. Sending a quick text ("check the app 👀") works well until it becomes a habit.
          </p>
        </div>
        <div className="flex items-center gap-2 mb-3">
          <Target size={16} color={CORAL} />
          <p className="text-xs uppercase tracking-wide opacity-50" style={{ color: CREAM }}>Send a secret mission</p>
        </div>
        {!picking ? (
          <div className="flex gap-2">
            <button
              onClick={() => send(MISSION_BANK[Math.floor(Math.random() * MISSION_BANK.length)].text)}
              className="flex-1 rounded-lg py-2.5 text-sm font-semibold flex items-center justify-center gap-2"
              style={{ background: CORAL, color: "#14213D" }}
            >
              <Shuffle size={14} /> Surprise them
            </button>
            <button onClick={() => setPicking(true)} className="flex-1 rounded-lg py-2.5 text-sm" style={{ background: "rgba(255,255,255,0.08)", color: CREAM }}>
              Write my own
            </button>
          </div>
        ) : (
          <div>
            <textarea
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              rows={2}
              placeholder="Dare them to do something…"
              className="w-full rounded-lg px-3 py-2 bg-white/10 text-sm outline-none resize-none"
              style={{ color: CREAM }}
            />
            <div className="flex gap-2 mt-2">
              <button onClick={() => send(customText.trim())} disabled={!customText.trim()} className="flex-1 rounded-lg py-2 text-sm font-semibold" style={{ background: TEAL, color: "#0F1B33" }}>Send</button>
              <button onClick={() => setPicking(false)} className="flex-1 rounded-lg py-2 text-sm" style={{ background: "rgba(255,255,255,0.08)", color: CREAM }}>Cancel</button>
            </div>
          </div>
        )}
      </SectionCard>

      <SectionCard>
        <p className="text-xs uppercase tracking-wide opacity-50 mb-3" style={{ color: CREAM }}>Missions for you ({forMe.length})</p>
        {forMe.length === 0 && <p className="text-sm opacity-50" style={{ color: CREAM }}>None right now — enjoy the peace.</p>}
        <div className="space-y-3">
          {forMe.map((m) => (
            <div key={m.id} className="rounded-lg p-3 bg-white/5">
              <p className="text-sm mb-2" style={{ color: CREAM }}>{m.text}</p>
              <input
                value={noteDrafts[m.id] || ""}
                onChange={(e) => setNoteDrafts({ ...noteDrafts, [m.id]: e.target.value })}
                placeholder="Optional note when you complete it…"
                className="w-full rounded-md px-2 py-1.5 bg-white/10 text-xs outline-none mb-2"
                style={{ color: CREAM }}
              />
              <button onClick={() => complete(m.id)} className="text-xs px-3 py-1.5 rounded-md font-semibold flex items-center gap-1" style={{ background: TEAL, color: "#0F1B33" }}>
                <Check size={12} /> Mark complete — this notifies {partner === "jeff" ? "Jeff" : "Natali"} inside the app
              </button>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard>
        <p className="text-xs uppercase tracking-wide opacity-50 mb-3" style={{ color: CREAM }}>Missions you sent</p>
        {sentByMe.length === 0 && <p className="text-sm opacity-50" style={{ color: CREAM }}>You haven't sent any yet.</p>}
        <div className="space-y-2">
          {sentByMe.slice(0, 6).map((m) => (
            <div key={m.id} className="flex items-start justify-between gap-2 text-sm">
              <span className="opacity-80" style={{ color: CREAM }}>{m.text}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full shrink-0" style={{ background: m.status === "done" ? TEAL : "rgba(255,255,255,0.1)", color: m.status === "done" ? "#0F1B33" : CREAM }}>
                {m.status === "done" ? "done" : "pending"}
              </span>
            </div>
          ))}
        </div>
      </SectionCard>

      {doneForPartner.length > 0 && (
        <SectionCard>
          <p className="text-xs uppercase tracking-wide opacity-50 mb-3" style={{ color: CREAM }}>Your recent completions</p>
          <div className="space-y-2">
            {doneForPartner.map((m) => (
              <div key={m.id} className="text-sm">
                <p className="opacity-80" style={{ color: CREAM }}>{m.text}</p>
                {m.note && <p className="text-xs mt-1 opacity-50 italic" style={{ color: CREAM }}>"{m.note}"</p>}
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}

// ---------- Play Tab ----------
function PlayTab({ me, partner }) {
  const [sub, setSub] = useState("race");
  const subs = [
    { id: "race", label: "Race" },
    { id: "guess", label: "Guess" },
    { id: "snaps", label: "Snaps" },
  ];
  return (
    <div>
      <div className="flex gap-2 mb-4">
        {subs.map((s) => (
          <button key={s.id} onClick={() => setSub(s.id)} className="flex-1 rounded-lg py-2 text-sm font-semibold"
            style={sub === s.id ? { background: CORAL, color: "#14213D" } : { background: "rgba(255,255,255,0.08)", color: CREAM }}>
            {s.label}
          </button>
        ))}
      </div>
      {sub === "race" && <RaceGame me={me} partner={partner} />}
      {sub === "guess" && <GuessGame me={me} partner={partner} />}
      {sub === "snaps" && <SnapsTab me={me} partner={partner} />}
    </div>
  );
}

// ---------- Race Game (F1 oval, two cars, first to finish wins) ----------
const TRACK_D = "M 30 130 C 30 60, 60 30, 150 30 C 240 30, 270 60, 270 130 C 270 155, 220 150, 150 150 C 80 150, 30 155, 30 130 Z";

function RaceGame({ me, partner }) {
  const [character, setCharacter] = useState(RACE_CHARACTERS[me] || null);
  const [status, setStatus] = useState("idle"); // idle | racing | done
  const [myProgress, setMyProgress] = useState(0);
  const [partnerProgress, setPartnerProgress] = useState(0);
  const [result, setResult] = useState(null); // {winner, myTime, partnerTime}
  const startTimeRef = React.useRef(null);
  const pollRef = React.useRef(null);
  const pathRef = React.useRef(null);
  const partnerCharRef = React.useRef(partner === "jeff" ? "🏎️" : "🚲");

  useEffect(() => {
    (async () => {
      if (me === "natali") {
        const saved = await safeGet("race-character", false);
        if (saved) setCharacter(saved);
      }
      const pRaw = await safeGet(`race-character-of:${partner}`, true);
      if (pRaw) partnerCharRef.current = pRaw;
    })();
    return () => clearInterval(pollRef.current);
  }, [me, partner]);

  const pickCharacter = async (c) => {
    setCharacter(c);
    await safeSet("race-character", c, false);
    await safeSet(`race-character-of:${me}`, c, true);
  };

  const pointAt = (fraction) => {
    const path = pathRef.current;
    if (!path) return { x: 150, y: 90 };
    const len = path.getTotalLength();
    return path.getPointAtLength(fraction * len);
  };

  const pollPartner = () => {
    pollRef.current = setInterval(async () => {
      const raw = await safeGet(`race-progress:${partner}`, true);
      if (raw) setPartnerProgress(JSON.parse(raw).progress);
    }, 600);
  };

  const startRace = async () => {
    startTimeRef.current = Date.now();
    setMyProgress(0);
    setPartnerProgress(0);
    setResult(null);
    setStatus("racing");
    await safeSet(`race-progress:${me}`, { progress: 0 }, true);
    await safeSet(`race-result:${me}`, null, true);
    await safeSet(`race-result:${partner}`, null, true);
    clearInterval(pollRef.current);
    pollPartner();
  };

  const tap = async () => {
    if (status !== "racing") return;
    const next = Math.min(100, myProgress + 5);
    setMyProgress(next);
    await safeSet(`race-progress:${me}`, { progress: next }, true);
    if (next >= 100) {
      const finishTime = Date.now() - startTimeRef.current;
      setStatus("done");
      await safeSet(`race-result:${me}`, { finishTime }, true);
      const partnerRaw = await safeGet(`race-result:${partner}`, true);
      const partnerRes = partnerRaw ? JSON.parse(partnerRaw) : null;
      if (partnerRes) {
        clearInterval(pollRef.current);
        setResult({ myTime: finishTime, partnerTime: partnerRes.finishTime, winner: finishTime <= partnerRes.finishTime ? me : partner });
      } else {
        setResult({ myTime: finishTime, partnerTime: null, winner: null });
        clearInterval(pollRef.current);
        pollRef.current = setInterval(async () => {
          const raw = await safeGet(`race-result:${partner}`, true);
          if (raw) {
            const pr = JSON.parse(raw);
            if (pr) {
              setResult({ myTime: finishTime, partnerTime: pr.finishTime, winner: finishTime <= pr.finishTime ? me : partner });
              clearInterval(pollRef.current);
            }
          }
        }, 1200);
      }
    }
  };

  if (me === "natali" && !character) {
    return (
      <SectionCard>
        <p className="text-sm mb-4 text-center" style={{ color: CREAM }}>Pick your racer</p>
        <div className="flex gap-2 flex-wrap justify-center">
          {NATALI_CHARACTER_OPTIONS.map((c) => (
            <button key={c} onClick={() => pickCharacter(c)} className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl bg-white/8">
              {c}
            </button>
          ))}
        </div>
      </SectionCard>
    );
  }

  const myPos = pointAt(myProgress / 100);
  const partnerPos = pointAt(partnerProgress / 100);

  return (
    <SectionCard>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs uppercase tracking-wide opacity-50" style={{ color: CREAM }}>F1 Sprint</p>
        {result?.winner && (
          <span className="text-xs font-semibold" style={{ color: GOLD }}>
            {result.winner === me ? "You won 🏆" : `${partner === "jeff" ? "Jeff" : "Natali"} won`}
          </span>
        )}
      </div>
      <svg viewBox="0 0 300 170" className="w-full mb-3">
        <path ref={pathRef} d={TRACK_D} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="20" strokeLinecap="round" />
        <path d={TRACK_D} fill="none" stroke="rgba(245,239,230,0.35)" strokeWidth="1.5" strokeDasharray="3 6" />
        <rect x="24" y="122" width="8" height="16" fill={CREAM} opacity="0.6" />
        <text x={partnerPos.x} y={partnerPos.y + 5} fontSize="15" textAnchor="middle" opacity="0.75">{partnerCharRef.current}</text>
        <text x={myPos.x} y={myPos.y + 5} fontSize="17" textAnchor="middle">{character}</text>
      </svg>
      <div className="flex justify-between text-[10px] mb-3 opacity-50" style={{ color: CREAM }}>
        <span>You {Math.round(myProgress)}%</span>
        <span>{partner === "jeff" ? "Jeff" : "Natali"} {Math.round(partnerProgress)}%</span>
      </div>
      {status !== "racing" ? (
        <button onClick={startRace} className="w-full rounded-lg py-2.5 text-sm font-semibold" style={{ background: CORAL, color: "#14213D" }}>
          {status === "done" ? "Race again" : "Start race"}
        </button>
      ) : (
        <button onClick={tap} className="w-full rounded-lg py-3 text-sm font-bold" style={{ background: TEAL, color: "#0F1B33" }}>
          TAP TO DRIVE
        </button>
      )}
      {status === "done" && (
        <p className="text-xs text-center mt-3 opacity-50" style={{ color: CREAM }}>
          {result?.partnerTime == null ? `Waiting on ${partner === "jeff" ? "Jeff" : "Natali"} to finish…` : `Your time: ${(result.myTime / 1000).toFixed(1)}s · Theirs: ${(result.partnerTime / 1000).toFixed(1)}s`}
        </p>
      )}
    </SectionCard>
  );
}

// ---------- Guess the Number: 4-digit code, alternating turns, correct digits lock green ----------
function GuessGame({ me, partner }) {
  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(true);
  const [digits, setDigits] = useState(["", "", "", ""]);
  const inputRefs = [React.useRef(), React.useRef(), React.useRef(), React.useRef()];

  const load = useCallback(async () => {
    const raw = await safeGet("mastermind", true);
    setGame(raw ? JSON.parse(raw) : null);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!game || game.winner) return;
    const id = setInterval(load, 2000);
    return () => clearInterval(id);
  }, [game, load]);

  const startNew = async () => {
    const secret = Array.from({ length: 4 }, () => Math.floor(Math.random() * 10));
    const next = { secret, turn: me, revealed: [null, null, null, null], guesses: [], winner: null };
    setGame(next);
    await safeSet("mastermind", next, true);
    setDigits(["", "", "", ""]);
  };

  const setDigit = (i, val) => {
    const clean = val.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = clean;
    setDigits(next);
    if (clean && inputRefs[i + 1]) inputRefs[i + 1].current?.focus();
  };

  const submitGuess = async () => {
    if (!game || game.turn !== me || digits.some((d) => d === "")) return;
    const guessArr = digits.map(Number);
    const feedback = guessArr.map((d, i) => d === game.secret[i]);
    const revealed = game.revealed.map((r, i) => (feedback[i] ? game.secret[i] : r));
    const won = revealed.every((r) => r !== null);
    const next = {
      ...game,
      revealed,
      guesses: [...game.guesses, { by: me, values: guessArr, feedback }],
      turn: won ? game.turn : partner,
      winner: won ? me : null,
    };
    setGame(next);
    await safeSet("mastermind", next, true);
    setDigits(["", "", "", ""]);
  };

  if (loading) return <p className="text-sm opacity-60 text-center py-10" style={{ color: CREAM }}>Loading…</p>;

  if (!game) {
    return (
      <SectionCard>
        <p className="text-sm mb-3 text-center" style={{ color: CREAM }}>Generate a secret 4-digit code — you'll take turns guessing it together. First to crack it wins.</p>
        <button onClick={startNew} className="w-full rounded-lg py-2.5 text-sm font-semibold" style={{ background: CORAL, color: "#14213D" }}>Generate code</button>
      </SectionCard>
    );
  }

  const myTurn = game.turn === me && !game.winner;

  return (
    <SectionCard>
      <p className="text-xs uppercase tracking-wide opacity-50 mb-3 text-center" style={{ color: CREAM }}>The code</p>
      <div className="flex justify-center gap-2 mb-4">
        {game.revealed.map((d, i) => (
          <div key={i} className="w-11 h-11 rounded-lg flex items-center justify-center font-mono text-lg font-bold"
            style={{ background: d !== null ? TEAL : "rgba(255,255,255,0.08)", color: d !== null ? "#0F1B33" : CREAM }}>
            {d !== null ? d : "_"}
          </div>
        ))}
      </div>

      {game.winner ? (
        <div className="text-center">
          <p className="text-sm mb-3" style={{ color: CREAM }}>
            {game.winner === me ? "You cracked it! 🏆" : `${partner === "jeff" ? "Jeff" : "Natali"} cracked it first`}
          </p>
          <button onClick={startNew} className="w-full rounded-lg py-2 text-sm font-semibold flex items-center justify-center gap-2" style={{ background: TEAL, color: "#0F1B33" }}>
            <RotateCcw size={14} /> New code
          </button>
        </div>
      ) : myTurn ? (
        <div>
          <p className="text-xs text-center mb-2 opacity-60" style={{ color: CREAM }}>Your turn — guess all 4 digits</p>
          <div className="flex justify-center gap-2 mb-3">
            {digits.map((d, i) => (
              <input key={i} ref={inputRefs[i]} value={d} onChange={(e) => setDigit(i, e.target.value)} inputMode="numeric"
                maxLength={1} className="w-11 h-11 rounded-lg text-center font-mono text-lg bg-white/10 outline-none" style={{ color: CREAM }} />
            ))}
          </div>
          <button onClick={submitGuess} className="w-full rounded-lg py-2 text-sm font-semibold" style={{ background: CORAL, color: "#14213D" }}>Submit guess</button>
        </div>
      ) : (
        <p className="text-sm text-center opacity-60" style={{ color: CREAM }}>Waiting on {partner === "jeff" ? "Jeff" : "Natali"}'s turn…</p>
      )}

      {game.guesses.length > 0 && (
        <div className="mt-4 pt-3 border-t border-white/10">
          <p className="text-xs uppercase tracking-wide opacity-40 mb-2" style={{ color: CREAM }}>History</p>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {game.guesses.slice().reverse().map((g, i) => (
              <div key={i} className="flex items-center gap-1 text-xs" style={{ color: CREAM }}>
                <span className="opacity-50 w-12 shrink-0">{g.by === me ? "You" : partner === "jeff" ? "Jeff" : "Natali"}</span>
                {g.values.map((v, j) => (
                  <span key={j} className="w-5 h-5 rounded flex items-center justify-center font-mono"
                    style={{ background: g.feedback[j] ? TEAL : "rgba(255,255,255,0.08)", color: g.feedback[j] ? "#0F1B33" : CREAM }}>
                    {v}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
      <button onClick={load} className="text-xs mt-3 opacity-50 underline block mx-auto" style={{ color: CREAM }}>refresh</button>
    </SectionCard>
  );
}

// ---------- Snaps ----------
function compressImage(dataUrl, maxW = 640, quality = 0.6) {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      const scale = Math.min(1, maxW / img.width);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.src = dataUrl;
  });
}

function SnapsTab({ me, partner }) {
  const [snaps, setSnaps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [composing, setComposing] = useState(false);
  const [mode, setMode] = useState("doodle");
  const [textSnap, setTextSnap] = useState("");
  const [photoData, setPhotoData] = useState(null);
  const [compressing, setCompressing] = useState(false);
  const [viewing, setViewing] = useState(null);
  const canvasRef = React.useRef(null);
  const strokesRef = React.useRef([]);
  const drawingRef = React.useRef(false);
  const cameraInputRef = React.useRef(null);

  const load = useCallback(async () => {
    const raw = await safeGet("snaps", true);
    setSnaps(raw ? JSON.parse(raw) : []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const persist = async (next) => {
    setSnaps(next);
    await safeSet("snaps", next, true);
  };

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: (clientX - rect.left) / rect.width, y: (clientY - rect.top) / rect.height };
  };

  const startDraw = (e) => {
    drawingRef.current = true;
    strokesRef.current.push([getPos(e, canvasRef.current)]);
  };
  const moveDraw = (e) => {
    if (!drawingRef.current) return;
    const p = getPos(e, canvasRef.current);
    strokesRef.current[strokesRef.current.length - 1].push(p);
    redraw();
  };
  const endDraw = () => { drawingRef.current = false; };
  const redraw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = CORAL;
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    strokesRef.current.forEach((stroke) => {
      ctx.beginPath();
      stroke.forEach((p, i) => {
        const x = p.x * canvas.width, y = p.y * canvas.height;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
    });
  };
  const clearCanvas = () => {
    strokesRef.current = [];
    redraw();
  };

  const handleFile = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setCompressing(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const compressed = await compressImage(reader.result);
      setPhotoData(compressed);
      setCompressing(false);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const sendSnap = async () => {
    let content;
    if (mode === "doodle") {
      if (strokesRef.current.length === 0) return;
      content = { strokes: strokesRef.current };
    } else if (mode === "photo") {
      if (!photoData) return;
      content = { image: photoData };
    } else {
      if (!textSnap.trim()) return;
      content = { text: textSnap };
    }
    const snap = { id: `${Date.now()}`, from: me, to: partner, type: mode, content, createdAt: new Date().toISOString(), viewed: false, kept: false };
    await persist([snap, ...snaps]);
    strokesRef.current = [];
    setTextSnap("");
    setPhotoData(null);
    setComposing(false);
  };

  const openSnap = (snap) => setViewing(snap);

  const closeSnap = async (keep) => {
    if (!viewing) return;
    let next;
    if (keep) {
      next = snaps.map((s) => (s.id === viewing.id ? { ...s, kept: true, viewed: true } : s));
    } else {
      next = snaps.filter((s) => s.id !== viewing.id);
    }
    await persist(next);
    setViewing(null);
  };

  const saveToDevice = () => {
    if (!viewing || viewing.type !== "photo") return;
    const a = document.createElement("a");
    a.href = viewing.content.image;
    a.download = `snap-${viewing.id}.jpg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  if (loading) return <p className="text-sm opacity-60 text-center py-10" style={{ color: CREAM }}>Loading snaps…</p>;

  const inbox = snaps.filter((s) => s.to === me);
  const kept = snaps.filter((s) => s.kept);

  if (viewing) {
    return (
      <SectionCard>
        <div className="flex justify-between items-center mb-3">
          <p className="text-xs opacity-60" style={{ color: CREAM }}>From {viewing.from === "jeff" ? "Jeff" : "Natali"}</p>
          <button onClick={() => setViewing(null)}><X size={16} color={CREAM} /></button>
        </div>
        <div className="rounded-xl bg-white/5 p-3 mb-4 flex items-center justify-center overflow-hidden" style={{ minHeight: 180 }}>
          {viewing.type === "text" && <p className="font-display text-xl text-center" style={{ color: CREAM }}>{viewing.content.text}</p>}
          {viewing.type === "doodle" && <ReplayCanvas strokes={viewing.content.strokes} />}
          {viewing.type === "photo" && <img src={viewing.content.image} alt="snap" className="max-h-64 w-full object-contain rounded-lg" />}
        </div>
        {viewing.type === "photo" && (
          <button onClick={saveToDevice} className="w-full rounded-lg py-2 text-sm mb-2 flex items-center justify-center gap-2" style={{ background: "rgba(255,255,255,0.08)", color: CREAM }}>
            <Download size={14} /> Save to my phone
          </button>
        )}
        {!viewing.kept ? (
          <div className="flex gap-2">
            <button onClick={() => closeSnap(true)} className="flex-1 rounded-lg py-2 text-sm font-semibold" style={{ background: TEAL, color: "#0F1B33" }}>Keep in app</button>
            <button onClick={() => closeSnap(false)} className="flex-1 rounded-lg py-2 text-sm" style={{ background: "rgba(255,255,255,0.08)", color: CREAM }}>Let it disappear</button>
          </div>
        ) : (
          <p className="text-xs text-center opacity-50" style={{ color: CREAM }}>Kept in your gallery</p>
        )}
      </SectionCard>
    );
  }

  return (
    <div>
      <SectionCard>
        <div className="flex items-center gap-2 mb-3">
          <Camera size={16} color={CORAL} />
          <p className="text-xs uppercase tracking-wide opacity-50" style={{ color: CREAM }}>Send a snap</p>
        </div>
        {!composing ? (
          <button onClick={() => setComposing(true)} className="w-full rounded-lg py-2.5 text-sm font-semibold" style={{ background: CORAL, color: "#14213D" }}>
            New snap
          </button>
        ) : (
          <div>
            <div className="flex gap-2 mb-3">
              <button onClick={() => setMode("doodle")} className="flex-1 rounded-lg py-1.5 text-xs" style={mode === "doodle" ? { background: TEAL, color: "#0F1B33" } : { background: "rgba(255,255,255,0.08)", color: CREAM }}>Doodle</button>
              <button onClick={() => setMode("photo")} className="flex-1 rounded-lg py-1.5 text-xs" style={mode === "photo" ? { background: TEAL, color: "#0F1B33" } : { background: "rgba(255,255,255,0.08)", color: CREAM }}>Photo</button>
              <button onClick={() => setMode("text")} className="flex-1 rounded-lg py-1.5 text-xs" style={mode === "text" ? { background: TEAL, color: "#0F1B33" } : { background: "rgba(255,255,255,0.08)", color: CREAM }}>Note</button>
            </div>

            {mode === "doodle" && (
              <div>
                <canvas
                  ref={canvasRef}
                  width={300}
                  height={180}
                  className="w-full rounded-lg bg-white/5 touch-none"
                  onMouseDown={startDraw}
                  onMouseMove={moveDraw}
                  onMouseUp={endDraw}
                  onMouseLeave={endDraw}
                  onTouchStart={startDraw}
                  onTouchMove={moveDraw}
                  onTouchEnd={endDraw}
                />
                <button onClick={clearCanvas} className="text-xs mt-2 opacity-60 flex items-center gap-1" style={{ color: CREAM }}>
                  <Eraser size={12} /> clear
                </button>
              </div>
            )}

            {mode === "photo" && (
              <div>
                <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
                {compressing ? (
                  <p className="text-xs text-center py-8 opacity-60" style={{ color: CREAM }}>Preparing photo…</p>
                ) : photoData ? (
                  <div>
                    <img src={photoData} alt="preview" className="w-full rounded-lg mb-2 max-h-48 object-contain bg-black/20" />
                    <button onClick={() => setPhotoData(null)} className="text-xs opacity-60 underline" style={{ color: CREAM }}>retake</button>
                  </div>
                ) : (
                  <button onClick={() => cameraInputRef.current?.click()} className="w-full rounded-lg py-8 flex flex-col items-center gap-1 bg-white/8">
                    <Camera size={22} color={TEAL} />
                    <span className="text-xs" style={{ color: CREAM }}>Take photo</span>
                    <span className="text-[10px] opacity-40" style={{ color: CREAM }}>camera only — keeps it in the moment</span>
                  </button>
                )}
              </div>
            )}

            {mode === "text" && (
              <input value={textSnap} onChange={(e) => setTextSnap(e.target.value)} placeholder="Thinking of you…"
                className="w-full rounded-lg px-3 py-2 bg-white/10 text-sm outline-none" style={{ color: CREAM }} />
            )}

            <div className="flex gap-2 mt-3">
              <button onClick={sendSnap} className="flex-1 rounded-lg py-2 text-sm font-semibold" style={{ background: CORAL, color: "#14213D" }}>Send</button>
              <button onClick={() => { setComposing(false); clearCanvas(); setPhotoData(null); }} className="flex-1 rounded-lg py-2 text-sm" style={{ background: "rgba(255,255,255,0.08)", color: CREAM }}>Cancel</button>
            </div>
          </div>
        )}
      </SectionCard>

      <SectionCard>
        <p className="text-xs uppercase tracking-wide opacity-50 mb-3" style={{ color: CREAM }}>Inbox ({inbox.length})</p>
        {inbox.length === 0 && <p className="text-sm opacity-50" style={{ color: CREAM }}>Nothing waiting for you.</p>}
        <div className="space-y-2">
          {inbox.map((s) => (
            <button key={s.id} onClick={() => openSnap(s)} className="w-full flex items-center justify-between rounded-lg px-3 py-2 bg-white/5">
              <span className="text-sm" style={{ color: CREAM }}>{s.type === "text" ? "💬 Quick note" : s.type === "photo" ? "📷 Photo" : "🎨 Doodle"}</span>
              <span className="text-[10px] opacity-40" style={{ color: CREAM }}>{new Date(s.createdAt).toLocaleTimeString()}</span>
            </button>
          ))}
        </div>
      </SectionCard>

      {kept.length > 0 && (
        <SectionCard>
          <p className="text-xs uppercase tracking-wide opacity-50 mb-3" style={{ color: CREAM }}>Kept gallery ({kept.length})</p>
          <div className="space-y-2">
            {kept.map((s) => (
              <button key={s.id} onClick={() => setViewing(s)} className="w-full flex items-center justify-between rounded-lg px-3 py-2 bg-white/5">
                <span className="text-sm" style={{ color: CREAM }}>{s.type === "text" ? "💬" : s.type === "photo" ? "📷" : "🎨"} from {s.from === "jeff" ? "Jeff" : "Natali"}</span>
              </button>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}

function ReplayCanvas({ strokes }) {
  const ref = React.useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = CORAL;
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    strokes.forEach((stroke) => {
      ctx.beginPath();
      stroke.forEach((p, i) => {
        const x = p.x * canvas.width, y = p.y * canvas.height;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
    });
  }, [strokes]);
  return <canvas ref={ref} width={280} height={160} className="rounded-lg bg-white/5" />;
}

// ---------- Bottom Nav ----------
function useMissionBadge(me) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let active = true;
    const partner = me === "jeff" ? "natali" : "jeff";
    const check = async () => {
      const raw = await safeGet("missions", true);
      if (!raw) { if (active) setCount(0); return; }
      const missions = JSON.parse(raw);
      const pendingForMe = missions.filter((m) => m.assignedTo === me && m.status === "pending").length;
      const unseenDone = missions.filter((m) => m.assignedBy === me && m.status === "done" && !m.seenByAssigner).length;
      if (active) setCount(pendingForMe + unseenDone);
    };
    check();
    const id = setInterval(check, 12000);
    return () => { active = false; clearInterval(id); };
  }, [me]);
  return count;
}

function BottomNav({ tab, setTab, me }) {
  const missionBadge = useMissionBadge(me);
  const items = [
    { id: "status", label: "Status", icon: Heart },
    { id: "pet", label: "Pet", icon: CatIcon },
    { id: "question", label: "Daily Q", icon: Sparkles },
    { id: "missions", label: "Missions", icon: Target, badge: missionBadge },
    { id: "play", label: "Play", icon: Gamepad2 },
  ];
  return (
    <div className="fixed bottom-0 left-0 right-0 border-t border-white/10 backdrop-blur" style={{ background: "rgba(15,27,51,0.9)" }}>
      <div className="max-w-md mx-auto flex">
        {items.map(({ id, label, icon: Icon, badge }) => (
          <button key={id} onClick={() => setTab(id)} className="flex-1 py-3 flex flex-col items-center gap-1 relative">
            <span className="relative">
              <Icon size={17} color={tab === id ? CORAL : "rgba(245,239,230,0.4)"} fill={tab === id && id === "status" ? CORAL : "none"} />
              {badge > 0 && <span className="absolute -top-1 -right-1.5 w-2 h-2 rounded-full" style={{ background: CORAL }} />}
            </span>
            <span className="text-[10px]" style={{ color: tab === id ? CORAL : "rgba(245,239,230,0.4)" }}>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
