import {loadFont as loadJetBrainsMono} from "@remotion/google-fonts/JetBrainsMono";
import {loadFont as loadSpaceGrotesk} from "@remotion/google-fonts/SpaceGrotesk";
import {ArrowRight, Command, Monitor, Search} from "lucide-react";
import {
  AbsoluteFill,
  interpolate,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import {colors, fadeRange, mono, reveal, sans, snappyReveal} from "./theme";
import {Benefit, Brand, GlassPanel, JobCard, MiniMap, Pill, SearchWorkbench} from "./ui";

loadSpaceGrotesk("normal", {
  weights: ["400", "500", "600", "700"],
  subsets: ["latin"],
});
loadJetBrainsMono("normal", {
  weights: ["400", "600", "700"],
  subsets: ["latin"],
});

export type EndpointJobsAdProps = {
  siteUrl: string;
};

const GRID_OVERLAY_STYLE: React.CSSProperties = {
  position: "absolute",
  inset: -120,
  opacity: 0.56,
  backgroundImage: "linear-gradient(rgba(255,255,255,0.042) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.042) 1px, transparent 1px)",
  backgroundSize: "72px 72px",
};

const GLOW_TEAL_STYLE: React.CSSProperties = {
  position: "absolute",
  width: 880,
  height: 880,
  borderRadius: 1000,
  left: -330,
  top: -380,
  background: "radial-gradient(circle, rgba(45,212,191,0.18), rgba(45,212,191,0) 68%)",
};

const GLOW_LIME_STYLE: React.CSSProperties = {
  position: "absolute",
  width: 980,
  height: 980,
  borderRadius: 1000,
  right: -380,
  bottom: -520,
  background: "radial-gradient(circle, rgba(190,242,100,0.14), rgba(190,242,100,0) 70%)",
};

const EYEBROW_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  color: colors.lime,
  fontFamily: mono,
  fontSize: 16,
  fontWeight: 700,
  letterSpacing: 1.4,
};

const SEARCH_EYEBROW_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  color: colors.emerald,
  fontFamily: mono,
  fontSize: 16,
  fontWeight: 700,
  letterSpacing: 1.35,
};

const INTRO_HEADLINE_STYLE: React.CSSProperties = {
  fontFamily: sans,
  color: colors.white,
  fontSize: 112,
  fontWeight: 650,
  letterSpacing: -5.5,
  lineHeight: 0.96,
  marginTop: 30,
};

const INTRO_SUBHEAD_STYLE: React.CSSProperties = {
  fontFamily: sans,
  color: colors.muted,
  fontSize: 36,
  fontWeight: 450,
  letterSpacing: -0.8,
  marginTop: 36,
};

const SEARCH_HEADLINE_STYLE: React.CSSProperties = {
  fontFamily: sans,
  fontSize: 82,
  fontWeight: 650,
  lineHeight: 1.02,
  letterSpacing: -4,
  color: colors.white,
  marginTop: 28,
};

const OUTRO_HEADLINE_STYLE: React.CSSProperties = {
  fontFamily: sans,
  color: colors.white,
  fontSize: 108,
  fontWeight: 650,
  letterSpacing: -5.5,
  lineHeight: 0.98,
  marginTop: 65,
};

const PANEL_LABEL_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  fontFamily: mono,
  fontSize: 14,
  fontWeight: 700,
  letterSpacing: 1,
  color: colors.muted,
};

const PROGRESS_TRACK_STYLE: React.CSSProperties = {
  height: 8,
  borderRadius: 20,
  background: "rgba(255,255,255,0.08)",
  overflow: "hidden",
  marginTop: 21,
};

const OUTRO_CENTER_STYLE: React.CSSProperties = {
  position: "absolute",
  inset: 80,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
};

const CTA_BUTTON_STYLE: React.CSSProperties = {
  position: "relative",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  width: 710,
  height: 96,
  padding: "0 21px 0 34px",
  marginTop: 52,
  borderRadius: 18,
  border: "1px solid rgba(190,242,100,0.48)",
  background: "rgba(190,242,100,0.10)",
  boxShadow: "0 0 70px rgba(190,242,100,0.11)",
  overflow: "hidden",
};

const CTA_ICON_STYLE: React.CSSProperties = {
  display: "grid",
  placeItems: "center",
  width: 58,
  height: 58,
  borderRadius: 13,
  background: colors.lime,
  color: colors.obsidian,
};

