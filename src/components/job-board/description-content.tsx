import { toDescriptionBlocks, type DescriptionBlock } from "@/lib/job-description";

export function DescriptionContent({ blocks }: { blocks: readonly DescriptionBlock[] }) {
  return blocks.map((block, index) =>
    block.type === "list" ? (
      <ul key={`list-${index}`}>
        {block.items.map((item, itemIndex) => (
          <li key={`${item.slice(0, 24)}-${itemIndex}`}>{item}</li>
        ))}
      </ul>
    ) : (
      <p key={`paragraph-${index}`}>{block.text}</p>
    )
  );
}

export { toDescriptionBlocks };
