import {loadFont as loadJetBrainsMono} from "@remotion/google-fonts/JetBrainsMono";
import {loadFont as loadSpaceGrotesk} from "@remotion/google-fonts/SpaceGrotesk";
import {ArrowRight, DollarSign, Globe2, MapPin, Wifi} from "lucide-react";
import {
  AbsoluteFill,
  Audio,
  Easing,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import stats from "./ad-stats.json";
import voiceover from "./voiceover.json";
import {colors, fadeRange, mono, reveal, sans, snappyReveal} from "./theme";
import {Brand, GlassPanel, Pill} from "./ui";

loadSpaceGrotesk("normal", {weights: ["400", "500", "600", "700"], subsets: ["latin"]});
loadJetBrainsMono("normal", {weights: ["400", "600", "700"], subsets: ["latin"]});

export type EndpointJobsSocialProps = {
  siteUrl: string;
};

// Scene timing is derived from the voiceover: each scene lasts at least long enough for its
// animation, and stretches when its narration clip runs longer. Scenes overlap by OVERLAP for the wipe.
const OVERLAP = 0.35;
const VOICE_LEAD = 0.3; // narration starts once the wipe has mostly landed
const VOICE_GAP = 0.25; // breathing room before the next scene's line
const CTA_HOLD = 0.8; // hold on the end card after the last word
const SCENE_IDS = ["hook", "count", "tools", "proof", "cta"] as const;
type SceneId = (typeof SCENE_IDS)[number];
const MIN_SCENE_SECONDS: Record<SceneId, number> = {hook: 3.1, count: 3.35, tools: 3.85, proof: 3.65, cta: 3.45};

const buildTimeline = () => {
  let cursor = 0;
  return SCENE_IDS.map((id) => {
    const voice = voiceover.find((line) => line.id === id);
    const lead = id === "hook" ? 0.25 : VOICE_LEAD;
    const tail = id === "cta" ? CTA_HOLD : VOICE_GAP;
    const length = Math.max(MIN_SCENE_SECONDS[id], voice ? lead + voice.durationSeconds + tail : 0);
    const scene = {id, start: cursor, end: cursor + length, voice, voiceStart: lead};
    cursor += length - OVERLAP;
    return scene;
  });
};

const TIMELINE = buildTimeline();
export const SOCIAL_DURATION_SECONDS = TIMELINE[TIMELINE.length - 1].end;

const NOISE_TITLES = [
  "Help Desk Technician",
  "Sales Development Rep",
  "Data Entry Clerk",
  "IT Support Specialist I",
  "Retail Store Associate",
  "Call Center Agent",
];

const EYEBROW: React.CSSProperties = {
  fontFamily: mono,
  fontSize: 26,
  fontWeight: 700,
  letterSpacing: 2,
  color: colors.lime,
};

const HEADLINE: React.CSSProperties = {
  fontFamily: sans,
  fontSize: 118,
  fontWeight: 650,
  lineHeight: 0.98,
  letterSpacing: -5,
  color: colors.white,
};

const SAFE_COLUMN: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  padding: "170px 72px 300px",
};

const lift = (progress: number, distance = 60) => ({
  opacity: progress,
  transform: `translateY(${interpolate(progress, [0, 1], [distance, 0])}px)`,
});

const formatNumber = (value: number) => Math.round(value).toLocaleString("en-US");

const countUp = (frame: number, fps: number, target: number, startSeconds: number, seconds: number) =>
  interpolate(frame, [startSeconds * fps, (startSeconds + seconds) * fps], [0, target], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

// Wipes the scene in from the bottom with a lime leading edge.
const SceneWipe = ({children}: {children: React.ReactNode}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const progress = interpolate(frame, [0, OVERLAP * fps], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });

  return (
    <AbsoluteFill style={{clipPath: `inset(${100 - progress}% 0 0 0)`}}>
      <AbsoluteFill style={{background: "linear-gradient(180deg, #030807 0%, #000000 55%, #050b07 100%)"}} />
      <SceneGrid />
      {children}
      {progress < 100 && (
        <div style={{position: "absolute", left: 0, right: 0, top: `${100 - progress}%`, height: 6, background: colors.lime, boxShadow: `0 0 50px ${colors.lime}`}} />
      )}
    </AbsoluteFill>
  );
};

const SceneGrid = () => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        position: "absolute",
        inset: -100,
        opacity: 0.5,
        transform: `translateY(${(frame * 0.6) % 80}px)`,
        backgroundImage: "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
        backgroundSize: "80px 80px",
      }}
    />
  );
};

