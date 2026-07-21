import type {ReactNode} from "react";
import {
  ArrowUpRight,
  BriefcaseBusiness,
  Check,
  DollarSign,
  MapPin,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import {
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import {colors, fadeRange, mono, reveal, sans, snappyReveal} from "./theme";

const PILL_STYLE: React.CSSProperties = {
  borderRadius: 12,
  padding: "12px 18px",
  fontFamily: mono,
  fontSize: 18,
  fontWeight: 700,
  letterSpacing: 0.2,
  whiteSpace: "nowrap",
};

const SEARCH_BOX_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  height: 78,
  marginTop: 32,
  padding: "0 24px",
  borderRadius: 14,
  background: "rgba(0,0,0,0.42)",
};

const JOB_CARD_STYLE: React.CSSProperties = {
  position: "relative",
  display: "grid",
  gridTemplateColumns: "1fr auto",
  gap: 18,
  padding: "26px 28px",
  border: `1px solid ${colors.border}`,
  borderRadius: 18,
  background: "linear-gradient(110deg, rgba(18,24,28,0.96), rgba(8,11,13,0.98))",
};

const JOB_TAG_STYLE: React.CSSProperties = {
  padding: "7px 10px",
  borderRadius: 7,
  background: "rgba(190,242,100,0.075)",
  color: colors.lime,
  fontFamily: mono,
  fontSize: 12,
  fontWeight: 700,
};

const APPLY_BUTTON_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 9,
  fontFamily: sans,
  fontSize: 16,
  fontWeight: 700,
  color: colors.obsidian,
  background: colors.lime,
  padding: "11px 15px",
  borderRadius: 9,
};

const MAP_POINT_STYLE: React.CSSProperties = {
  position: "absolute",
  width: 18,
  height: 18,
  borderRadius: 20,
};

const MAP_LABEL_STYLE: React.CSSProperties = {
  position: "absolute",
  left: 25,
  top: 22,
  display: "flex",
  alignItems: "center",
  gap: 9,
  color: colors.white,
  fontFamily: mono,
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: 0.8,
};

const BENEFIT_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 13,
  color: colors.white,
  fontFamily: sans,
  fontSize: 21,
  fontWeight: 600,
};

const BENEFIT_ICON_STYLE: React.CSSProperties = {
  display: "grid",
  placeItems: "center",
  width: 36,
  height: 36,
  borderRadius: 10,
  background: "rgba(190,242,100,0.12)",
  color: colors.lime,
};

export const Brand = ({compact = false}: {compact?: boolean}) => (
  <div style={{display: "flex", alignItems: "center", gap: compact ? 16 : 20}}>
    <Img
      src={staticFile("endpoint-jobs-icon.svg")}
      style={{width: compact ? 54 : 64, height: compact ? 54 : 64}}
    />
    <div
      style={{
        color: colors.white,
        fontFamily: sans,
        fontSize: compact ? 27 : 32,
        fontWeight: 650,
        letterSpacing: -0.8,
      }}
    >
      Endpoint Jobs
    </div>
  </div>
);

export const Pill = ({
  children,
  active = false,
}: {
  children: ReactNode;
  active?: boolean;
}) => (
  <div
    style={{
      ...PILL_STYLE,
      border: `1px solid ${active ? "rgba(190, 242, 100, 0.48)" : colors.border}`,
      color: active ? colors.lime : "rgba(243, 244, 246, 0.74)",
      background: active ? "rgba(190, 242, 100, 0.09)" : "rgba(255, 255, 255, 0.035)",
    }}
  >
    {children}
  </div>
);

export const GlassPanel = ({
  children,
  style,
}: {
  children: ReactNode;
  style?: React.CSSProperties;
}) => (
  <div
    style={{
      border: `1px solid ${colors.border}`,
      borderRadius: 24,
      background: "linear-gradient(145deg, rgba(22, 29, 33, 0.94), rgba(8, 11, 13, 0.96))",
      boxShadow: "0 35px 110px rgba(0, 0, 0, 0.52), inset 0 1px 0 rgba(255,255,255,0.035)",
      overflow: "hidden",
      ...style,
    }}
  >
    {children}
  </div>
);