const SWEEP_STYLE: React.CSSProperties = {
  position: "absolute",
  top: -80,
  width: 240,
  height: 250,
  transform: "rotate(18deg)",
  background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.13), transparent)",
};

const FOOTER_LEFT_STYLE: React.CSSProperties = {
  position: "absolute",
  left: 80,
  bottom: 70,
  fontFamily: mono,
  color: colors.faint,
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: 1.2,
};

const FOOTER_RIGHT_STYLE: React.CSSProperties = {
  position: "absolute",
  right: 80,
  bottom: 70,
  fontFamily: mono,
  color: colors.faint,
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: 1.2,
};

const SceneShell = ({children}: {children: React.ReactNode}) => (
  <AbsoluteFill style={{padding: 80}}>{children}</AbsoluteFill>
);

const Background = () => {
  const frame = useCurrentFrame();
  const drift = interpolate(frame, [0, 600], [0, 70]);
  const glow = 0.72 + Math.sin(frame / 32) * 0.08;

  return (
    <AbsoluteFill style={{background: colors.black, overflow: "hidden"}}>
      <AbsoluteFill style={{background: "linear-gradient(145deg, #07100f 0%, #030506 44%, #07100c 100%)"}} />
      <div style={{...GRID_OVERLAY_STYLE, transform: `translate(${drift}px, ${drift * 0.35}px)`}} />
      <div style={{...GLOW_TEAL_STYLE, opacity: glow}} />
      <div style={{...GLOW_LIME_STYLE, opacity: glow}} />
      <div style={{position: "absolute", inset: 34, border: "1px solid rgba(255,255,255,0.035)", borderRadius: 34}} />
    </AbsoluteFill>
  );
};

const STACK = ["macOS", "Windows", "Jamf", "Intune", "PowerShell"];

const IntroScene = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const sceneOpacity = fadeRange(frame, [3.75 * fps, 4.55 * fps], [1, 0]);
  const brandIn = reveal(frame, fps, 0.05);
  const lineOne = reveal(frame, fps, 0.38);
  const lineTwo = reveal(frame, fps, 0.7);
  const subIn = reveal(frame, fps, 1.5);
  const stack = STACK;

  return (
    <SceneShell>
      <div style={{opacity: sceneOpacity}}>
        <div style={{opacity: brandIn, transform: `translateY(${interpolate(brandIn, [0, 1], [-12, 0])}px)`}}><Brand /></div>
        <div style={{position: "absolute", top: 255, left: 80}}>
          <div style={{...EYEBROW_STYLE, opacity: lineOne}}>
            <Monitor size={21} /> THE JOB BOARD FOR ENDPOINT ENGINEERS
          </div>
          <div style={INTRO_HEADLINE_STYLE}>
            <div style={{opacity: lineOne, transform: `translateY(${interpolate(lineOne, [0, 1], [45, 0])}px)`}}>Your stack is</div>
            <div style={{color: colors.lime, opacity: lineTwo, transform: `translateY(${interpolate(lineTwo, [0, 1], [45, 0])}px)`}}>specialized.</div>
          </div>
          <div style={{...INTRO_SUBHEAD_STYLE, opacity: subIn, transform: `translateY(${interpolate(subIn, [0, 1], [20, 0])}px)`}}>
            Your job search should be too.
          </div>
        </div>

        <div style={{position: "absolute", left: 80, right: 80, bottom: 95, display: "flex", alignItems: "center", justifyContent: "space-between"}}>
          <div style={{display: "flex", gap: 13}}>
            {stack.map((item, index) => {
              const itemIn = snappyReveal(frame, fps, 1.9 + index * 0.1);
              return <div key={item} style={{opacity: itemIn, transform: `translateY(${interpolate(itemIn, [0, 1], [18, 0])}px)`}}><Pill active={index === 3}>{item}</Pill></div>;
            })}
          </div>
          <div style={{display: "flex", alignItems: "baseline", gap: 14, opacity: reveal(frame, fps, 2.2)}}>
            <span style={{fontFamily: sans, color: colors.white, fontSize: 48, fontWeight: 700, letterSpacing: -2}}>Hundreds</span>
            <span style={{fontFamily: mono, color: colors.muted, fontSize: 15, fontWeight: 700, letterSpacing: 1}}>OF OPEN ROLES</span>
          </div>
        </div>
      </div>
    </SceneShell>
  );
};

