export function ParallaxBackground() {
  return (
    <div className="parallax-field" aria-hidden="true">
      <span className="parallax-atmosphere" />
      <span className="parallax-stars parallax-stars--far" />
      <span className="parallax-stars parallax-stars--mid" />
      <span className="parallax-stars parallax-stars--near" />
    </div>
  );
}