export const SearchWorkbench = ({
  query,
  resultCount,
}: {
  query: string;
  resultCount: number | "Hundreds";
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const panelIn = reveal(frame, fps, 0.1);
  const chipIn = snappyReveal(frame, fps, 1.8);

  return (
    <GlassPanel
      style={{
        position: "absolute",
        width: 980,
        height: 740,
        right: 80,
        top: 170,
        opacity: panelIn,
        transform: `translateY(${interpolate(panelIn, [0, 1], [42, 0])}px) scale(${interpolate(panelIn, [0, 1], [0.97, 1])})`,
      }}
    >
      <div style={{display: "flex", alignItems: "center", justifyContent: "space-between", padding: "30px 34px", borderBottom: `1px solid ${colors.border}`}}>
        <Brand compact />
        <div style={{display: "flex", alignItems: "baseline", gap: 12}}>
          <span style={{fontFamily: mono, fontSize: 14, fontWeight: 700, color: colors.lime, letterSpacing: 1.2}}>OPEN ROLES</span>
          <span style={{fontFamily: sans, fontSize: typeof resultCount === "number" ? 42 : 28, lineHeight: 1, fontWeight: 700, color: colors.white}}>{resultCount}</span>
        </div>
      </div>

      <div style={{padding: 36}}>
        <div style={{fontFamily: sans, fontWeight: 700, fontSize: 52, letterSpacing: -1.8, color: colors.white}}>Endpoint Jobs</div>
        <div style={{fontFamily: sans, fontSize: 22, color: colors.muted, marginTop: 8}}>Focused roles for the tools you actually use.</div>

        <div style={{...SEARCH_BOX_STYLE, border: `1px solid ${query ? "rgba(190,242,100,0.46)" : colors.border}`, boxShadow: query ? "0 0 36px rgba(190,242,100,0.08)" : "none"}}>
          <Search size={27} strokeWidth={2} color={query ? colors.lime : colors.muted} />
          <span style={{fontFamily: sans, fontSize: 25, color: query ? colors.white : colors.muted, marginLeft: 17}}>{query || "Search Jamf, Intune, macOS, SCCM..."}</span>
          <span style={{width: 2, height: 31, marginLeft: 5, background: colors.lime, opacity: frame % 22 < 14 ? 1 : 0}} />
        </div>

        <div style={{display: "flex", gap: 12, marginTop: 18, opacity: chipIn, transform: `translateY(${interpolate(chipIn, [0, 1], [14, 0])}px)`}}>
          <Pill active>Remote / Hybrid</Pill>
          <Pill active>Salary shown</Pill>
          <Pill>Last 7 days</Pill>
        </div>

        <div style={{height: 1, background: colors.border, margin: "32px 0 26px"}} />
        <div style={{display: "flex", alignItems: "center", gap: 12, color: colors.white}}>
          <SlidersHorizontal size={22} color={colors.muted} />
          <span style={{fontFamily: sans, fontWeight: 650, fontSize: 22}}>Filter stack</span>
        </div>
        <div style={{display: "flex", flexWrap: "wrap", gap: 12, marginTop: 20}}>
          {["Intune", "macOS", "PowerShell", "Jamf", "SCCM", "Defender"].map((tool, index) => {
            const toolIn = snappyReveal(frame, fps, 2.15 + index * 0.08);
            const active = index < 3;
            return (
              <div key={tool} style={{opacity: toolIn, transform: `translateY(${interpolate(toolIn, [0, 1], [12, 0])}px)`}}>
                <Pill active={active}>{tool}</Pill>
              </div>
            );
          })}
        </div>

        <div style={{display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginTop: 30}}>
          {[
            {label: "MATCHING", value: resultCount, color: colors.lime},
            {label: "REMOTE / HYBRID", value: 31, color: colors.emerald},
            {label: "SALARY SHOWN", value: 18, color: colors.cyan},
          ].map((metric) => (
            <div key={metric.label} style={{padding: "18px 20px", borderRadius: 14, border: `1px solid ${colors.border}`, background: "rgba(255,255,255,0.025)"}}>
              <div style={{fontFamily: sans, fontSize: 28, fontWeight: 700, color: metric.color}}>{metric.value}</div>
              <div style={{fontFamily: mono, fontSize: 12, fontWeight: 700, color: colors.muted, letterSpacing: 0.9, marginTop: 5}}>{metric.label}</div>
            </div>
          ))}
        </div>
      </div>
    </GlassPanel>
  );
};

type JobCardProps = {
  company: string;
  delay: number;
  location: string;
  salary: string;
  tags: string[];
  title: string;
};

export const JobCard = ({company, delay, location, salary, tags, title}: JobCardProps) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const entrance = reveal(frame, fps, delay);
  const highlight = fadeRange(frame, [(delay + 0.45) * fps, (delay + 0.8) * fps]);

  return (
    <div
      style={{
        ...JOB_CARD_STYLE,
        boxShadow: `0 26px 70px rgba(0,0,0,0.35), inset 3px 0 0 rgba(190,242,100,${0.15 + highlight * 0.7})`,
        opacity: entrance,
        transform: `translateX(${interpolate(entrance, [0, 1], [55, 0])}px)`,
      }}
    >
      <div>
        <div style={{fontFamily: sans, fontSize: 28, fontWeight: 680, letterSpacing: -0.6, color: colors.white}}>{title}</div>
        <div style={{fontFamily: sans, fontSize: 18, color: colors.muted, marginTop: 7}}>{company}</div>
        <div style={{display: "flex", gap: 9, marginTop: 17}}>
          {tags.map((tag) => (
            <div key={tag} style={JOB_TAG_STYLE}>{tag}</div>
          ))}
        </div>
      </div>
      <div style={{display: "flex", flexDirection: "column", alignItems: "flex-end", justifyContent: "space-between"}}>
        <div style={{display: "flex", gap: 16, fontFamily: mono, fontSize: 13, color: colors.muted}}>
          <span style={{display: "flex", gap: 7, alignItems: "center"}}><MapPin size={15} color={colors.emerald} />{location}</span>
          <span style={{display: "flex", gap: 5, alignItems: "center", color: colors.white}}><DollarSign size={15} color={colors.lime} />{salary}</span>
        </div>
        <div style={APPLY_BUTTON_STYLE}>View role <ArrowUpRight size={18} strokeWidth={2.5} /></div>
      </div>
    </div>
  );
};

