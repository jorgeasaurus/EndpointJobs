"use client";

import { useSyncExternalStore } from "react";

import {
  roadmapSkillIdSet,
  roadmapTracks,
  skillIdsForLevel,
  skillIdsForTrack,
  type RoadmapLevel,
  type RoadmapTrack
} from "@/data/roadmap";
import {
  completionFor,
  readRoadmapProgress,
  roadmapProgressServerSnapshot,
  subscribeRoadmapProgress,
  toggleStoredRoadmapSkill
} from "@/lib/roadmap-progress";

export function RoadmapExperience() {
  const completed = useSyncExternalStore(
    subscribeRoadmapProgress,
    () => readRoadmapProgress(roadmapSkillIdSet),
    roadmapProgressServerSnapshot
  );

  return (
    <RoadmapBoard
      completed={completed}
      onToggle={(skillId) => toggleStoredRoadmapSkill(skillId, roadmapSkillIdSet)}
    />
  );
}

export function RoadmapBoard({
  completed,
  onToggle
}: {
  completed: ReadonlySet<string>;
  onToggle: (skillId: string) => void;
}) {
  return (
    <article className="roadmap">
      <header className="roadmap-intro">
        <p className="roadmap-kicker">Endpoint Jobs</p>
        <h1>Learning roadmap</h1>
        <p className="roadmap-lead">
          Two tracks for endpoint engineers. Check a skill when you can do it without a walkthrough.
          Progress stays in this browser.
        </p>
        <nav className="roadmap-jumps" aria-label="Roadmap tracks">
          {roadmapTracks.map((track) => (
            <a key={track.id} href={`#${track.id}`}>
              {track.title}
            </a>
          ))}
        </nav>
      </header>

      {roadmapTracks.map((track) => (
        <TrackSection key={track.id} completed={completed} onToggle={onToggle} track={track} />
      ))}
    </article>
  );
}

function TrackSection({
  completed,
  onToggle,
  track
}: {
  completed: ReadonlySet<string>;
  onToggle: (skillId: string) => void;
  track: RoadmapTrack;
}) {
  const progress = completionFor(skillIdsForTrack(track), completed);

  return (
    <section className="roadmap-track" id={track.id} aria-labelledby={`${track.id}-title`}>
      <header className="roadmap-track-head">
        <div>
          <h2 id={`${track.id}-title`}>{track.title}</h2>
          <p>{track.summary}</p>
          {track.training && track.training.length > 0 ? (
            <ul className="roadmap-sources roadmap-training">
              {track.training.map((source) => (
                <li key={source.url}>
                  <a href={source.url} rel="noopener noreferrer" target="_blank">
                    {source.title}
                    <span className="roadmap-source-publisher">{source.publisher}</span>
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <ProgressMeter label={`${track.title} progress`} progress={progress} />
      </header>

      {track.levels.map((level) => (
        <LevelSection
          key={level.id}
          completed={completed}
          level={level}
          onToggle={onToggle}
          track={track}
        />
      ))}
    </section>
  );
}

function LevelSection({
  completed,
  level,
  onToggle,
  track
}: {
  completed: ReadonlySet<string>;
  level: RoadmapLevel;
  onToggle: (skillId: string) => void;
  track: RoadmapTrack;
}) {
  const progress = completionFor(skillIdsForLevel(level), completed);
  const headingId = `${track.id}-${level.id}-title`;

  return (
    <section className="roadmap-level" aria-labelledby={headingId}>
      <header className="roadmap-level-head">
        <div>
          <h3 id={headingId}>{level.title}</h3>
          <p>{level.summary}</p>
        </div>
        <ProgressMeter label={`${track.title} ${level.title} progress`} progress={progress} />
      </header>

      <ul className="roadmap-skills">
        {level.skills.map((skill) => {
          const summaryId = `${skill.id}-summary`;
          return (
            <li key={skill.id}>
              <label className="roadmap-skill-label" htmlFor={skill.id}>
                <input
                  id={skill.id}
                  type="checkbox"
                  checked={completed.has(skill.id)}
                  aria-describedby={summaryId}
                  onChange={() => onToggle(skill.id)}
                />
                <span>{skill.title}</span>
              </label>
              <p id={summaryId}>{skill.summary}</p>
              <ul className="roadmap-sources">
                {skill.sources.map((source) => (
                  <li key={source.url}>
                    <a href={source.url} rel="noopener noreferrer" target="_blank">
                      {source.title}
                      <span className="roadmap-source-publisher">{source.publisher}</span>
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ProgressMeter({
  label,
  progress
}: {
  label: string;
  progress: { completed: number; total: number; percent: number };
}) {
  return (
    <div
      className="roadmap-meter"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={progress.percent}
      aria-valuetext={`${progress.completed} of ${progress.total} skills, ${progress.percent} percent`}
    >
      <span className="roadmap-meter-label" aria-hidden="true">
        {progress.percent}%
      </span>
      <span className="roadmap-meter-count" aria-hidden="true">
        {progress.completed} of {progress.total} skills
      </span>
      <span className="roadmap-meter-track" aria-hidden="true">
        <span className="roadmap-meter-fill" style={{ width: `${progress.percent}%` }} />
      </span>
    </div>
  );
}