const Glow = () => {
  const frame = useCurrentFrame();
  const pulse = 0.75 + Math.sin(frame / 28) * 0.12;
  return (
    <AbsoluteFill style={{pointerEvents: "none"}}>
      <div style={{position: "absolute", width: 1100, height: 1100, left: -500, top: -420, borderRadius: 1100, opacity: pulse, background: "radial-gradient(circle, rgba(45,212,191,0.16), transparent 68%)"}} />
      <div style={{position: "absolute", width: 1200, height: 1200, right: -560, bottom: -520, borderRadius: 1200, opacity: pulse, background: "radial-gradient(circle, rgba(190,242,100,0.14), transparent 70%)"}} />
    </AbsoluteFill>
  );
};

// Story-style progress bar so the vertical cut reads as native on Reels/Shorts/TikTok.
const StoryProgress = () => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  return (
    <div style={{position: "absolute", top: 54, left: 54, right: 54, display: "flex", gap: 10}}>
      {TIMELINE.map(({start, end}) => {
        const fill = interpolate(frame, [start * fps, Math.min(end * fps, durationInFrames)], [0, 100], {extrapolateLeft: "clamp", extrapolateRight: "clamp"});
        return (
          <div key={start} style={{flex: 1, height: 6, borderRadius: 6, background: "rgba(255,255,255,0.14)", overflow: "hidden"}}>
            <div style={{width: `${fill}%`, height: "100%", background: colors.white}} />
          </div>
        );
      })}
    </div>
  );
};

const HookScene = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const eyebrowIn = reveal(frame, fps, 0.05);
  const headlineIn = reveal(frame, fps, 1.95);

  return (
    <AbsoluteFill style={SAFE_COLUMN}>
      <div style={{...EYEBROW, color: colors.muted, ...lift(eyebrowIn, 20)}}>YOUR LAST JOB SEARCH:</div>
      <div style={{display: "flex", flexDirection: "column", gap: 26, marginTop: 56}}>
        {NOISE_TITLES.map((title, index) => {
          const start = 0.2 + index * 0.17;
          const itemIn = snappyReveal(frame, fps, start);
          const strike = fadeRange(frame, [(start + 0.35) * fps, (start + 0.55) * fps]);
          return (
            <div key={title} style={{position: "relative", alignSelf: "flex-start", ...lift(itemIn, 30)}}>
              <div style={{fontFamily: sans, fontSize: 62, fontWeight: 600, letterSpacing: -2, color: strike > 0.5 ? colors.faint : colors.white}}>{title}</div>
              <div style={{position: "absolute", left: -8, top: "54%", height: 7, width: `calc(${strike * 100}% + 16px)`, borderRadius: 7, background: "#f87171"}} />
            </div>
          );
        })}
      </div>
      <div style={{...HEADLINE, marginTop: 110, ...lift(headlineIn, 80)}}>
        Wrong jobs.<br /><span style={{color: colors.lime}}>Every scroll.</span>
      </div>
    </AbsoluteFill>
  );
};

const MarqueeRow = ({items, speed, offset}: {items: string[]; speed: number; offset: number}) => {
  const frame = useCurrentFrame();
  const loop = [...items, ...items, ...items];
  return (
    <div style={{display: "flex", gap: 24, zoom: 1.6, transform: `translateX(${(offset + frame * speed) / 1.6}px)`}}>
      {loop.map((item, index) => (
        <Pill key={`${item}-${index}`} active={index % 4 === 0}>{item}</Pill>
      ))}
    </div>
  );
};