const MAP_POINTS = [
  {x: 18, y: 43, delay: 0.2},
  {x: 30, y: 34, delay: 0.35},
  {x: 45, y: 52, delay: 0.5},
  {x: 61, y: 28, delay: 0.65},
  {x: 73, y: 42, delay: 0.8},
  {x: 84, y: 30, delay: 0.95},
];

export const MiniMap = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const points = MAP_POINTS;

  return (
    <GlassPanel style={{height: 220, position: "relative", background: "rgba(7,10,11,0.92)"}}>
      <div style={{position: "absolute", inset: 0, opacity: 0.7, backgroundImage: "linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px)", backgroundSize: "52px 52px"}} />
      <div style={MAP_LABEL_STYLE}><MapPin size={17} color={colors.emerald} /> JOB GEOGRAPHY</div>
      {points.map((point, index) => {
        const pointIn = snappyReveal(frame, fps, point.delay);
        const pulse = 1 + Math.sin((frame - index * 4) / 8) * 0.07;
        return (
          <div key={`${point.x}-${point.y}`} style={{...MAP_POINT_STYLE, left: `${point.x}%`, top: `${point.y}%`, background: index % 3 === 0 ? colors.lime : colors.emerald, boxShadow: `0 0 0 8px ${index % 3 === 0 ? "rgba(190,242,100,0.11)" : "rgba(45,212,191,0.10)"}, 0 0 24px rgba(190,242,100,0.25)`, opacity: pointIn, transform: `scale(${pointIn * pulse})`}} />
        );
      })}
    </GlassPanel>
  );
};

export const Benefit = ({icon, label}: {icon: "roles" | "salary" | "map"; label: string}) => {
  const Icon = icon === "roles" ? BriefcaseBusiness : icon === "salary" ? DollarSign : MapPin;
  return (
    <div style={BENEFIT_STYLE}>
      <div style={BENEFIT_ICON_STYLE}><Icon size={20} /></div>
      {label}
      <Check size={18} color={colors.lime} strokeWidth={3} />
    </div>
  );
};
