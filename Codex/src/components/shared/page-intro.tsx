interface PageIntroProps {
  eyebrow: string;
  title: string;
  summary: string;
}

export function PageIntro({ eyebrow, title, summary }: PageIntroProps) {
  return (
    <section className="page-intro reveal">
      <span className="eyebrow">{eyebrow}</span>
      <h1 className="page-title">{title}</h1>
      <p className="page-summary">{summary}</p>
    </section>
  );
}