const CountScene = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const count = countUp(frame, fps, stats.total, 0.3, 1.6);
  const numberIn = snappyReveal(frame, fps, 0.25);
  const copyIn = reveal(frame, fps, 0.9);
  const tickerIn = reveal(frame, fps, 1.3);
  const settle = fadeRange(frame, [1.75 * fps, 2.05 * fps]);
  const platforms = ["macOS", "Windows", "iOS", "Linux", "Android", "ChromeOS"];
  const roles = ["Endpoint Engineer", "Client Platform", "MDM Admin", "Digital Workplace", "EUC Architect"];

  return (
    <SceneWipe>
      <AbsoluteFill style={SAFE_COLUMN}>
        <div style={{...EYEBROW, ...lift(copyIn, 20)}}>ENDPOINTJOBS.DEV</div>
        <div
          style={{
            fontFamily: sans,
            fontSize: 290,
            fontWeight: 700,
            letterSpacing: -16,
            lineHeight: 1,
            marginTop: 40,
            color: colors.lime,
            textShadow: `0 0 ${80 * settle}px rgba(190,242,100,0.45)`,
            transform: `scale(${interpolate(numberIn, [0, 1], [0.7, 1]) + settle * 0.02})`,
            transformOrigin: "left center",
            opacity: numberIn,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {formatNumber(count)}
        </div>
        <div style={{...HEADLINE, fontSize: 104, marginTop: 30, ...lift(copyIn)}}>
          endpoint roles.<br /><span style={{color: colors.muted}}>Nothing else.</span>
        </div>
        <div style={{display: "flex", flexDirection: "column", gap: 22, marginTop: 110, marginLeft: -72, marginRight: -72, opacity: tickerIn}}>
          <MarqueeRow items={platforms} speed={-2.4} offset={0} />
          <MarqueeRow items={roles} speed={2.4} offset={-2200} />
        </div>
      </AbsoluteFill>
    </SceneWipe>
  );
};

const ToolsScene = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const headIn = reveal(frame, fps, 0.3);
  const max = stats.tools[0].total;

  return (
    <SceneWipe>
      <AbsoluteFill style={SAFE_COLUMN}>
        <div style={{...EYEBROW, ...lift(headIn, 20)}}>OPEN ROLES BY TOOL</div>
        <div style={{...HEADLINE, marginTop: 34, ...lift(headIn)}}>
          Filter by the<br />stack you <span style={{color: colors.lime}}>run.</span>
        </div>
        <div style={{display: "flex", flexDirection: "column", gap: 34, marginTop: 90}}>
          {stats.tools.map((tool, index) => {
            const start = 0.75 + index * 0.13;
            const rowIn = snappyReveal(frame, fps, start);
            const width = interpolate(frame, [start * fps, (start + 0.9) * fps], [0, tool.total / max], {extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic)});
            const active = index === 0;
            return (
              <div key={tool.name} style={lift(rowIn, 24)}>
                <div style={{display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14}}>
                  <span style={{fontFamily: sans, fontSize: 46, fontWeight: 650, letterSpacing: -1.5, color: active ? colors.lime : colors.white}}>{tool.name}</span>
                  <span style={{fontFamily: mono, fontSize: 36, fontWeight: 700, color: colors.white, fontVariantNumeric: "tabular-nums"}}>{formatNumber(width * max)}</span>
                </div>
                <div style={{height: 22, borderRadius: 22, background: "rgba(255,255,255,0.06)", overflow: "hidden"}}>
                  <div style={{width: `${width * 100}%`, height: "100%", borderRadius: 22, background: active ? `linear-gradient(90deg, ${colors.emerald}, ${colors.lime})` : "rgba(243,244,246,0.32)"}} />
                </div>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </SceneWipe>
  );
};

const STAT_ICONS = {wifi: Wifi, salary: DollarSign, globe: Globe2};

const ProofScene = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const headIn = reveal(frame, fps, 0.3);
  const tiles = [
    {icon: "wifi", value: stats.remoteOrHybrid, label: "REMOTE OR HYBRID", color: colors.emerald},
    {icon: "salary", value: stats.salaryShown, label: "WITH SALARY SHOWN", color: colors.lime},
    {icon: "globe", value: stats.locations, label: "COUNTRIES & REGIONS", color: colors.cyan},
  ] as const;
  const job = stats.highlights[0];
  const cardIn = snappyReveal(frame, fps, 1.7);
  const cardGlow = fadeRange(frame, [2.1 * fps, 2.5 * fps]);

  return (
    <SceneWipe>
      <AbsoluteFill style={SAFE_COLUMN}>
        <div style={{...EYEBROW, ...lift(headIn, 20)}}>SIGNAL, NOT NOISE</div>
        <div style={{...HEADLINE, marginTop: 34, ...lift(headIn)}}>
          The details<br /><span style={{color: colors.lime}}>up front.</span>
        </div>
        <div style={{display: "flex", flexDirection: "column", gap: 22, marginTop: 80}}>
          {tiles.map((tile, index) => {
            const start = 0.65 + index * 0.18;
            const tileIn = snappyReveal(frame, fps, start);
            const Icon = STAT_ICONS[tile.icon];
            return (
              <GlassPanel key={tile.label} style={{display: "flex", alignItems: "center", gap: 34, padding: "30px 38px", opacity: tileIn, transform: `translateX(${interpolate(tileIn, [0, 1], [index % 2 ? 140 : -140, 0])}px)`}}>
                <div style={{display: "grid", placeItems: "center", width: 88, height: 88, borderRadius: 22, background: "rgba(255,255,255,0.05)", color: tile.color}}><Icon size={46} /></div>
                <div>
                  <div style={{fontFamily: sans, fontSize: 84, fontWeight: 700, lineHeight: 1, letterSpacing: -3, color: tile.color, fontVariantNumeric: "tabular-nums"}}>{formatNumber(countUp(frame, fps, tile.value, start, 1))}</div>
                  <div style={{fontFamily: mono, fontSize: 24, fontWeight: 700, letterSpacing: 1.5, color: colors.muted, marginTop: 8}}>{tile.label}</div>
                </div>
              </GlassPanel>
            );
          })}
        </div>
        {job && (
          <GlassPanel style={{marginTop: 46, padding: "34px 38px", opacity: cardIn, transform: `translateY(${interpolate(cardIn, [0, 1], [80, 0])}px)`, boxShadow: `inset 6px 0 0 rgba(190,242,100,${0.2 + cardGlow * 0.8}), 0 40px 120px rgba(0,0,0,0.55)`}}>
            <div style={{fontFamily: sans, fontSize: 46, fontWeight: 650, letterSpacing: -1.4, color: colors.white}}>{job.title}</div>
            <div style={{display: "flex", gap: 28, marginTop: 18, fontFamily: mono, fontSize: 28, fontWeight: 600}}>
              <span style={{display: "flex", alignItems: "center", gap: 10, color: colors.muted}}><MapPin size={28} color={colors.emerald} />{job.workplace}</span>
              <span style={{display: "flex", alignItems: "center", gap: 6, color: colors.white}}><DollarSign size={28} color={colors.lime} />{job.salary.replace("$", "")}</span>
            </div>
            <div style={{display: "flex", gap: 12, marginTop: 24}}>
              {job.tools.map((tool) => <Pill key={tool} active>{tool.toUpperCase()}</Pill>)}
            </div>
          </GlassPanel>
        )}
      </AbsoluteFill>
    </SceneWipe>
  );
};

const CtaScene = ({siteUrl}: EndpointJobsSocialProps) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const brandIn = reveal(frame, fps, 0.35);
  const titleIn = reveal(frame, fps, 0.6);
  const ctaIn = snappyReveal(frame, fps, 1.15);
  const detailIn = reveal(frame, fps, 1.5);
  const sweep = interpolate(frame, [1.6 * fps, 2.8 * fps], [-300, 1100], {extrapolateLeft: "clamp", extrapolateRight: "clamp"});
  const breathe = 1 + Math.sin(Math.max(0, frame - 1.6 * fps) / 9) * 0.012;

  return (
    <SceneWipe>
      <AbsoluteFill style={{display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "0 72px"}}>
        <div style={{transform: `scale(1.5) translateY(${interpolate(brandIn, [0, 1], [-20, 0])}px)`, opacity: brandIn}}><Brand /></div>
        <div style={{...HEADLINE, fontSize: 128, marginTop: 110, ...lift(titleIn)}}>
          Find your next<br /><span style={{color: colors.lime}}>endpoint role.</span>
        </div>
        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            height: 140,
            marginTop: 90,
            padding: "0 26px 0 46px",
            borderRadius: 28,
            border: "2px solid rgba(190,242,100,0.55)",
            background: "rgba(190,242,100,0.10)",
            boxShadow: "0 0 110px rgba(190,242,100,0.16)",
            overflow: "hidden",
            opacity: ctaIn,
            transform: `scale(${interpolate(ctaIn, [0, 1], [0.9, 1]) * breathe})`,
          }}
        >
          <span style={{fontFamily: mono, fontSize: 50, fontWeight: 700, color: colors.white, letterSpacing: -1}}>{siteUrl}</span>
          <span style={{display: "grid", placeItems: "center", width: 92, height: 92, borderRadius: 20, background: colors.lime, color: colors.obsidian}}><ArrowRight size={48} strokeWidth={2.5} /></span>
          <div style={{position: "absolute", top: -60, left: sweep, width: 220, height: 260, transform: "rotate(18deg)", background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.16), transparent)"}} />
        </div>
        <div style={{fontFamily: mono, fontSize: 30, fontWeight: 700, letterSpacing: 2, color: colors.muted, marginTop: 56, ...lift(detailIn, 20)}}>
          FREE · REFRESHED DAILY
        </div>
      </AbsoluteFill>
    </SceneWipe>
  );
};

