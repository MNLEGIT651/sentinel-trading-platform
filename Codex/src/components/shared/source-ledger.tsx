import type { SourceRecord } from '@/lib/types';

interface SourceLedgerProps {
  title: string;
  records: SourceRecord[];
}

export function SourceLedger({ title, records }: SourceLedgerProps) {
  return (
    <section className="section-block reveal">
      <div className="section-header">
        <h2>{title}</h2>
        <p>Primary inputs, official references, and repo intelligence driving the product.</p>
      </div>

      <div className="source-grid">
        {records.map((record) => {
          const body = (
            <>
              <div className="source-kind">{record.kind}</div>
              <h3>{record.label}</h3>
              <p>{record.note}</p>
              {record.dateContext ? <p className="source-date">{record.dateContext}</p> : null}
            </>
          );

          return record.href ? (
            <a
              key={record.label}
              href={record.href}
              target="_blank"
              rel="noreferrer"
              className="source-card"
            >
              {body}
              <span className="source-link">Open reference</span>
            </a>
          ) : (
            <article key={record.label} className="source-card source-card-static">
              {body}
            </article>
          );
        })}
      </div>
    </section>
  );
}
