import { CheckCircle2, ChevronDown, Sparkles } from "lucide-react";

// Adapted from Beautiful UI's Recommendation Card primitive.
// https://www.beautifului.dev/#recommendation-card
export function MatchRecommendation({ reasons }: { reasons: string[] }) {
  const visibleReasons = reasons.slice(0, 3);
  const additionalReasons = reasons.slice(3);

  return (
    <div className="match-recommendation">
      <div className="match-recommendation-heading">
        <span>
          <Sparkles size={15} aria-hidden="true" />
          Why this role is included
        </span>
        <strong>{reasons.length} signals</strong>
      </div>

      <div className="match-row">
        {visibleReasons.map((reason) => (
          <span key={reason}>
            <CheckCircle2 size={14} aria-hidden="true" />
            {reason}
          </span>
        ))}
      </div>

      {additionalReasons.length > 0 ? (
        <details className="match-recommendation-more">
          <summary>
            View {additionalReasons.length} more
            <ChevronDown size={14} aria-hidden="true" />
          </summary>
          <div className="match-recommendation-drawer">
            {additionalReasons.map((reason) => (
              <span key={reason}>
                <CheckCircle2 size={14} aria-hidden="true" />
                {reason}
              </span>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}