const SCENE_COMPONENTS: Record<SceneId, React.ComponentType<EndpointJobsSocialProps>> = {
  hook: HookScene,
  count: CountScene,
  tools: ToolsScene,
  proof: ProofScene,
  cta: CtaScene,
};

export const EndpointJobsSocial = ({siteUrl}: EndpointJobsSocialProps) => {
  const {fps} = useVideoConfig();

  return (
    <AbsoluteFill style={{fontFamily: sans, background: colors.black, overflow: "hidden"}}>
      <AbsoluteFill style={{background: "linear-gradient(180deg, #050b0a 0%, #000000 60%, #060c07 100%)"}} />
      <SceneGrid />
      {TIMELINE.map(({id, start, end, voice, voiceStart}) => {
        const Scene = SCENE_COMPONENTS[id];
        return (
          <Sequence key={id} from={Math.round(start * fps)} durationInFrames={Math.round((end - start) * fps)} premountFor={fps}>
            <Scene siteUrl={siteUrl} />
            {voice && (
              <Sequence from={Math.round(voiceStart * fps)} layout="none">
                <Audio src={staticFile(voice.file)} />
              </Sequence>
            )}
          </Sequence>
        );
      })}
      <Glow />
      <StoryProgress />
    </AbsoluteFill>
  );
};
