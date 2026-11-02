import type { Block, Run } from "@/lib/modules/contrats/render";
import { Icon } from "../ui/Icon";
import "@/styles/contrats.css";

function Runs({ runs, marks }: { runs: Run[]; marks: boolean }) {
  return (
    <>
      {runs.map((r, i) => {
        const inner = marks && r.placeholder ? <mark>{r.text}</mark> : r.text;
        return r.bold ? <b key={i}>{inner}</b> : <span key={i}>{inner}</span>;
      })}
    </>
  );
}

/**
 * Aperçu HTML d'un contrat ou d'un modèle (mêmes blocs que le PDF). Aucun HTML brut : tout est échappé par React.
 * `notes` : affiche les notes internes (back-office) ; `marks` : surligne les mentions [À COMPLÉTER].
 */
export function ContractDocument({ blocks, notes = false, marks = true }: { blocks: Block[]; notes?: boolean; marks?: boolean }) {
  let metaDone = false;
  return (
    <div className="ct-doc">
      {blocks.map((b, i) => {
        switch (b.t) {
          case "h1":
            return <h1 key={i}>{b.text}</h1>;
          case "h2":
            return <h2 key={i}>{b.text}</h2>;
          case "h3":
            return <h3 key={i}>{b.text}</h3>;
          case "p": {
            const meta = !metaDone && /^Contrat n° /.test(b.runs[0]?.text ?? "");
            if (meta) metaDone = true;
            return (
              <p key={i} className={meta ? "ct-meta" : undefined}>
                <Runs runs={b.runs} marks={marks} />
              </p>
            );
          }
          case "ul":
            return (
              <ul key={i}>
                {b.items.map((it, j) => (
                  <li key={j}>
                    <Runs runs={it} marks={marks} />
                  </li>
                ))}
              </ul>
            );
          case "callout":
            return (
              <p key={i} className="ct-callout">
                <Runs runs={b.runs} marks={marks} />
              </p>
            );
          case "note": {
            if (!notes) return null;
            const draft = b.runs.some((r) => r.text.startsWith("BROUILLON")); // avertissement juriste (templates.ts)
            return (
              <div key={i} className={"ct-note" + (draft ? " draft" : "")} role="note">
                <Icon name={draft ? "lock" : "edit"} />
                <span>
                  <Runs runs={b.runs} marks={!draft} />
                </span>
              </div>
            );
          }
          case "hr":
            return <hr key={i} />;
        }
      })}
    </div>
  );
}
