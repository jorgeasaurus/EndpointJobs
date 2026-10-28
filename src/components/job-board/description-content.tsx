import type { DescriptionBlock } from "@/lib/job-description";

function occurrenceKey(seen: Map<string, number>, value: string) {
  const count = seen.get(value) ?? 0;
  seen.set(value, count + 1);
  return count === 0 ? value : `${value}#${count}`;
}

export function DescriptionContent({ blocks }: { blocks: readonly DescriptionBlock[] }) {
  const blockKeys = new Map<string, number>();

  return blocks.map((block) => {
    if (block.type === "list") {
      const itemKeys = new Map<string, number>();
      return (
        <ul className="description-list" key={occurrenceKey(blockKeys, `list:${block.items.join("\u0001")}`)}>
          {block.items.map((item) => (
            <li key={occurrenceKey(itemKeys, item)}>{item}</li>
          ))}
        </ul>
      );
    }

    if (block.type === "heading") {
      return (
        <h3 className="description-heading" key={occurrenceKey(blockKeys, `h:${block.text}`)}>
          {block.text}
        </h3>
      );
    }

    return <p key={occurrenceKey(blockKeys, `p:${block.text}`)}>{block.text}</p>;
  });
}
