import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { RoadmapBoard, RoadmapExperience } from "../../src/components/roadmap/roadmap-board";
import {
  allRoadmapSkillIds,
  roadmapLevelIds,
  roadmapLevelTitles,
  roadmapPageDescription,
  roadmapPageTitle,
  roadmapSkillIdSet,
  roadmapTracks,
  skillIdsForLevel,
  skillIdsForTrack
} from "../../src/data/roadmap";
import {
  completionFor,
  loadCompletedSkillIds,
  parseCompletedSkillIds,
  ROADMAP_PROGRESS_STORAGE_KEY,
  saveCompletedSkillIds,
  serializeCompletedSkillIds,
  toggleSkillId
} from "../../src/lib/roadmap-progress";
import sitemap from "../../src/app/sitemap";
import { getRoadmapPath, siteUrl } from "../../src/app/site-metadata";

const sourceHosts = new Set([
  "learn.microsoft.com",
  "support.apple.com",
  "learn.jamf.com",
  "www.jamf.com",
  "developer.jamf.com",
  "github.com",
  "msendpointmgr.com",
  "scriptingosx.com",
  "derflounder.wordpress.com"
]);

test("roadmap tracks have four named levels and sourced skills", () => {
  assert.deepEqual(roadmapTracks.map((track) => track.id), ["intune", "jamf"]);
  assert.deepEqual(roadmapTracks.map((track) => track.title), ["Microsoft Intune", "Jamf"]);
  assert.match(roadmapPageTitle, /roadmap/i);
  assert.match(roadmapPageDescription, /Intune/);
  assert.match(roadmapPageDescription, /Jamf/);

  const ids = allRoadmapSkillIds();
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual([...roadmapSkillIdSet], ids);

  for (const track of roadmapTracks) {
    assert.equal(track.summary.trim().length > 0, true);
    for (const source of track.training ?? []) {
      const url = new URL(source.url);
      assert.equal(url.protocol, "https:");
      assert.equal(sourceHosts.has(url.hostname), true, source.url);
    }
    assert.deepEqual(
      track.levels.map((level) => level.id),
      [...roadmapLevelIds]
    );
    const trackIds = skillIdsForTrack(track);
    assert.equal(trackIds.length, track.levels.reduce((sum, level) => sum + level.skills.length, 0));

    for (const level of track.levels) {
      assert.equal(level.title, roadmapLevelTitles[level.id]);
      assert.equal(level.summary.trim().length > 0, true);
      assert.ok(level.skills.length >= 4, `${track.id} ${level.id} needs concrete skills`);
      for (const skill of level.skills) {
        assert.match(skill.id, /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/);
        assert.equal(skill.id.startsWith(`${track.id}.`), true);
        assert.equal(skill.title.trim().length > 0, true);
        assert.equal(skill.summary.trim().length > 0, true);
        assert.ok(skill.sources.length >= 1 && skill.sources.length <= 3, skill.id);
        const urls = skill.sources.map((source) => source.url);
        assert.equal(new Set(urls).size, urls.length, skill.id);
        for (const source of skill.sources) {
          const url = new URL(source.url);
          assert.equal(url.protocol, "https:");
          assert.equal(sourceHosts.has(url.hostname), true, source.url);
          assert.equal(source.title.trim().length > 0, true);
          assert.equal(source.publisher.trim().length > 0, true);
        }
      }
    }
  }
});

test("completion is skill counts for a level and a track", () => {
  assert.deepEqual(completionFor([], new Set()), { completed: 0, total: 0, percent: 0 });
  assert.deepEqual(completionFor(["a", "b", "c"], new Set(["a"])), { completed: 1, total: 3, percent: 33 });
  assert.deepEqual(completionFor(["a", "b", "c", "d", "e", "f"], new Set(["a"])), {
    completed: 1,
    total: 6,
    percent: 17
  });
  assert.equal(completionFor(["a", "b"], new Set(["a", "b"])).percent, 100);

  const track = roadmapTracks[0]!;
  const first = track.levels[0]!.skills[0]!.id;
  const completed = new Set([first]);
  const level = completionFor(skillIdsForLevel(track.levels[0]!), completed);
  const whole = completionFor(skillIdsForTrack(track), completed);
  assert.equal(level.completed, 1);
  assert.equal(whole.completed, 1);
  assert.equal(whole.total, track.levels.reduce((sum, item) => sum + item.skills.length, 0));

  const levelMean = Math.round((completionFor(["a"], new Set(["a"])).percent + completionFor(["b", "c", "d"], new Set()).percent) / 2);
  assert.equal(completionFor(["a", "b", "c", "d"], new Set(["a"])).percent, 25);
  assert.notEqual(completionFor(["a", "b", "c", "d"], new Set(["a"])).percent, levelMean);
});