const SearchScene = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const sceneIn = fadeRange(frame, [0, 0.5 * fps]);
  const copyIn = reveal(frame, fps, 0.4);
  const queryText = "endpoint engineer";
  const typedCharacters = Math.floor(interpolate(frame, [1.15 * fps, 2.35 * fps], [0, queryText.length], {extrapolateLeft: "clamp", extrapolateRight: "clamp"}));
  const query = queryText.slice(0, typedCharacters);
  const filteredCount = Math.round(interpolate(frame, [1.2 * fps, 3.15 * fps], [210, 43], {extrapolateLeft: "clamp", extrapolateRight: "clamp"}));
  const resultCount = query.length === 0 ? "Hundreds" : filteredCount;

  return (
    <AbsoluteFill style={{clipPath: `inset(0 ${100 - sceneIn * 100}% 0 0)`}}>
      <AbsoluteFill style={{background: "linear-gradient(145deg, #020a09, #000000)"}} />
      <SceneShell>
        <div style={{position: "absolute", left: 80, top: 245, width: 700, opacity: copyIn, transform: `translateX(${interpolate(copyIn, [0, 1], [-32, 0])}px)`}}>
          <div style={SEARCH_EYEBROW_STYLE}><Search size={21} /> SEARCH WITH SIGNAL</div>
          <div style={SEARCH_HEADLINE_STYLE}>
            Built for the way<br />endpoint engineers<br /><span style={{color: colors.lime}}>actually search.</span>
          </div>
          <div style={{fontFamily: sans, fontSize: 25, color: colors.muted, lineHeight: 1.45, marginTop: 33, maxWidth: 585}}>Filter by platform, toolchain, workplace, salary, seniority, and freshness.</div>
        </div>
        <SearchWorkbench query={query} resultCount={resultCount} />
      </SceneShell>
    </AbsoluteFill>
  );
};

const ResultsScene = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const sceneIn = fadeRange(frame, [0, 0.55 * fps]);
  const headingIn = reveal(frame, fps, 0.2);

  return (
    <AbsoluteFill style={{clipPath: `inset(0 ${100 - sceneIn * 100}% 0 0)`}}>
      <AbsoluteFill style={{background: "linear-gradient(145deg, #020a09, #000000)"}} />
      <SceneShell>
        <div style={{display: "flex", justifyContent: "space-between", alignItems: "flex-end", opacity: headingIn, transform: `translateY(${interpolate(headingIn, [0, 1], [24, 0])}px)`}}>
          <div>
            <div style={{fontFamily: mono, color: colors.lime, fontSize: 16, fontWeight: 700, letterSpacing: 1.35}}>RELEVANT ROLES. ZERO GENERIC NOISE.</div>
            <div style={{fontFamily: sans, color: colors.white, fontSize: 74, fontWeight: 650, lineHeight: 1, letterSpacing: -3.5, marginTop: 22}}>See the signal.<br /><span style={{color: colors.muted}}>Skip the noise.</span></div>
          </div>
          <div style={{display: "flex", gap: 25, paddingBottom: 5}}>
            <Benefit icon="roles" label="Focused listings" />
            <Benefit icon="salary" label="Salary visibility" />
            <Benefit icon="map" label="Global discovery" />
          </div>
        </div>

        <div style={{display: "grid", gridTemplateColumns: "1.5fr 0.74fr", gap: 22, marginTop: 62}}>
          <div style={{display: "flex", flexDirection: "column", gap: 16}}>
            <JobCard delay={0.75} title="Senior Endpoint Engineer" company="Modern Workplace Team" location="Remote" salary="$145k–$175k" tags={["INTUNE", "POWERSHELL", "WINDOWS"]} />
            <JobCard delay={1.05} title="macOS Platform Engineer" company="Client Platform Engineering" location="Hybrid" salary="$130k–$165k" tags={["MACOS", "JAMF", "OKTA"]} />
            <JobCard delay={1.35} title="Digital Workplace Engineer" company="Enterprise Technology" location="Remote" salary="$120k–$150k" tags={["MDM", "DEFENDER", "ENTRA ID"]} />
          </div>
          <div style={{display: "flex", flexDirection: "column", gap: 18}}>
            <MiniMap />
            <GlassPanel style={{height: 245, padding: 28}}>
              <div style={PANEL_LABEL_STYLE}><Command size={18} color={colors.lime} /> YOUR SEARCH, DIALED IN</div>
              <div style={{fontFamily: sans, color: colors.white, fontSize: 31, fontWeight: 650, letterSpacing: -1, marginTop: 22}}>43 matching roles</div>
              <div style={PROGRESS_TRACK_STYLE}>
                <div style={{width: `${interpolate(frame, [1.6 * fps, 2.5 * fps], [0, 78], {extrapolateLeft: "clamp", extrapolateRight: "clamp"})}%`, height: "100%", borderRadius: 20, background: `linear-gradient(90deg, ${colors.emerald}, ${colors.lime})`}} />
              </div>
              <div style={{fontFamily: sans, color: colors.muted, fontSize: 17, marginTop: 15}}>Fresh roles across your stack, salary range, and workplace preferences.</div>
            </GlassPanel>
          </div>
        </div>
      </SceneShell>
    </AbsoluteFill>
  );
};

