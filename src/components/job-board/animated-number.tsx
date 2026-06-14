import { SlotText } from "slot-text/react";

const slotNumberOptions = {
  bounce: 0.22,
  direction: "up",
  duration: 260,
  stagger: 26
} as const;

export function AnimatedNumber({
  className,
  value
}: {
  className: string;
  value: number;
}) {
  return (
    <SlotText
      aria-hidden="true"
      className={className}
      text={value.toString()}
      options={slotNumberOptions}
    />
  );
}