test("stored progress ignores unknown ids and survives bad JSON", () => {
  const known = new Set(["intune.foundations.mdm-mam", "jamf.admin.policies"]);
  assert.deepEqual([...parseCompletedSkillIds(null, known)], []);
  assert.deepEqual([...parseCompletedSkillIds("{", known)], []);
  assert.deepEqual([...parseCompletedSkillIds("{}", known)], []);
  assert.deepEqual([...parseCompletedSkillIds("null", known)], []);
  assert.deepEqual(
    [...parseCompletedSkillIds(JSON.stringify(["missing", "intune.foundations.mdm-mam", 4, "intune.foundations.mdm-mam"]), known)],
    ["intune.foundations.mdm-mam"]
  );

  const memory = new Map<string, string>();
  const storage = {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => {
      memory.set(key, value);
    }
  };
  assert.equal(saveCompletedSkillIds(storage, new Set(["jamf.admin.policies", "intune.foundations.mdm-mam"])), true);
  assert.equal(memory.get(ROADMAP_PROGRESS_STORAGE_KEY), serializeCompletedSkillIds(new Set(known)));
  assert.deepEqual(
    [...loadCompletedSkillIds(storage, known)].sort(),
    ["intune.foundations.mdm-mam", "jamf.admin.policies"]
  );

  const broken = {
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("full");
    }
  };
  assert.equal(loadCompletedSkillIds(broken, known).size, 0);
  assert.equal(saveCompletedSkillIds(broken, known), false);

  const toggled = toggleSkillId(new Set(["intune.foundations.mdm-mam"]), "intune.foundations.mdm-mam", known);
  assert.equal(toggled.has("intune.foundations.mdm-mam"), false);
  assert.equal(toggleSkillId(toggled, "not-a-skill", known), toggled);
  assert.equal(toggleSkillId(toggled, "jamf.admin.policies", known).has("jamf.admin.policies"), true);
});

test("roadmap page renders skills, source links, and progress", () => {
  const initial = renderToStaticMarkup(createElement(RoadmapExperience));
  assert.match(initial, /<h1>Learning roadmap<\/h1>/);
  assert.match(initial, /Microsoft Intune/);
  assert.match(initial, /Jamf/);
  assert.equal(initial.match(/<h3[^>]*>Foundations<\/h3>/g)?.length, 2);
  assert.equal(initial.match(/<h3[^>]*>Admin<\/h3>/g)?.length, 2);
  assert.equal(initial.match(/<h3[^>]*>Engineer<\/h3>/g)?.length, 2);
  assert.equal(initial.match(/<h3[^>]*>Architect<\/h3>/g)?.length, 2);
  assert.match(initial, /aria-valuenow="0"/);
  assert.match(initial, /Progress stays in this browser/);
  assert.doesNotMatch(initial, /checked=""/);

  const track = roadmapTracks[1]!;
  const skill = track.levels[1]!.skills[0]!;
  const completed = new Set([skill.id]);
  const html = renderToStaticMarkup(createElement(RoadmapBoard, { completed, onToggle: () => undefined }));
  const checked = html.split("<input").find((part) => part.includes(`id="${skill.id}"`));
  const unchecked = html.split("<input").find((part) => part.includes('id="intune.foundations.mdm-mam"'));
  assert.ok(checked);
  assert.match(checked, /checked=""/);
  assert.ok(unchecked);
  assert.doesNotMatch(unchecked, /checked/);
  assert.match(html, new RegExp(`aria-valuenow="${completionFor(skillIdsForLevel(track.levels[1]!), completed).percent}"`));
  assert.match(html, new RegExp(`aria-valuenow="${completionFor(skillIdsForTrack(track), completed).percent}"`));
  assert.match(html, new RegExp(`aria-describedby="${skill.id}-summary"`));

  for (const source of skill.sources) {
    assert.match(html, new RegExp(`href="${source.url}"[^>]*rel="noopener noreferrer"[^>]*target="_blank"`));
  }
  assert.match(html, /href="#intune"/);
  assert.match(html, /href="#jamf"/);
  assert.doesNotMatch(html, /href="#intune"[^>]*target="_blank"/);

  const page = readFileSync(new URL("../../src/app/roadmap/page.tsx", import.meta.url), "utf8");
  const topbar = readFileSync(new URL("../../src/components/job-board/topbar.tsx", import.meta.url), "utf8");
  const header = topbar.slice(topbar.indexOf("export function Topbar"), topbar.indexOf("export function SiteFooter"));
  const footer = topbar.slice(topbar.indexOf("export function SiteFooter"));
  assert.match(page, /roadmapPageTitle/);
  assert.match(page, /roadmapPageDescription/);
  assert.match(page, /socialTitle/);
  assert.match(page, /openGraph/);
  assert.match(page, /canonical/);
  assert.match(page, /ogImage/);
  assert.match(header, /Learning roadmap/);
  assert.match(header, /getMcpDocsPath\(\)/);
  assert.match(header, /getRoadmapPath\(\)/);
  assert.doesNotMatch(header, /getApiDocsPath\(\)/);
  assert.doesNotMatch(header, /buymeacoffee/);
  assert.doesNotMatch(header, /report-or-request/);
  assert.match(footer, /getApiDocsPath\(\)/);
  assert.match(footer, /buymeacoffee/);
  assert.match(footer, /report-or-request/);
  assert.equal(footer.split("getRoadmapPath()").length - 1, 1);
  assert.match(footer, /aria-label="Browse"/);
  assert.match(footer, /aria-label="Project"/);
  assert.equal(getRoadmapPath(), "/roadmap");
  assert.ok(sitemap().some((entry) => entry.url === new URL("/roadmap", siteUrl).toString()));
});