const OutroScene = ({siteUrl}: EndpointJobsAdProps) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const brandIn = reveal(frame, fps, 0.15);
  const titleIn = reveal(frame, fps, 0.55);
  const detailIn = reveal(frame, fps, 1.2);
  const ctaIn = snappyReveal(frame, fps, 1.75);
  const sceneIn = fadeRange(frame, [0, 0.65 * fps]);
  const sweep = interpolate(frame, [2.1 * fps, 4.6 * fps], [-420, 1900], {extrapolateLeft: "clamp", extrapolateRight: "clamp"});

  return (
    <AbsoluteFill style={{clipPath: `inset(0 0 0 ${100 - sceneIn * 100}%)`}}>
      <AbsoluteFill style={{background: "linear-gradient(145deg, #020a09, #000000)"}} />
      <SceneShell>
      <div style={OUTRO_CENTER_STYLE}>
        <div style={{opacity: brandIn, transform: `translateY(${interpolate(brandIn, [0, 1], [-18, 0])}px)`}}><Brand /></div>
        <div style={{...OUTRO_HEADLINE_STYLE, opacity: titleIn, transform: `translateY(${interpolate(titleIn, [0, 1], [40, 0])}px)`}}>
          Find your next<br /><span style={{color: colors.lime}}>endpoint role.</span>
        </div>
        <div style={{fontFamily: sans, color: colors.muted, fontSize: 29, marginTop: 30, opacity: detailIn}}>Hundreds of open roles. Refreshed daily. Built for your stack.</div>
        <div style={{...CTA_BUTTON_STYLE, opacity: ctaIn, transform: `scale(${interpolate(ctaIn, [0, 1], [0.96, 1])})`}}>
          <div style={{fontFamily: mono, color: colors.white, fontSize: 27, fontWeight: 700, letterSpacing: -0.4}}>{siteUrl}</div>
          <div style={CTA_ICON_STYLE}><ArrowRight size={29} strokeWidth={2.5} /></div>
          <div style={{...SWEEP_STYLE, left: sweep}} />
        </div>
      </div>
      <div style={FOOTER_LEFT_STYLE}>ENDPOINT · WORKPLACE · CLIENT PLATFORM</div>
      <div style={FOOTER_RIGHT_STYLE}>SEARCH WITH SIGNAL</div>
      </SceneShell>
    </AbsoluteFill>
  );
};

export const EndpointJobsAd = ({siteUrl}: EndpointJobsAdProps) => {
  const {fps} = useVideoConfig();

  return (
    <AbsoluteFill style={{fontFamily: sans, background: colors.black}}>
      <Background />
      <Sequence from={0} durationInFrames={4.8 * fps} premountFor={fps}>
        <IntroScene />
      </Sequence>
      <Sequence from={3.6 * fps} durationInFrames={7.3 * fps} premountFor={fps}>
        <SearchScene />
      </Sequence>
      <Sequence from={9.6 * fps} durationInFrames={6.5 * fps} premountFor={fps}>
        <ResultsScene />
      </Sequence>
      <Sequence from={14.6 * fps} durationInFrames={5.4 * fps} premountFor={fps}>
        <OutroScene siteUrl={siteUrl} />
      </Sequence>
    </AbsoluteFill>
  );
};
