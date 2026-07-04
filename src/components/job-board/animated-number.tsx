export function AnimatedNumber({
  className,
  value
}: {
  className: string;
  value: number;
}) {
  return <span aria-hidden="true" className={className}>{value}</span>;
}
