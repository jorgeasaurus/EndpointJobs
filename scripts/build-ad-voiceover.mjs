// Generate the social ad voiceover with ElevenLabs. Requires ELEVENLABS_API_KEY.
// One clip per scene so each line lands on its cut; timing lives in remotion/voiceover.json.
import {mkdirSync, readFileSync, writeFileSync} from "node:fs";

const VOICE_ID = process.env.ELEVENLABS_VOICE_ID ?? "JBFqnCBsd6RMkjVDRZzb"; // George
const MODEL_ID = "eleven_multilingual_v2";
const apiKey = process.env.ELEVENLABS_API_KEY;
if (!apiKey) throw new Error("Set ELEVENLABS_API_KEY");

const stats = JSON.parse(readFileSync("remotion/ad-stats.json", "utf8"));
const roundedTotal = Math.floor(stats.total / 100) * 100;
const [topTool, secondTool] = stats.tools.map((tool) => tool.name);

// Ids match the scenes in remotion/EndpointJobsSocial.tsx; scene lengths stretch to fit each clip.
const lines = [
  {id: "hook", text: "Still scrolling past help desk jobs?"},
  {id: "count", text: `${roundedTotal.toLocaleString("en-US")}+ endpoint roles. Nothing else.`},
  {id: "tools", text: `Filter by your stack. ${topTool}. ${secondTool}.`},
  {id: "proof", text: "Remote roles. Salaries up front."},
  {id: "cta", text: "Find your next role. Endpoint jobs dot dev."},
];

// mp3_44100_128 is constant bitrate, so byte length gives duration without ffprobe.
const BYTES_PER_SECOND = 128_000 / 8;

mkdirSync("public/voiceover", {recursive: true});
for (const line of lines) {
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: {"xi-api-key": apiKey, "Content-Type": "application/json", Accept: "audio/mpeg"},
    body: JSON.stringify({
      text: line.text,
      model_id: MODEL_ID,
      voice_settings: {stability: 0.45, similarity_boost: 0.8, style: 0.35, use_speaker_boost: true},
    }),
  });
  if (!response.ok) throw new Error(`${line.id}: ${response.status} ${await response.text()}`);
  const audio = Buffer.from(await response.arrayBuffer());
  writeFileSync(`public/voiceover/${line.id}.mp3`, audio);
  line.file = `voiceover/${line.id}.mp3`;
  line.durationSeconds = Number((audio.length / BYTES_PER_SECOND).toFixed(2));
  console.log(`${line.file}  ${line.durationSeconds}s  "${line.text}"`);
}

writeFileSync("remotion/voiceover.json", `${JSON.stringify(lines, null, 2)}\n`);
